// Seed a local D1 state dir from an arbitrary snapshot directory, so two data
// variants (baseline vs +buses) can be served side by side with
// `wrangler dev --persist-to <dir>`. Runs the exact same seedBaseData pipeline
// as `bun run seed`, only with the snapshot source and persist path overridden.
//
//   npx tsx benchmarks/seed-variant.ts <snapshotDir> <persistDir>
//
// <snapshotDir> may be "berlin" to use the bundled baseline snapshots.
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'

import type { D1Database } from '@cloudflare/workers-types'
import { getPlatformProxy } from 'wrangler'

process.env.SEED_CITY = 'berlin'

const main = async () => {
    const [snapshotArg, persistArg] = process.argv.slice(2)
    if (!snapshotArg || !persistArg) {
        console.error('usage: npx tsx benchmarks/seed-variant.ts <snapshotDir|berlin> <persistDir>')
        process.exit(1)
    }
    const persistDir = resolve(persistArg)

    const { seedBaseData, setSnapshotLoader } = await import('../src/db/seed/seed')
    const { createD1Db } = await import('../src/db')

    if (snapshotArg === 'berlin') {
        const { fsSnapshotLoader } = await import('../src/db/seed/snapshots')
        setSnapshotLoader(fsSnapshotLoader)
    } else {
        const snapshotDir = isAbsolute(snapshotArg) ? snapshotArg : resolve(snapshotArg)
        setSnapshotLoader(async <T,>(kind: string): Promise<T> => {
            return JSON.parse(await readFile(`${snapshotDir}/${kind}.json`, 'utf-8')) as T
        })
    }

    execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persistDir], {
        stdio: 'inherit',
    })

    // The wrangler CLI nests its state under <dir>/v3, getPlatformProxy does not —
    // point the proxy at <dir>/v3 so both address the same D1 database.
    const { env, dispose } = await getPlatformProxy<Record<string, D1Database>>({
        persist: { path: `${persistDir}/v3` },
    })
    try {
        const started = Date.now()
        await seedBaseData(createD1Db(env.DB))
        console.log(`[seed-variant] seeded ${persistDir} in ${((Date.now() - started) / 1000).toFixed(1)}s`)
    } finally {
        await dispose()
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
