// Merge fetched bus OSM elements into the bundled Berlin snapshots, producing a
// "berlin + Metro buses" snapshot dir for the A/B benchmark. Elements are
// deduped by (type, id) — bus stop_areas can overlap rail stop_areas.
//
//   node benchmarks/merge-snapshots.mjs <busDataDir> <outDir>
//
// Expects <busDataDir>/bus_stations.json and <busDataDir>/bus_route_geometries.json
// (raw Overpass element arrays, e.g. from the fetch step in benchmarks/README.md).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [busDir, outDir] = process.argv.slice(2)
if (!busDir || !outDir) {
    console.error('usage: node benchmarks/merge-snapshots.mjs <busDataDir> <outDir>')
    process.exit(1)
}

const baseDir = new URL('../src/db/seed/snapshots/berlin/', import.meta.url).pathname

const merge = (baseFile, busFile, outFile) => {
    const base = JSON.parse(readFileSync(join(baseDir, baseFile), 'utf-8'))
    const bus = JSON.parse(readFileSync(join(busDir, busFile), 'utf-8'))
    const seen = new Set(base.map((el) => `${el.type}/${el.id}`))
    const added = bus.filter((el) => !seen.has(`${el.type}/${el.id}`))
    const merged = [...base, ...added]
    writeFileSync(join(outDir, outFile), JSON.stringify(merged))
    console.log(`${outFile}: ${base.length} base + ${added.length} bus (of ${bus.length}) = ${merged.length}`)
}

mkdirSync(outDir, { recursive: true })
merge('stations.json', 'bus_stations.json', 'stations.json')
merge('route_geometries.json', 'bus_route_geometries.json', 'route_geometries.json')
