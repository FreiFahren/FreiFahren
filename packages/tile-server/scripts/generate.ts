// Generates the PMTiles archive + MapLibre style for each buildable city, into dist/.
// Single source of truth for both local dev and the deploy workflow.
//
//   bun scripts/generate.ts
//
// Which cities get built is a projection of the shared @freifahren/cities registry:
// every city that has a `tiles` block. There is no hand-maintained city list.
//
// Env:
//   CITY              limit to one city (by slug); default: all buildable cities
//   TILES_BASE_URL    style host; default http://localhost:3000 (the deploy sets the R2 domain)
//   TILES_VERSION     immutable path segment, i.e. the git sha (deploy only); default none (flat path)
import { mkdir, rename, unlink } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

import { CITIES } from '@freifahren/cities'

import { rewritePmtilesStyle, type Style } from '../styles/rewrite-style'

const PKG = resolve(import.meta.dir, '..') // packages/tile-server
const REPO = resolve(PKG, '../..') // repo root — mounted into the tilemaker container
const DIST = resolve(PKG, 'dist')
const SOURCE = resolve(PKG, 'source')
const STYLE_SRC = resolve(SOURCE, 'freifahren-style.json')
const BASE_CONFIG = resolve(PKG, 'tilemaker/config-freifahren.json')
const OSMIUM_IMAGE = 'mschilde/osmium-tool@sha256:0495d0356b688e642b74b8cb64f140f7315e3bf2e4682701131b3bad30597285'

const baseUrl = process.env.TILES_BASE_URL ?? 'http://localhost:3000'
const version = process.env.TILES_VERSION ?? ''
const only = process.env.CITY

// Map a host path to its location inside the container's /work mount.
const inContainer = (p: string) => p.replace(`${REPO}/`, '/work/')

const cities = Object.values(CITIES)
const selected = only ? cities.filter((c) => c.slug === only) : cities
if (selected.length === 0) {
  console.error(`No cities${only ? ` matching "${only}"` : ''} in the @freifahren/cities registry`)
  process.exit(1)
}

await mkdir(resolve(DIST, 'styles'), { recursive: true })
await mkdir(SOURCE, { recursive: true })

// The committed tilemaker config carries only the city-agnostic layer/settings tuning.
// The per-city identity (name, description, schema, default_view) is injected below, so
// The base file holds no city specifics.
type TilemakerConfig = {
  settings: {
    name?: string
    description?: string
    default_view?: readonly [number, number, number]
    metadata: { schema?: string; [k: string]: unknown }
    [k: string]: unknown
  }
  [k: string]: unknown
}
const baseConfig = (await Bun.file(BASE_CONFIG).json()) as TilemakerConfig

for (const city of selected) {
  // 1. OSM extract — download once if not already present locally.
  const sourcePbf = resolve(SOURCE, basename(new URL(city.tiles.osmUrl).pathname))
  if (!(await Bun.file(sourcePbf).exists())) {
    const partialSourcePbf = `${sourcePbf}.part`
    await unlink(partialSourcePbf).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    })
    console.log(`↓ ${city.slug}: ${city.tiles.osmUrl}`)
    // A .part file is only renamed after curl succeeds, so an interrupted download cannot be
    // mistaken for a cached source extract on the next build.
    const dl = Bun.spawn(['curl', '-fSL', '--retry', '3', '--remove-on-error', '-o', partialSourcePbf, city.tiles.osmUrl], {
      stdout: 'inherit',
      stderr: 'inherit',
    })
    if ((await dl.exited) !== 0) throw new Error(`OSM download failed for ${city.slug}`)
    await rename(partialSourcePbf, sourcePbf)
  }

  const pbf = city.tiles.clipToMapBounds ? resolve(SOURCE, `${city.slug}.osm.pbf`) : sourcePbf
  if (city.tiles.clipToMapBounds) {
    console.log(`✂ ${city.slug}: crop to map bounds`)
    const crop = Bun.spawn(
      [
        'docker',
        'run',
        '--rm',
        '-v',
        `${REPO}:/work`,
        '-w',
        '/work',
        OSMIUM_IMAGE,
        'osmium',
        'extract',
        '--strategy=complete_ways',
        `--bbox=${city.map.bounds.join(',')}`,
        '--set-bounds',
        '--overwrite',
        '--output',
        inContainer(pbf),
        inContainer(sourcePbf),
      ],
      { stdout: 'inherit', stderr: 'inherit' },
    )
    if ((await crop.exited) !== 0) throw new Error(`OSM crop failed for ${city.slug}`)
  }

  // 2. Per-city tilemaker config: base tuning + this city's identity, written into dist/.
  const config = structuredClone(baseConfig)
  config.settings.name = `FreiFahren ${city.displayName} vector tiles`
  config.settings.description = `OSM-derived vector tiles for the FreiFahren ${city.displayName} basemap.`
  config.settings.default_view = [...city.map.center, city.map.zoom]
  config.settings.metadata.schema = `freifahren-${city.slug}`
  const configPath = resolve(DIST, `tilemaker-config.${city.slug}.json`)
  await Bun.write(configPath, `${JSON.stringify(config, null, 2)}\n`)

  // 3. Vector tiles via tilemaker (in Docker — paths resolved inside the /work mount).
  console.log(`▦ ${city.slug}: tilemaker`)
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
      inContainer(resolve(DIST, `${city.slug}.pmtiles`)),
      '--config',
      inContainer(configPath),
      '--process',
      inContainer(resolve(PKG, 'tilemaker/process-freifahren.lua')),
    ],
    { stdout: 'inherit', stderr: 'inherit' },
  )
  if ((await proc.exited) !== 0) throw new Error(`tilemaker failed for ${city.slug}`)

  // 4. Style pointing at this city's archive. Parse fresh per city so mutation can't leak across them.
  const style = (await Bun.file(STYLE_SRC).json()) as Style
  const rewritten = rewritePmtilesStyle(style, { city: city.slug, baseUrl, version })
  await Bun.write(resolve(DIST, 'styles', `${city.slug}.json`), `${JSON.stringify(rewritten, null, 2)}\n`)
  console.log(`✓ ${city.slug}: dist/${city.slug}.pmtiles + dist/styles/${city.slug}.json`)
}
