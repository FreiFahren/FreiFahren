import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'

import { getCityDatabase } from '@freifahren/cities'

import { parseCityDatabasesArg, parseConfigArg } from './cli-args'
import { toSqlLiteral } from './sql-literal'

type ExtractRow = {
    id: string
    timestampUtc: string
    skip: string | null
    stationId: string | null
    directionId: string | null
    lineId: string | null
    error: string | null
}

type D1Row = Record<string, unknown>

const CHUNK = 400

const parseFileArg = (argv: string[] = process.argv): string => {
    const flag = argv.indexOf('--file')
    if (flag === -1 || !argv[flag + 1]) {
        throw new Error('--file <path> is required (extract.<city>.jsonl)')
    }
    const path = argv[flag + 1]
    return isAbsolute(path) ? path : resolve(path)
}

const query = (binding: string, sql: string, configPath?: string): D1Row[] => {
    const configArgs = configPath !== undefined ? ['--config', configPath] : []
    const stdout = execFileSync(
        'npx',
        ['wrangler', 'd1', 'execute', binding, '--remote', '--json', '--command', sql, ...configArgs],
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 },
    )
    const resultSets = JSON.parse(stdout.slice(stdout.indexOf('['))) as Array<{ results?: D1Row[] } | undefined>
    return resultSets[0]?.results ?? []
}

const executeFile = (binding: string, sqlPath: string, configPath?: string): void => {
    const configArgs = configPath !== undefined ? ['--config', configPath] : []
    execFileSync('npx', ['wrangler', 'd1', 'execute', binding, '--remote', `--file=${sqlPath}`, '--yes', ...configArgs], {
        stdio: 'inherit',
    })
}

const loadJsonl = (path: string): ExtractRow[] => {
    const rows: ExtractRow[] = []
    for (const line of readFileSync(path, 'utf8').split('\n')) {
        if (!line.trim()) continue
        rows.push(JSON.parse(line) as ExtractRow)
    }
    return rows
}

const importCity = (city: string, filePath: string, wipe: boolean, dryRun: boolean, configPath?: string): void => {
    const { dbBinding } = getCityDatabase(city)!
    const extracted = loadJsonl(filePath)
    const byId = new Map<string, ExtractRow>()
    for (const row of extracted) {
        byId.set(row.id, row)
    }
    const stations = new Set(query(dbBinding, 'SELECT id FROM stations', configPath).map((row) => String(row.id)))
    const lines = new Set(query(dbBinding, 'SELECT id FROM lines', configPath).map((row) => String(row.id)))

    let skipped = 0
    const inserts: string[] = []
    for (const row of byId.values()) {
        if (row.skip !== null || row.error !== null || row.stationId === null) {
            skipped += 1
            continue
        }
        if (!stations.has(row.stationId)) {
            skipped += 1
            continue
        }
        if (row.lineId !== null && !lines.has(row.lineId)) {
            skipped += 1
            continue
        }
        if (row.directionId !== null && !stations.has(row.directionId)) {
            skipped += 1
            continue
        }
        const ts = Date.parse(row.timestampUtc)
        if (!Number.isFinite(ts)) {
            skipped += 1
            continue
        }
        inserts.push(
            `INSERT INTO reports (station_id, line_id, direction_id, timestamp, source) VALUES (${[
                toSqlLiteral(row.stationId),
                toSqlLiteral(row.lineId),
                toSqlLiteral(row.directionId),
                toSqlLiteral(ts),
                toSqlLiteral('telegram'),
            ].join(', ')});`,
        )
    }

    console.log(
        JSON.stringify(
            {
                city,
                binding: dbBinding,
                extracted: extracted.length,
                insert: inserts.length,
                skipped,
                wipe,
                dryRun,
            },
            null,
            2,
        ),
    )

    if (dryRun) {
        console.log('dry-run — no writes')
        return
    }

    if (wipe) {
        const wipePath = join(tmpdir(), `freifahren-wipe-reports-${city}.sql`)
        writeFileSync(wipePath, 'DELETE FROM reports;\n')
        executeFile(dbBinding, wipePath, configPath)
    }

    for (let i = 0; i < inserts.length; i += CHUNK) {
        const chunk = inserts.slice(i, i + CHUNK)
        const sqlPath = join(tmpdir(), `freifahren-import-reports-${city}-${i}.sql`)
        writeFileSync(sqlPath, `${chunk.join('\n')}\n`)
        executeFile(dbBinding, sqlPath, configPath)
        console.log(`inserted ${Math.min(i + CHUNK, inserts.length)}/${inserts.length}`)
    }
}

const cities = parseCityDatabasesArg()
if (cities.length !== 1) {
    throw new Error('--city <slug> is required (one city)')
}
const city = cities[0]
if (city !== 'leipzig') {
    throw new Error('telegram extract import is Leipzig-only')
}

importCity(
    city,
    parseFileArg(),
    process.argv.includes('--wipe-reports'),
    process.argv.includes('--dry-run'),
    parseConfigArg(),
)
