// HTTP benchmark against a running `wrangler dev` instance: payload sizes
// (raw / gzip / brotli), latency percentiles per endpoint, and a distance
// (pathfinding) sample. Compares apples to apples when run against two ports.
//
//   node benchmarks/http-bench.mjs <baseUrl> [label]
import { brotliCompressSync, gzipSync } from 'node:zlib'

const base = process.argv[2]
const label = process.argv[3] ?? base
if (!base) {
    console.error('usage: node benchmarks/http-bench.mjs <baseUrl> [label]')
    process.exit(1)
}

const WARMUP = 3
const RUNS = 25

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]

const bench = async (path, runs = RUNS) => {
    const url = `${base}${path}`
    let body = ''
    for (let i = 0; i < WARMUP; i++) {
        const res = await fetch(url)
        body = await res.text()
        if (!res.ok) throw new Error(`${path} -> ${res.status}: ${body.slice(0, 200)}`)
    }
    const times = []
    for (let i = 0; i < runs; i++) {
        const started = performance.now()
        const res = await fetch(url)
        await res.arrayBuffer()
        times.push(performance.now() - started)
        if (!res.ok) throw new Error(`${path} -> ${res.status}`)
    }
    times.sort((a, b) => a - b)
    const raw = Buffer.byteLength(body)
    const gzip = gzipSync(body).length
    const brotli = brotliCompressSync(body).length
    return {
        path,
        raw,
        gzip,
        brotli,
        p50: percentile(times, 50),
        p95: percentile(times, 95),
        body,
    }
}

const kb = (n) => `${(n / 1024).toFixed(1)} KiB`

const main = async () => {
    console.log(`# ${label}`)
    const results = []
    for (const path of ['/v0/transit/stations', '/v0/transit/lines', '/v0/transit/segments', '/v0/risk']) {
        results.push(await bench(path))
    }

    // Distance: pick a stable far-apart pair from the stations payload.
    const stations = JSON.parse(results[0].body)
    const ids = Object.keys(stations).sort()
    const from = ids[0]
    const to = ids[ids.length - 1]
    results.push(await bench(`/v0/transit/distance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, 15))

    console.log(`${'endpoint'.padEnd(46)} ${'raw'.padStart(11)} ${'gzip'.padStart(10)} ${'brotli'.padStart(10)} ${'p50'.padStart(9)} ${'p95'.padStart(9)}`)
    for (const r of results) {
        console.log(
            `${r.path.slice(0, 46).padEnd(46)} ${kb(r.raw).padStart(11)} ${kb(r.gzip).padStart(10)} ${kb(r.brotli).padStart(10)} ${(r.p50.toFixed(1) + 'ms').padStart(9)} ${(r.p95.toFixed(1) + 'ms').padStart(9)}`
        )
    }

    // Machine-readable line for the report tooling.
    console.log(
        JSON.stringify({
            label,
            results: results.map(({ body, ...rest }) => rest),
        })
    )
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
