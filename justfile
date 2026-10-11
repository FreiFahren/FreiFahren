# Local development. `just setup` once, then `just dev`. Each recipe is a script in scripts/dev/.

[private]
default:
    @just --list

# Install dependencies, create missing local env files, and prepare the local databases
setup:
    bun scripts/dev/setup.ts

# Install dependencies in every package that has its own lockfile
install:
    bun scripts/dev/install.ts

# Create local env files that don't exist yet; existing ones are left alone
env:
    bun scripts/dev/env.ts

# Seed the local API database for one city, or for every city in the registry
seed city="":
    bun scripts/dev/seed.ts {{ city }}

# Run the auth-worker, the API (with report-gate and telegram-worker) and the frontend together
dev:
    bun scripts/dev/start.ts
