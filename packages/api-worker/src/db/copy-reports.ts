import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { getCityDatabase } from '@freifahren/cities'
import { getTableName } from 'drizzle-orm'

import { logger } from '../common/logger'

import { parseCityDatabasesArg, parseConfigArg } from './cli-args'
import { reports } from './schema/reports'
import { toSqlLiteral } from './sql-literal'

//   Usage:  bun run db:copy-reports --config wrangler.preview.json [--city berlin] [--days 30]
//
// Reads from the database wrangler's default config binds (production) and writes to the same binding
// In --config, which is why that flag is required.
//
// Columns and foreign keys are read from each database's own schema, so a migration needs no edit
// Here. Drizzle's column objects can't supply them: under `casing: 'snake_case'` the database name is
// Applied at query time, so `getTableColumns(reports).stationId.name` is "stationId".

// The widest window any endpoint reads (insights).
const DEFAULT_WINDOW_DAYS = 30

// Every row is held in memory and loaded as one SQL file, so an unusually busy window is capped rather
// Than turned into a statement list large enough to fail the load.
const MAX_REPORTS = 50_000

const TABLE = getTableName(reports)

// The only column named here rather than discovered, because the time window is what it means to copy
// "recent" reports. Asserted against the live schema so a rename fails loudly instead of silently.
const TIME_WINDOW_COLUMN = 'timestamp'

type D1Row = Record<string, unknown>
type ForeignKey = { table: string; from: string; to: string }

const quote = (identifier: string) => `"${identifier}"`

const parseDaysArg = (argv: string[] = process.argv): number => {
    const flag = argv.indexOf('--days')
    if (flag === -1) return DEFAULT_WINDOW_DAYS

    const days = Number(argv[flag + 1])
    if (!Number.isInteger(days) || days <= 0) {
        throw new Error('--days requires a positive integer, e.g. --days 30')
    }
    return days
}

const isUnprovisionedDatabaseError = (error: unknown): boolean => {
    const stdout = error !== null && typeof error === 'object' && 'stdout' in error ? String(error.stdout) : ''
    const message = error instanceof Error ? error.message : String(error)
    return /Couldn't find a D1 DB named/i.test(`${stdout}\n${message}`)
}

const query = (binding: string, sql: string, configPath?: string): D1Row[] => {
    const configArgs = configPath !== undefined ? ['--config', configPath] : []
    const stdout = execFileSync(
        'npx',
        ['wrangler', 'd1', 'execute', binding, '--remote', '--json', '--command', sql, ...configArgs],
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 512 * 1024 * 1024 }
    )
    // Parsed from the first bracket: wrangler may print a banner line ahead of the JSON.
    const resultSets = JSON.parse(stdout.slice(stdout.indexOf('['))) as Array<{ results?: D1Row[] } | undefined>
    return resultSets[0]?.results ?? []
}

const columnsOf = (binding: string, configPath?: string): string[] =>
    query(binding, `SELECT name FROM pragma_table_info('${TABLE}')`, configPath).map((row) => String(row.name))

const foreignKeysOf = (binding: string, configPath?: string): ForeignKey[] =>
    query(binding, `SELECT * FROM pragma_foreign_key_list('${TABLE}')`, configPath).map((row) => ({
        table: String(row.table),
        from: String(row.from),
        to: String(row.to),
    }))

// Keyed by `<table>.<column>` so two columns referencing the same parent are only fetched once.
const resolvableValues = (binding: string, foreignKeys: ForeignKey[], configPath: string): Map<string, Set<string>> => {
    const byParent = new Map<string, Set<string>>()
    for (const { table, to } of foreignKeys) {
        const key = `${table}.${to}`
        if (byParent.has(key)) continue
        const rows = query(binding, `SELECT ${quote(to)} FROM ${quote(table)}`, configPath)
        byParent.set(key, new Set(rows.map((row) => String(row[to]))))
    }
    return byParent
}

const copyCity = (city: string, configPath: string, days: number): void => {
    const { dbBinding } = getCityDatabase(city)!

    // Intersected so a migration in flight — the target ahead of production — copies what both sides
    // Have instead of failing on a column only one of them knows about.
    const targetColumns = columnsOf(dbBinding, configPath)
    let sourceColumns: string[]
    try {
        sourceColumns = columnsOf(dbBinding)
    } catch (error) {
        if (isUnprovisionedDatabaseError(error)) {
            logger.info({ city, binding: dbBinding }, 'Skipping report copy — production database is not provisioned')
            return
        }
        throw error
    }
    if (sourceColumns.length === 0) {
        logger.info({ city, binding: dbBinding }, 'Skipping report copy — production database has no reports table yet')
        return
    }
    const columns = sourceColumns.filter((column) => targetColumns.includes(column))
    if (!columns.includes(TIME_WINDOW_COLUMN)) {
        throw new Error(
            `${TABLE} has no ${TIME_WINDOW_COLUMN} column in both databases — update TIME_WINDOW_COLUMN to the column the window should filter on`
        )
    }

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const sourceRows = query(
        dbBinding,
        `SELECT ${columns.map(quote).join(', ')} FROM ${quote(TABLE)}
         WHERE ${quote(TIME_WINDOW_COLUMN)} >= ${cutoff} ORDER BY rowid DESC LIMIT ${MAX_REPORTS}`
    )
    if (sourceRows.length === MAX_REPORTS) {
        logger.warn(
            { city, cap: MAX_REPORTS, days },
            'Report cap reached — older reports in the window were not copied'
        )
    }

    // Read from the target because its constraints are the ones that would reject the load, and OR
    // IGNORE aborts on a foreign-key violation rather than skipping the offending row.
    const foreignKeys = foreignKeysOf(dbBinding, configPath)
    const resolvable = resolvableValues(dbBinding, foreignKeys, configPath)
    const rows = sourceRows.filter((row) =>
        foreignKeys.every(({ table, from, to }) => {
            const value = row[from]
            return (
                value === null || value === undefined || resolvable.get(`${table}.${to}`)?.has(String(value)) === true
            )
        })
    )

    const skipped = sourceRows.length - rows.length
    if (skipped > 0) {
        logger.warn({ city, skipped }, 'Skipped reports referencing rows absent from the target database')
    }
    if (rows.length === 0) {
        logger.info({ city, days }, 'No reports to copy')
        return
    }

    // Copying the source primary key keeps re-runs idempotent, and leaves AUTOINCREMENT past those ids
    // So reports created in the target afterwards cannot collide.
    const columnList = columns.map(quote).join(', ')
    const sql = rows
        .map((row) => {
            const values = columns.map((column) => toSqlLiteral(row[column])).join(', ')
            return `INSERT OR IGNORE INTO ${quote(TABLE)} (${columnList}) VALUES (${values});`
        })
        .join('\n')

    const sqlPath = join(tmpdir(), `freifahren-reports-${city}.sql`)
    writeFileSync(sqlPath, `${sql}\n`)

    logger.info({ city, binding: dbBinding, reports: rows.length, columns, days }, 'Copying production reports...')
    execFileSync(
        'npx',
        ['wrangler', 'd1', 'execute', dbBinding, '--remote', `--file=${sqlPath}`, '--config', configPath],
        { stdio: 'inherit' }
    )
}

const copyReports = () => {
    const configPath = parseConfigArg()
    if (configPath === undefined) {
        throw new Error(
            '--config <path> is required: it names the target databases, and omitting it would copy production onto itself'
        )
    }

    const days = parseDaysArg()
    for (const city of parseCityDatabasesArg()) {
        copyCity(city, configPath, days)
    }
}

try {
    copyReports()
    process.exit(0)
} catch (error) {
    logger.error(error, 'Report copy failed')
    process.exit(1)
}
