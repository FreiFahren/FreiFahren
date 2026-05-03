import fs from 'node:fs/promises'
import path from 'node:path'

const [, , inputPath, outputPath, baseUrl = 'http://localhost:8090', ...flags] = process.argv

if (!inputPath || !outputPath) {
    console.error('Usage: node rewrite-style.mjs <input-style.json> <output-style.json> [base-url]')
    process.exit(1)
}

const style = JSON.parse(await fs.readFile(inputPath, 'utf8'))
const sourceName = 'freifahren'

const keepAssets = flags.includes('--keep-assets')

if (!keepAssets) {
    style.glyphs = `${baseUrl}/fonts/{fontstack}/{range}.pbf`
    style.sprite = `${baseUrl}/styles/freifahren-dark/sprite`
}

const inputSourceName = Object.keys(style.sources ?? {}).find((name) => style.sources[name]?.type === 'vector')

if (!inputSourceName) {
    throw new Error('Expected a vector source in the style JSON')
}

style.sources[sourceName] = {
    type: 'vector',
    tiles: [`${baseUrl}/data/${sourceName}/{z}/{x}/{y}.pbf`],
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

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, `${JSON.stringify(style, null, 2)}\n`)
