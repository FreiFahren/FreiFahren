import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { getCity } from '@freifahren/cities'
import { $ } from 'bun'
import { migrate } from 'drizzle-orm/libsql/migrator'

import { logger } from '../../common/logger'
import { createNodeDbHandle } from '../node'

import { parseCityArg } from './city-arg'

// Seeds a city's D1 database (local `wrangler dev` by default, or the remote/prod DB with
// `--remote`). The seed logic runs against a temporary libsql file first — it uses interactive
// Transactions and orphan-remap that D1's HTTP driver can't do — then the resulting read-only
// Reference tables are copied into D1 with INSERT OR IGNORE (additive and idempotent, so existing
// Rows and the reports that reference them stay intact).
//
//   Local:  bun run seed --city <slug>
//   Remote: bun run seed --city <slug> --remote   (explicit prod opt-in)

// Parents before children for FK order.
const REFERENCE_TABLES = ['stations', 'lines', 'line_stations', 'segments'] as const

const toSqlLiteral = (value: unknown): string => {
    if (value === null || value === undefined) return 'NULL'
    if (typeof value === 'number' || typeof value === 'bigint') return String(value)
    if (typeof value === 'boolean') return value ? '1' : '0'
    return `'${String(value).replace(/'/g, "''")}'`
}

const seedD1 = async () => {
    const city = parseCityArg()
    const remote = process.argv.includes('--remote')
    process.env.SEED_CITY = city

    const binding = getCity(city)!.dbBinding
    const target = remote ? '--remote' : '--local'

    // Import after SEED_CITY is set: ./seed reads the registry-backed SEED_CONFIG at import time.
    const { seedBaseData } = await import('./seed')

    const libsqlPath = join(tmpdir(), `freifahren-seed-${city}.db`)
    const sqlPath = join(tmpdir(), `freifahren-seed-${city}.sql`)

    logger.info({ city, binding, target: remote ? 'remote' : 'local' }, 'Seeding D1...')

    // 1. Build the reference tables in a throwaway libsql file (report-preserving seed).
    const { db, client } = createNodeDbHandle(`file:${libsqlPath}`)
    await client.execute('PRAGMA foreign_keys = ON')
    await migrate(db, { migrationsFolder: './drizzle' })
    await seedBaseData(db)

    // 2. Serialize the reference tables to INSERT OR IGNORE statements.
    let sql = ''
    for (const table of REFERENCE_TABLES) {
        const result = await client.execute(`SELECT * FROM ${table}`)
        for (const row of result.rows) {
            const values = result.columns.map((col) => toSqlLiteral(row[col])).join(', ')
            sql += `INSERT OR IGNORE INTO ${table} VALUES (${values});\n`
        }
    }
    await Bun.write(sqlPath, sql)

    // 3. Apply migrations (idempotent) and load the reference data into the target D1.
    await $`bunx wrangler d1 migrations apply ${binding} ${target}`
    await $`bunx wrangler d1 execute ${binding} ${target} --file=${sqlPath}`

    logger.info({ city, binding, target: remote ? 'remote' : 'local' }, 'D1 seed complete')
}

seedD1()
    .then(() => {
        process.exit(0)
    })
    .catch((error) => {
        logger.error(error, 'D1 seed failed')
        process.exit(1)
    })
