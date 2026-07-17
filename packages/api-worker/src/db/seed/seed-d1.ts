import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { D1Database } from '@cloudflare/workers-types'
import { getCity } from '@freifahren/cities'
import { getPlatformProxy } from 'wrangler'

import { createD1Db } from '../index'

import { parseCityArg } from './city-arg'

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

// Parents before children for FK order.
const REFERENCE_TABLES = ['stations', 'lines', 'line_stations', 'segments'] as const

const toSqlLiteral = (value: unknown): string => {
    if (value === null || value === undefined) return 'NULL'
    if (typeof value === 'number' || typeof value === 'bigint') return String(value)
    if (typeof value === 'boolean') return value ? '1' : '0'
    return `'${String(value).replace(/'/g, "''")}'`
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

// Dump the reference tables to additive INSERT OR IGNORE statements so a prod load leaves existing
// Rows (and the reports that reference them) intact.
const dumpReferenceTables = async (d1: D1Database): Promise<string> => {
    let sql = ''
    for (const table of REFERENCE_TABLES) {
        const { results } = await d1.prepare(`SELECT * FROM ${table}`).all<Record<string, unknown>>()
        for (const row of results) {
            const values = Object.values(row).map(toSqlLiteral).join(', ')
            sql += `INSERT OR IGNORE INTO ${table} VALUES (${values});\n`
        }
    }
    return sql
}

const seedD1 = async () => {
    const city = parseCityArg()
    const remote = process.argv.includes('--remote')
    const persistTo = parsePersistToArg()
    process.env.SEED_CITY = city

    const binding = getCity(city)!.dbBinding

    // Import after SEED_CITY is set: ./seed and ./snapshots read the registry-backed config at
    // Import time, and the fs loader resolves the city-namespaced snapshot path from it.
    const { seedBaseData, setSnapshotLoader } = await import('./seed')
    const { fsSnapshotLoader } = await import('./snapshots')
    const { logger } = await import('../../common/logger')
    setSnapshotLoader(fsSnapshotLoader)

    logger.info({ city, binding, target: remote ? 'remote' : 'local' }, 'Seeding D1...')

    // Build the reference tables on the local Miniflare D1 via the shared pipeline.
    const localPersistenceArgs = persistTo !== undefined ? ['--persist-to', persistTo] : []
    wrangler('d1', 'migrations', 'apply', binding, '--local', ...localPersistenceArgs)
    const { env, dispose } = await getPlatformProxy<Record<string, D1Database>>(
        persistTo !== undefined ? { persist: { path: join(persistTo, 'v3') } } : undefined
    )
    try {
        const d1 = env[binding]
        await seedBaseData(createD1Db(d1))

        if (remote) {
            // Remote D1 has no in-process binding here, so copy the freshly built reference tables
            // Over via wrangler (additive INSERT OR IGNORE).
            const sqlPath = join(tmpdir(), `freifahren-seed-${city}.sql`)
            writeFileSync(sqlPath, await dumpReferenceTables(d1))
            wrangler('d1', 'migrations', 'apply', binding, '--remote')
            wrangler('d1', 'execute', binding, '--remote', `--file=${sqlPath}`)
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
