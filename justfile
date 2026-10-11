# Local development. `just setup` once, then `just dev`.
#
# auth-worker and report-gate are private and live in FreiFahren/internal, cloned next to this
# repository (or wherever FREIFAHREN_INTERNAL points). Every recipe skips them when it's absent:
# signed-in routes then answer 503 and reports are accepted without scoring.

set shell := ["bash", "-euo", "pipefail", "-c"]

internal := env_var_or_default("FREIFAHREN_INTERNAL", "../internal")
auth_worker := internal / "packages/auth-worker"
report_gate := internal / "packages/report-gate"
api_url := "http://localhost:8787"
auth_url := "http://localhost:8788"

[private]
default:
    @just --list

# Install dependencies, create missing local env files, and prepare the local databases
setup: install env seed
    @if [ -d "{{ auth_worker }}" ]; then cd "{{ auth_worker }}" && bun run db:migrate; fi

# Install dependencies in every package that has its own lockfile
install:
    #!/usr/bin/env bash
    set -euo pipefail
    for dir in packages/*/ "{{ auth_worker }}" "{{ report_gate }}"; do
        [ -f "$dir/bun.lock" ] || continue
        echo "→ $dir"
        (cd "$dir" && bun install --frozen-lockfile)
    done

# Create local env files that don't exist yet; existing ones are left alone
env:
    #!/usr/bin/env bash
    set -euo pipefail
    # Worker configs carry production values (Sentry DSNs, NODE_ENV=production) as vars, and
    # `wrangler dev` only overrides them from .dev.vars. Without one, local errors are reported to
    # the production Sentry projects, so new files always blank the DSN.
    for dir in packages/api-worker packages/telegram-worker "{{ report_gate }}" "{{ auth_worker }}"; do
        [ -d "$dir" ] && [ ! -f "$dir/.dev.vars" ] || continue
        example="$dir/.dev.vars.example"
        { [ -f "$example" ] && grep -vE '^(SENTRY_DSN|NODE_ENV)=' "$example" || true; } > "$dir/.dev.vars"
        printf 'SENTRY_DSN=\nNODE_ENV=development\n' >> "$dir/.dev.vars"
        echo "created $dir/.dev.vars"
    done
    if [ ! -f packages/frontend-next/.env ]; then
        cp packages/frontend-next/.env.example packages/frontend-next/.env
        echo "created packages/frontend-next/.env"
    fi

# Seed the local API database for one city, or for every city in the registry
seed city="":
    #!/usr/bin/env bash
    set -euo pipefail
    cd packages/api-worker
    cities="{{ city }}"
    if [ -z "$cities" ]; then
        cities=$(bun -e "import { CITY_SLUGS } from '@freifahren/cities'; console.log(CITY_SLUGS.join(' '))")
    fi
    for city in $cities; do bun run seed --city "$city"; done

# Run the auth-worker, the API (with report-gate and telegram-worker) and the frontend together
dev: env
    #!/usr/bin/env bash
    set -euo pipefail
    # Ctrl-C, or the script ending, takes every process down with it.
    trap 'trap - EXIT INT TERM; kill 0 2>/dev/null' EXIT INT TERM

    run() {
        local name=$1 dir=$2
        shift 2
        (cd "$dir" && "$@" 2>&1 | awk -v prefix="[$name] " '{ print prefix $0; fflush() }') &
    }

    for vars in packages/*/.dev.vars "{{ auth_worker }}/.dev.vars" "{{ report_gate }}/.dev.vars"; do
        [ -f "$vars" ] || continue
        if grep -qE '^SENTRY_DSN=.+' "$vars"; then
            echo "warning: $vars sets SENTRY_DSN, so local errors from it reach Sentry" >&2
        fi
    done

    # Distinct inspector ports: two wrangler processes starting together otherwise race for 9229.
    # The api-worker's AUTH binding finds the auth-worker through wrangler's local dev registry.
    auth_url=""
    if [ -d "{{ auth_worker }}" ]; then
        run auth "{{ auth_worker }}" bun run dev --inspector-port 9230
        auth_url="{{ auth_url }}"
    else
        echo "No auth-worker at {{ auth_worker }}: sign-in is hidden and signed-in routes answer 503" >&2
    fi

    # Run here rather than through the api-worker's dev:with-report-gate script, so a relocated
    # FREIFAHREN_INTERNAL applies too.
    if [ -d "{{ report_gate }}" ]; then
        report_gate=$(cd "{{ report_gate }}" && pwd)
        run api packages/api-worker bunx wrangler dev --inspector-port 9229 \
            -c wrangler.jsonc -c "$report_gate/wrangler.jsonc" -c ../telegram-worker/wrangler.jsonc
    else
        echo "No report-gate at {{ report_gate }}: running the API alone" >&2
        run api packages/api-worker bun run dev --inspector-port 9229
    fi

    # Passed explicitly so a stale .env can't point the frontend somewhere else.
    run web packages/frontend-next env VITE_API_URL="{{ api_url }}" VITE_AUTH_URL="$auth_url" bun run dev

    wait
