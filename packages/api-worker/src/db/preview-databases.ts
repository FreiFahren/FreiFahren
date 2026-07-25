import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CITY_DATABASES } from '@freifahren/cities'

import { logger } from '../common/logger'

//   Provision:  bun run preview:databases --pr 123 --out wrangler.preview.json
//   Destroy:    bun run preview:databases --pr 123 --destroy
//
// The config is generated rather than committed because `database_id` cannot be set from the wrangler
// CLI, and a per-PR database's id only exists once the database does.

const PACKAGE_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')

// Must match wrangler.jsonc so a preview runs the production runtime.
const COMPATIBILITY_DATE = '2025-10-11'
const COMPATIBILITY_FLAGS = ['nodejs_compat']

// Scopes preview CORS to our own account (see PREVIEW_WORKERS_SUBDOMAIN in src/app-env.ts).
const WORKERS_SUBDOMAIN = 'freifahren'

type D1ListEntry = { uuid: string; name: string }

const parseFlag = (name: string, argv: string[] = process.argv): string | undefined => {
    const flag = argv.indexOf(`--${name}`)
    if (flag === -1) return undefined

    const value = argv[flag + 1]
    if (!value) {
        throw new Error(`--${name} requires a value`)
    }
    return value
}

const previewSuffix = (pr: string) => `-pr-${pr}`

const previewDatabaseName = (dbName: string, pr: string) => `${dbName}${previewSuffix(pr)}`

const assertCompatibilityDateMatchesProduction = () => {
    const production = readFileSync(resolve(PACKAGE_ROOT, 'wrangler.jsonc'), 'utf-8')
    if (!production.includes(`"compatibility_date": "${COMPATIBILITY_DATE}"`)) {
        throw new Error(
            `COMPATIBILITY_DATE (${COMPATIBILITY_DATE}) no longer matches wrangler.jsonc — update it so previews keep running the production runtime`
        )
    }
}

const listDatabases = (): D1ListEntry[] => {
    const stdout = execFileSync('npx', ['wrangler', 'd1', 'list', '--json'], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'inherit'],
        maxBuffer: 32 * 1024 * 1024,
    })
    // Parsed from the first bracket: wrangler may print a banner line ahead of the JSON.
    return JSON.parse(stdout.slice(stdout.indexOf('['))) as D1ListEntry[]
}

// Matched by PR suffix rather than derived from the registry, so a database created under a name that
// A later revision renamed or removed is still torn down. Listing first also keeps this idempotent
// Without parsing wrangler's error output. Returns the ids removed.
const destroy = (pr: string): Set<string> => {
    const deleted = new Set<string>()
    for (const { name, uuid } of listDatabases().filter(({ name }) => name.endsWith(previewSuffix(pr)))) {
        logger.info({ database: name }, 'Deleting preview database...')
        execFileSync('npx', ['wrangler', 'd1', 'delete', name, '--skip-confirmation'], { stdio: 'inherit' })
        deleted.add(uuid)
    }
    if (deleted.size === 0) {
        logger.info({ pr }, 'No preview databases to delete')
    }
    return deleted
}

const provision = (pr: string, out: string) => {
    assertCompatibilityDateMatchesProduction()

    // Every run rebuilds from empty. Reusing a database would show something other than the revision
    // Under review: wrangler's ledger records applied migration *filenames*, so a migration edited
    // During review is never reapplied, and the seed's additive load keeps the previous revision's
    // Reference rows.
    const deleted = destroy(pr)

    const wanted = Object.values(CITY_DATABASES).map(({ dbName, dbBinding }) => ({
        binding: dbBinding,
        name: previewDatabaseName(dbName, pr),
    }))
    for (const { name } of wanted) {
        logger.info({ database: name }, 'Creating preview database...')
        execFileSync('npx', ['wrangler', 'd1', 'create', name], { stdio: 'inherit' })
    }

    const existing = listDatabases()
    const d1Databases = wanted.map(({ binding, name }) => {
        const database = existing.find((candidate) => candidate.name === name)
        if (!database) {
            throw new Error(`Preview database ${name} is missing after creation`)
        }
        // A list that hasn't caught up with the delete above would resolve the name to the database
        // Just removed, which the Worker would bind and then fail every query against.
        if (deleted.has(database.uuid)) {
            throw new Error(`Preview database ${name} still resolves to deleted database ${database.uuid}`)
        }
        return { binding, database_name: name, database_id: database.uuid, migrations_dir: 'drizzle' }
    })

    const config = {
        $schema: 'node_modules/wrangler/config-schema.json',
        name: `api-pr-${pr}`,
        main: 'src/worker.ts',
        compatibility_date: COMPATIBILITY_DATE,
        compatibility_flags: COMPATIBILITY_FLAGS,
        cache: { enabled: true },
        // No `routes`, so a preview can never take traffic on the production hostname.
        workers_dev: true,
        d1_databases: d1Databases,
        vars: {
            // Production so a preview exercises the real code paths. TELEGRAM_WORKER_URL is absent
            // Until a preview Telegram worker exists: the forward is fire-and-forget behind a catch,
            // And with no URL a preview cannot reach the production bot.
            NODE_ENV: 'production',
            CORS_ORIGINS: `https://frontend-pr-${pr}.${WORKERS_SUBDOMAIN}.workers.dev`,
            PREVIEW_WORKERS_SUBDOMAIN: WORKERS_SUBDOMAIN,
            // No SENTRY_DSN: previews would otherwise report into the production issue stream.
        },
    }

    writeFileSync(resolve(PACKAGE_ROOT, out), `${JSON.stringify(config, null, 2)}\n`)
    logger.info({ out, databases: d1Databases.map(({ database_name }) => database_name) }, 'Preview config written')
}

const run = () => {
    const pr = parseFlag('pr')
    if (pr === undefined || !/^\d+$/.test(pr)) {
        throw new Error('--pr <number> is required')
    }

    if (process.argv.includes('--destroy')) {
        destroy(pr)
        return
    }

    const out = parseFlag('out')
    if (out === undefined) {
        throw new Error('--out <path> is required when provisioning')
    }
    provision(pr, out)
}

try {
    run()
    process.exit(0)
} catch (error) {
    logger.error(error, 'Preview database command failed')
    process.exit(1)
}
