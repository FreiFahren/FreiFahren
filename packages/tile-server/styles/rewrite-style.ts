// Rewrites the source MapLibre style to read a city's `<city>.pmtiles` archive from the tile host.
// Pure function (no I/O) so it's trivially testable; the CLI lives in scripts/generate.ts.

export type Source = {
  type: string
  url?: string
  tiles?: string[]
  maxzoom?: number
  attribution?: string
}

export type Layer = {
  id?: string
  type?: string
  source?: string
  layout?: Record<string, unknown>
  [key: string]: unknown
}

export type Style = {
  sources?: Record<string, Source>
  layers?: Layer[]
  glyphs?: string
  sprite?: string
  [key: string]: unknown
}

const ATTRIBUTION =
  "<a href='https://www.openstreetmap.org/copyright' target='_blank'>&copy; OpenStreetMap contributors</a>"

/**
 * Point the style at `<city>.pmtiles` on `baseUrl`, read in the browser via the `pmtiles://` protocol.
 *
 * `version` (a deploy's git sha) is the cache-bust: it goes into the path, so a new deploy is a new
 * immutable URL and never needs an edge purge. Whoever passes a version MUST also upload the archive
 * to the matching `/v<version>/<city>.pmtiles` key — the deploy owns both. Local builds pass none and
 * serve a flat `/<city>.pmtiles`. Mutates and returns `style`.
 */
export function rewritePmtilesStyle(
  style: Style,
  opts: { city: string; baseUrl: string; version?: string },
): Style {
  const sourceName = 'freifahren'
  const inputSourceName = Object.keys(style.sources ?? {}).find(
    (name) => style.sources?.[name]?.type === 'vector',
  )
  if (!inputSourceName) throw new Error('Expected a vector source in the style JSON')

  delete style.sprite

  const archivePath = opts.version
    ? `/v${opts.version}/${opts.city}.pmtiles`
    : `/${opts.city}.pmtiles`
  const sources = (style.sources ??= {})
  sources[sourceName] = {
    type: 'vector',
    url: `pmtiles://${opts.baseUrl}${archivePath}`,
    attribution: ATTRIBUTION,
  }

  // MapLibre only fetches glyphs when a layer uses `text-field` (the basemap has none today); the URL
  // is set so labels work once added.
  style.glyphs = `${opts.baseUrl}/fonts/{fontstack}/{range}.pbf`

  if (inputSourceName !== sourceName) delete sources[inputSourceName]
  for (const layer of style.layers ?? []) {
    if (layer.source === inputSourceName) layer.source = sourceName
  }
  // The tile service serves no sprite, so drop layers that depend on one.
  style.layers = (style.layers ?? []).filter((layer) => (layer.layout ?? {})['icon-image'] === undefined)

  return style
}
