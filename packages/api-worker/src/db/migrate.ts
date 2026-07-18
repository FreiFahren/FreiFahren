import { execFileSync } from 'node:child_process'

export interface ApplyMigrationsOptions {
    binding: string
    remote: boolean
    /** Local-only: point wrangler at a specific `.wrangler/state` directory. Ignored when remote. */
    persistTo?: string
}

// Idempotent via wrangler's d1_migrations ledger, so the seed and deploy fan-out can call it freely.
export const applyMigrations = ({ binding, remote, persistTo }: ApplyMigrationsOptions): void => {
    const target = remote ? '--remote' : '--local'
    const persistenceArgs = !remote && persistTo !== undefined ? ['--persist-to', persistTo] : []
    execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', binding, target, ...persistenceArgs], {
        stdio: 'inherit',
    })
}
