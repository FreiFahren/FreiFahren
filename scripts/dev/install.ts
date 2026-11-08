import { join } from 'node:path'

import { AUTH_WORKER, exists, FUND, REPORT_GATE, ROOT, run, show } from './paths'

export async function install() {
    // One workspace holds every package here, so one install from bun.lock covers them all.
    console.log(`→ ${show(ROOT)}`)
    await run(ROOT, ['bun', 'install', '--frozen-lockfile'])

    // The private services install from their own repository's workspace.
    for (const dir of [AUTH_WORKER, REPORT_GATE, FUND]) {
        if (!exists(join(dir, 'package.json'))) continue
        console.log(`→ ${show(dir)}`)
        await run(dir, ['bun', 'install', '--frozen-lockfile'])
    }
}

if (import.meta.main) await install()
