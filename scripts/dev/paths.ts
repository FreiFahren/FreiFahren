import { existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

export const ROOT = resolve(import.meta.dir, '../..')

// auth-worker and report-gate are private and live in FreiFahren/internal, cloned next to this
// repository (or wherever FREIFAHREN_INTERNAL points). Every command skips them when it's missing.
const INTERNAL = resolve(ROOT, process.env.FREIFAHREN_INTERNAL ?? '../internal')

export const API = join(ROOT, 'packages/api-worker')
export const TELEGRAM = join(ROOT, 'packages/telegram-worker')
export const FRONTEND = join(ROOT, 'packages/frontend-next')
export const AUTH_WORKER = join(INTERNAL, 'packages/auth-worker')
export const REPORT_GATE = join(INTERNAL, 'packages/report-gate')

// The packages that run under `wrangler dev`.
export const WORKERS = [API, TELEGRAM, REPORT_GATE, AUTH_WORKER]

export const exists = (path: string) => existsSync(path)

// Paths in messages, relative to the repository root.
export const show = (path: string) => relative(ROOT, path) || '.'

// Runs a command to completion in `cwd`, with the terminal attached.
export async function run(cwd: string, command: string[]) {
    const exitCode = await Bun.spawn(command, { cwd, stdio: ['inherit', 'inherit', 'inherit'] }).exited
    if (exitCode !== 0) throw new Error(`\`${command.join(' ')}\` failed in ${show(cwd)}`)
}
