import fs from 'node:fs/promises'
import path from 'node:path'

const [, , inputPath, outputPath, baseUrl = 'http://localhost:3000', cacheBust = ''] = process.argv

if (!inputPath || !outputPath) {
    console.error('Usage: node rewrite-style.mjs <input-style.json> <output-style.json> [base-url]')
    process.exit(1)
}

const style = JSON.parse(await fs.readFile(inputPath, 'utf8'))
const sourceName = 'freifahren'

const inputSourceName = Object.keys(style.sources ?? {}).find((name) => style.sources[name]?.type === 'vector')

if (!inputSourceName) {
    throw new Error('Expected a vector source in the style JSON')
}

delete style.glyphs
delete style.sprite

// `?v=<cacheBust>` invalidates Cloudflare's 1-year edge cache on each deploy.
const tileUrl = cacheBust
    ? `${baseUrl}/${sourceName}/{z}/{x}/{y}?v=${cacheBust}`
    : `${baseUrl}/${sourceName}/{z}/{x}/{y}`

style.sources[sourceName] = {
    type: 'vector',
    tiles: [tileUrl],
    maxzoom: 14,
    attribution:
        "<a href='https://www.openstreetmap.org/copyright' target='_blank'>&copy; OpenStreetMap contributors</a>",
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

    return layout['icon-image'] === undefined && layout['text-field'] === undefined
})

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, `${JSON.stringify(style, null, 2)}\n`)
