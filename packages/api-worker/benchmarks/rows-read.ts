// Measure D1 rows_read (the unit Cloudflare bills) for each hot query path, by
// wrapping the local D1 binding and summing result.meta.rows_read while the real
// service code runs. Run against a persist dir produced by seed-variant.ts:
//
//   npx tsx benchmarks/rows-read.ts <persistDir>
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'
import { getPlatformProxy } from 'wrangler'

process.env.SEED_CITY = 'berlin'

type Counter = { rowsRead: number; rowsWritten: number; queries: number }

const instrumentStatement = (stmt: D1PreparedStatement, counter: Counter): D1PreparedStatement =>
    new Proxy(stmt, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver)
            if (prop === 'bind') {
                return (...params: unknown[]) =>
                    instrumentStatement((value as (...p: unknown[]) => D1PreparedStatement).apply(target, params), counter)
            }
            if (prop === 'all' || prop === 'run' || prop === 'raw' || prop === 'first') {
                return async (...args: unknown[]) => {
                    const result = await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args)
                    counter.queries += 1
                    const meta = (result as { meta?: { rows_read?: number; rows_written?: number } })?.meta
                    if (meta) {
                        counter.rowsRead += meta.rows_read ?? 0
                        counter.rowsWritten += meta.rows_written ?? 0
                    }
                    return result
                }
            }
            return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
        },
    })

const instrumentDb = (d1: D1Database, counter: Counter): D1Database =>
    new Proxy(d1, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver)
            if (prop === 'prepare') {
                return (sql: string) => instrumentStatement((value as (s: string) => D1PreparedStatement).call(target, sql), counter)
            }
            if (prop === 'batch') {
                return async (statements: D1PreparedStatement[]) => {
                    const results = await (value as (s: D1PreparedStatement[]) => Promise<unknown[]>).call(target, statements)
                    for (const result of results) {
                        counter.queries += 1
                        const meta = (result as { meta?: { rows_read?: number; rows_written?: number } })?.meta
                        if (meta) {
                            counter.rowsRead += meta.rows_read ?? 0
                            counter.rowsWritten += meta.rows_written ?? 0
                        }
                    }
                    return results
                }
            }
            return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
        },
    })

const main = async () => {
    const [persistDir] = process.argv.slice(2)
    if (!persistDir) {
        console.error('usage: npx tsx benchmarks/rows-read.ts <persistDir>')
        process.exit(1)
    }

    const { createD1Db } = await import('../src/db')
    const { TransitNetworkDataService } = await import('../src/modules/transit/transit-network-data-service')

    // Match the wrangler CLI's <dir>/v3 state layout (see seed-variant.ts).
    const { env, dispose } = await getPlatformProxy<Record<string, D1Database>>({
        persist: { path: `${persistDir.replace(/\/v3$/, '')}/v3` },
    })
    try {
        const counter: Counter = { rowsRead: 0, rowsWritten: 0, queries: 0 }
        const db = createD1Db(instrumentDb(env.DB, counter))
        const service = new TransitNetworkDataService(db)

        const measure = async (label: string, fn: () => Promise<unknown>) => {
            counter.rowsRead = 0
            counter.rowsWritten = 0
            counter.queries = 0
            const started = performance.now()
            await fn()
            const ms = performance.now() - started
            console.log(
                `${label.padEnd(28)} rows_read=${String(counter.rowsRead).padStart(8)}  queries=${counter.queries}  wall=${ms.toFixed(1)}ms`
            )
        }

        // Table sizes for context.
        for (const table of ['stations', 'lines', 'line_stations', 'segments']) {
            const res = await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).all<{ n: number }>()
            console.log(`table ${table.padEnd(15)} ${res.results[0].n} rows`)
        }

        // The three reference loads: on Workers these run only on an edge-cache
        // miss; under Node the cache is absent so this exercises the raw D1 cost.
        await measure('GET /transit/stations', () => service.getStations())
        await measure('GET /transit/lines', () => service.getLines())
        await measure('GET /transit/segments', () => service.getSegments())

        // /transit/distance is no-store: every request pays this full-graph load.
        const stations = await service.getStations()
        const ids = Object.keys(stations)
        const from = ids[0]
        const to = ids[ids.length - 1]
        await measure(`GET /transit/distance`, () => service.getDistance(from, to))
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
