import { ROOT, run } from './paths'

// One workspace holds every package, so one install from bun.lock covers them all.
export async function install() {
    await run(ROOT, ['bun', 'install', '--frozen-lockfile'])
}

if (import.meta.main) await install()
