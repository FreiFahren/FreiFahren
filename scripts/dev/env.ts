import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { exists, FRONTEND, show, WORKERS } from './paths'

const LOCAL_ONLY = 'SENTRY_DSN=\nNODE_ENV=development\n'

/*
 * Worker configs carry production vars (Sentry DSNs, NODE_ENV=production) that `wrangler dev` only
 * overrides from .dev.vars. Without one, local errors reach production Sentry, so new files always
 * blank the DSN.
 */
export function env() {
    for (const dir of WORKERS) {
        const devVars = join(dir, '.dev.vars')
        if (!exists(dir) || exists(devVars)) continue

        writeFileSync(devVars, exampleWithout(join(dir, '.dev.vars.example'), ['SENTRY_DSN', 'NODE_ENV']) + LOCAL_ONLY)
        console.log(`created ${show(devVars)}`)
    }

    const dotenv = join(FRONTEND, '.env')
    if (!exists(dotenv)) {
        copyFileSync(join(FRONTEND, '.env.example'), dotenv)
        console.log(`created ${show(dotenv)}`)
    }
}

export function warnAboutSentry() {
    for (const dir of WORKERS) {
        const devVars = join(dir, '.dev.vars')
        if (exists(devVars) && /^SENTRY_DSN=.+/m.test(readFileSync(devVars, 'utf8'))) {
            console.warn(`${show(devVars)} sets SENTRY_DSN, so local errors from it reach Sentry`)
        }
    }
}

function exampleWithout(example: string, keys: string[]) {
    if (!exists(example)) return ''
    const lines = readFileSync(example, 'utf8')
        .split('\n')
        .filter((line) => !keys.some((key) => line.startsWith(`${key}=`)))
    const kept = lines.join('\n').trimEnd()
    return kept === '' ? '' : `${kept}\n`
}

if (import.meta.main) env()
