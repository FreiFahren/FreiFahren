import { execFileSync } from 'node:child_process'

export interface ApplyMigrationsOptions {
    /** The city's static Worker binding (e.g. `DB`, `DB_LEIPZIG`). */
    binding: string
    /** Apply to the remote (production) D1 rather than the local Miniflare D1. */
    remote: boolean
    /** Local-only: point wrangler at a specific `.wrangler/state` directory. Ignored when remote. */
    persistTo?: string
}

/**
 * Apply the shared `drizzle/` migrations to a single city's D1 binding, locally or remotely.
 * wrangler records applied migrations in each database's `d1_migrations` ledger, so re-running is
 * a no-op — safe to call from the seed pipeline, the deploy fan-out, and local dev alike.
 *
 * Invokes the locally-installed wrangler via npx so the package's own binary is used (matches the
 * seed CLI, which also runs under tsx/Node).
 */
export const applyMigrations = ({ binding, remote, persistTo }: ApplyMigrationsOptions): void => {
    const target = remote ? '--remote' : '--local'
    const persistenceArgs = !remote && persistTo !== undefined ? ['--persist-to', persistTo] : []
    execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', binding, target, ...persistenceArgs], {
        stdio: 'inherit',
    })
}
