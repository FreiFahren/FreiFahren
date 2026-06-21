// Generates the PMTiles archive + MapLibre style for each city in cities.json, into dist/.
// Single source of truth for both local dev and the deploy workflow.
//
//   bun scripts/generate.ts
//
// Env:
//   CITY              limit to one city (by name); default: all cities in cities.json
//   TILES_BASE_URL    style host; default http://localhost:3000 (the deploy sets the R2 domain)
//   TILES_VERSION     immutable path segment, i.e. the git sha (deploy only); default none (flat path)
import { mkdir } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

import { rewritePmtilesStyle, type Style } from '../styles/rewrite-style'

type City = { name: string; osmUrl: string }

const PKG = resolve(import.meta.dir, '..') // packages/tile-server
const REPO = resolve(PKG, '../..') // repo root — mounted into the tilemaker container
const DIST = resolve(PKG, 'dist')
const SOURCE = resolve(PKG, 'source')
const STYLE_SRC = resolve(SOURCE, 'freifahren-style.json')

const baseUrl = process.env.TILES_BASE_URL ?? 'http://localhost:3000'
const version = process.env.TILES_VERSION ?? ''
const only = process.env.CITY

// Map a host path to its location inside the container's /work mount.
const inContainer = (p: string) => p.replace(`${REPO}/`, '/work/')

const { cities } = (await Bun.file(resolve(PKG, 'cities.json')).json()) as { cities: City[] }
const selected = only ? cities.filter((c) => c.name === only) : cities
if (selected.length === 0) {
  console.error(`No cities${only ? ` matching "${only}"` : ''} in cities.json`)
  process.exit(1)
}

await mkdir(resolve(DIST, 'styles'), { recursive: true })
await mkdir(SOURCE, { recursive: true })

for (const city of selected) {
  // 1. OSM extract — download once if not already present locally.
  const pbf = resolve(SOURCE, basename(new URL(city.osmUrl).pathname))
  if (!(await Bun.file(pbf).exists())) {
    console.log(`↓ ${city.name}: ${city.osmUrl}`)
    const res = await fetch(city.osmUrl)
    if (!res.ok) throw new Error(`OSM download failed (${res.status}) for ${city.name}`)
    await Bun.write(pbf, res)
  }

  // 2. Vector tiles via tilemaker (in Docker — paths resolved inside the /work mount).
  console.log(`▦ ${city.name}: tilemaker`)
  const proc = Bun.spawn(
    [
      'docker',
      'run',
      '--rm',
      '-v',
      `${REPO}:/work`,
      '-w',
      '/work',
      'ghcr.io/systemed/tilemaker:master',
      inContainer(pbf),
      '--output',
      inContainer(resolve(DIST, `${city.name}.pmtiles`)),
      '--config',
      inContainer(resolve(PKG, 'tilemaker/config-freifahren.json')),
      '--process',
      inContainer(resolve(PKG, 'tilemaker/process-freifahren.lua')),
    ],
    { stdout: 'inherit', stderr: 'inherit' },
  )
  if ((await proc.exited) !== 0) throw new Error(`tilemaker failed for ${city.name}`)

  // 3. Style pointing at this city's archive. Parse fresh per city so mutation can't leak across them.
  const style = (await Bun.file(STYLE_SRC).json()) as Style
  const rewritten = rewritePmtilesStyle(style, { city: city.name, baseUrl, version })
  await Bun.write(resolve(DIST, 'styles', `${city.name}.json`), `${JSON.stringify(rewritten, null, 2)}\n`)

  console.log(`✓ ${city.name}: dist/${city.name}.pmtiles + dist/styles/${city.name}.json`)
}
