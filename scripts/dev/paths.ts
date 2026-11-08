import { existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

export const ROOT = resolve(import.meta.dir, '../..')

export const API = join(ROOT, 'packages/api-worker')
export const TELEGRAM = join(ROOT, 'packages/telegram-worker')
export const FRONTEND = join(ROOT, 'packages/frontend-next')

export const WORKERS = [API, TELEGRAM]

export const exists = (path: string) => existsSync(path)

export const show = (path: string) => relative(process.cwd(), path) || '.'

export async function run(cwd: string, command: string[]) {
    const exitCode = await Bun.spawn(command, { cwd, stdio: ['inherit', 'inherit', 'inherit'] }).exited
    if (exitCode !== 0) throw new Error(`\`${command.join(' ')}\` failed in ${show(cwd)}`)
}
