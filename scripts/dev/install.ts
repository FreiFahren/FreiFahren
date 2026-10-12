import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { AUTH_WORKER, exists, REPORT_GATE, ROOT, run, show } from './paths'

export async function install() {
    const publicPackages = readdirSync(join(ROOT, 'packages')).map((name) => join(ROOT, 'packages', name))

    for (const dir of [...publicPackages, AUTH_WORKER, REPORT_GATE]) {
        if (!exists(join(dir, 'bun.lock'))) continue
        console.log(`→ ${show(dir)}`)
        await run(dir, ['bun', 'install', '--frozen-lockfile'])
    }
}

if (import.meta.main) await install()
