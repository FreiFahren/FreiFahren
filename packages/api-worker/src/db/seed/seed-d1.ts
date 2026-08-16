import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { D1Database } from '@cloudflare/workers-types'
import { getCity } from '@freifahren/cities'
import { getPlatformProxy } from 'wrangler'

import { parseConfigArg } from '../cli-args'
import { createD1Db } from '../index'
import { applyMigrations } from '../migrate'

import { parseCityArg } from './city-arg'
import { REFERENCE_TABLE_NAMES, dumpReferenceTables } from './dump-reference-tables'

// Seeds a city's D1 database. The reference tables are built by running the shared seedBaseData
// Pipeline directly against a D1 binding (the local Miniflare D1, obtained via getPlatformProxy) —
// The exact same code path the Vitest suite seeds with, so tests and production build identical
// Data on the same engine. No libsql intermediate.
//
//   Local:  bun run seed --city <slug>            → seeds the local wrangler D1 in .wrangler/state
//   Remote: bun run seed --city <slug> --remote   → also copies the reference tables to prod D1
//
// Note: getPlatformProxy (and the whole Miniflare/workerd toolchain) only runs under Node, and the
// Seed imports the @freifahren/cities alias, so this entry runs under tsx rather than bun (see package.json).

// Tables holding user data rather than reference data, so the seed deliberately leaves them alone.
const NON_REFERENCE_TABLES = ['reports'] as const

// A new table is a decision — reference data to seed, or user data to leave alone — so an unlisted one
// Fails here instead of being silently left out of every seeded database.
const assertEveryTableIsAccountedFor = async (d1: D1Database): Promise<void> => {
    const { results } = await d1
        .prepare(
            `SELECT name FROM sqlite_master
             WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'`
        )
        .all<{ name: string }>()

    const accounted = new Set<string>([...REFERENCE_TABLE_NAMES, ...NON_REFERENCE_TABLES])
    const unaccounted = results.map(({ name }) => name).filter((name) => !accounted.has(name))
    if (unaccounted.length > 0) {
        throw new Error(
            `Tables missing from the seed: ${unaccounted.join(', ')} — add each to REFERENCE_TABLES (seeded, parents first) or NON_REFERENCE_TABLES (left alone)`
        )
    }
}

// Invoke the locally-installed wrangler CLI (via npx so the package's own binary is used).
const wrangler = (...args: string[]) => execFileSync('npx', ['wrangler', ...args], { stdio: 'inherit' })

const parsePersistToArg = (argv: string[] = process.argv): string | undefined => {
    const flag = argv.indexOf('--persist-to')
    if (flag === -1) return undefined

    const path = argv[flag + 1]
    if (!path) throw new Error('--persist-to requires a directory path')
    return path
}

const seedD1 = async () => {
    const city = parseCityArg()
    const remote = process.argv.includes('--remote')
    const persistTo = parsePersistToArg()
    const configPath = parseConfigArg()
    process.env.SEED_CITY = city

    const binding = getCity(city)!.dbBinding

    // Import after SEED_CITY is set: ./seed and ./snapshots read the registry-backed config at
    // Import time, and the fs loader resolves the city-namespaced snapshot path from it.
    const { seedBaseData, setSnapshotLoader } = await import('./seed')
    const { fsSnapshotLoader } = await import('./snapshots')
    const { logger } = await import('../../common/logger')
    setSnapshotLoader(fsSnapshotLoader)

    logger.info({ city, binding, target: remote ? 'remote' : 'local', configPath }, 'Seeding D1...')

    // Build the reference tables on the local Miniflare D1 via the shared pipeline.
    applyMigrations({ binding, remote: false, persistTo, configPath })
    const { env, dispose } = await getPlatformProxy<Record<string, D1Database>>({
        ...(configPath !== undefined ? { configPath } : {}),
        ...(persistTo !== undefined ? { persist: { path: join(persistTo, 'v3') } } : {}),
    })
    try {
        const d1 = env[binding]
        await assertEveryTableIsAccountedFor(d1)
        await seedBaseData(createD1Db(d1))

        if (remote) {
            // Remote D1 has no in-process binding here, so copy the freshly built reference tables
            // Over via wrangler (additive INSERT OR IGNORE).
            const sqlPath = join(tmpdir(), `freifahren-seed-${city}.sql`)
            writeFileSync(sqlPath, await dumpReferenceTables(d1))
            const configArgs = configPath !== undefined ? ['--config', configPath] : []
            applyMigrations({ binding, remote: true, configPath })
            wrangler('d1', 'execute', binding, '--remote', `--file=${sqlPath}`, ...configArgs)
        }
    } finally {
        await dispose()
    }

    logger.info({ city, binding, target: remote ? 'remote' : 'local' }, 'D1 seed complete')
}

seedD1()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => {
        console.error('D1 seed failed', error)
        process.exit(1)
    })
