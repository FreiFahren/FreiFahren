import fs from 'node:fs/promises'
import path from 'node:path'

// Two output modes:
//   default  — Martin/xyz: vector `tiles[]` template + `?v=<token>` cache-bust + Martin glyph endpoint.
//   --pmtiles — static PMTiles on R2: single `pmtiles://` vector source, versioned path (no query
//               token), and a static `{fontstack}/{range}.pbf` glyph path.
// The default is what the prod Dockerfile/Martin image still bakes; --pmtiles is the R2 migration path.
const argv = process.argv.slice(2)
const pmtiles = argv.includes('--pmtiles')
const [inputPath, outputPath, baseUrl = 'http://localhost:3000', version = ''] = argv.filter(
    (arg) => arg !== '--pmtiles',
)

if (!inputPath || !outputPath) {
    console.error('Usage: node rewrite-style.mjs [--pmtiles] <input-style.json> <output-style.json> [base-url] [version]')
    process.exit(1)
}

const style = JSON.parse(await fs.readFile(inputPath, 'utf8'))
const sourceName = 'freifahren'

const inputSourceName = Object.keys(style.sources ?? {}).find((name) => style.sources[name]?.type === 'vector')

if (!inputSourceName) {
    throw new Error('Expected a vector source in the style JSON')
}

delete style.sprite

const attribution =
    "<a href='https://www.openstreetmap.org/copyright' target='_blank'>&copy; OpenStreetMap contributors</a>"

if (pmtiles) {
    // The browser reads the PMTiles archive directly over HTTP range requests via the `pmtiles://`
    // protocol (registered in the frontend). The version segment is the cache-bust: a new deploy
    // writes an immutable `/v<sha>/berlin.pmtiles`, so the URL changes and no edge purge is needed.
    const archivePath = version ? `/v${version}/berlin.pmtiles` : '/berlin.pmtiles'

    style.sources[sourceName] = {
        type: 'vector',
        url: `pmtiles://${baseUrl}${archivePath}`,
        attribution,
    }

    // Static glyph PBF tree on R2 (immutable). MapLibre only fetches these when a layer uses
    // `text-field`; the current basemap has none, but keep the URL so labels work when added.
    style.glyphs = `${baseUrl}/fonts/{fontstack}/{range}.pbf`
} else {
    // `?v=<version>` invalidates Cloudflare's 1-year edge cache on each deploy.
    const withCacheBust = (url) => (version ? `${url}?v=${version}` : url)

    style.sources[sourceName] = {
        type: 'vector',
        tiles: [withCacheBust(`${baseUrl}/${sourceName}/{z}/{x}/{y}`)],
        maxzoom: 14,
        attribution,
    }

    // Glyphs are served by Martin from the fonts baked into the image (see martin/config.yaml).
    // MapLibre requires a top-level `glyphs` URL before any layer may use `text-field`, including
    // the symbol layers the frontend adds at runtime (line labels, station names).
    // Martin's `/font/{fontstack}/{start}-{end}` endpoint maps directly onto MapLibre's `{range}`.
    style.glyphs = withCacheBust(`${baseUrl}/font/{fontstack}/{range}`)
}

if (inputSourceName !== sourceName) {
    delete style.sources[inputSourceName]
}

for (const layer of style.layers ?? []) {
    if (layer.source === inputSourceName) {
        layer.source = sourceName
    }
}

style.layers = (style.layers ?? []).filter((layer) => {
    const layout = layer.layout ?? {}

    return layout['icon-image'] === undefined
})

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, `${JSON.stringify(style, null, 2)}\n`)
