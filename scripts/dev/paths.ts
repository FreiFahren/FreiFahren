import { existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

export const ROOT = resolve(import.meta.dir, '../..')

// The private FreiFahren/internal checkout, next to this one by default. Skipped when missing.
const INTERNAL = resolve(ROOT, process.env.FREIFAHREN_INTERNAL ?? '../internal')

export const API = join(ROOT, 'packages/api-worker')
export const TELEGRAM = join(ROOT, 'packages/telegram-worker')
export const FRONTEND = join(ROOT, 'packages/frontend-next')
export const AUTH_WORKER = join(INTERNAL, 'packages/auth-worker')
export const REPORT_GATE = join(INTERNAL, 'packages/report-gate')
export const FUND = join(INTERNAL, 'packages/fund')

export const WORKERS = [API, TELEGRAM, REPORT_GATE, AUTH_WORKER, FUND]

export const exists = (path: string) => existsSync(path)

export const show = (path: string) => relative(ROOT, path) || '.'

export async function run(cwd: string, command: string[]) {
    const exitCode = await Bun.spawn(command, { cwd, stdio: ['inherit', 'inherit', 'inherit'] }).exited
    if (exitCode !== 0) throw new Error(`\`${command.join(' ')}\` failed in ${show(cwd)}`)
}
