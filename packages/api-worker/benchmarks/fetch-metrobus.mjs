// Fetch BVG MetroBus (M-prefixed bus lines) data from Overpass, using the same
// query shapes as the FreiFahren seed pipeline (stations/overpass.ts), restricted
// to route=bus and ref ~ ^M\d+$.
import { writeFileSync } from 'node:fs'

const OUT_DIR = process.argv[2] ?? '.'
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
const UA = 'FreiFahren-Seed/1.0 (+https://github.com/FreiFahren/FreiFahren)'
const CITY = 'Berlin'
const ADMIN_LEVEL = '^[4-6]$'
const OPERATORS = '^(Berliner Verkehrsbetriebe)$'
const TIMEOUT_S = 180
const FETCH_TIMEOUT_MS = 200_000
const BATCH_SIZE = 10
const COOLDOWN_MS = 15_000

const area = `area["name"="${CITY}"]["boundary"="administrative"]["admin_level"~"${ADMIN_LEVEL}"]->.a;`

const refsQuery = `
[out:json][timeout:${TIMEOUT_S}];
${area}
relation["type"="route"]["route"="bus"]["operator"~"${OPERATORS}"]["ref"~"^M[0-9]+$"](area.a);
out tags;
`

const refRegex = (refs) => '^(' + refs.join('|') + ')$'

const stationsQuery = (refs) => `
[out:json][timeout:${TIMEOUT_S}];
${area}
relation["type"="route"]["route"="bus"]["operator"~"${OPERATORS}"]["ref"~"${refRegex(refs)}"](area.a)->.routes;
node(r.routes)->.routeNodes;
rel["public_transport"="stop_area"](bn.routeNodes)->.stopAreas;
node(r.stopAreas)->.stopNodes;
(
  .routes;
  .stopAreas;
  .routeNodes;
  .stopNodes;
);
out body;
`

const geometryQuery = (refs) => `
[out:json][timeout:${TIMEOUT_S}];
${area}
relation["type"="route"]["route"="bus"]["operator"~"${OPERATORS}"]["ref"~"${refRegex(refs)}"](area.a)->.routes;
way(r.routes)->.routeWays;
(
  .routes;
  .routeWays;
);
out geom;
`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const fetchOverpass = async (query) => {
  for (let attempt = 1; attempt <= 5; attempt++) {
    for (const endpoint of ENDPOINTS) {
      console.log(`  trying ${endpoint} (attempt ${attempt})`)
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
        if (!res.ok) {
          console.warn(`  ${endpoint} -> ${res.status}`)
          continue
        }
        const json = await res.json()
        return json.elements
      } catch (err) {
        console.warn(`  ${endpoint} failed: ${err.message}`)
      }
    }
    await sleep(20_000 * attempt)
  }
  throw new Error('all endpoints failed')
}

const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const fetchBatched = async (label, refs, build) => {
  const all = []
  const batches = chunk(refs, BATCH_SIZE)
  for (let i = 0; i < batches.length; i++) {
    if (i > 0) await sleep(COOLDOWN_MS)
    console.log(`[${label}] batch ${i + 1}/${batches.length}: ${batches[i].join(', ')}`)
    const els = await fetchOverpass(build(batches[i]))
    console.log(`[${label}]   got ${els.length} elements`)
    all.push(...els)
  }
  return all
}

const assertRefsPresent = (label, refs, elements) => {
  const present = new Set()
  for (const el of elements) {
    if (el.type === 'relation' && el.tags?.type === 'route' && el.tags.ref) present.add(el.tags.ref)
  }
  const missing = refs.filter((r) => !present.has(r))
  if (missing.length > 0) throw new Error(`[${label}] incomplete response, missing refs: ${missing.join(', ')}`)
}

const main = async () => {
  console.log('[refs] discovering MetroBus refs...')
  const refEls = await fetchOverpass(refsQuery)
  const refs = [...new Set(refEls.filter((e) => e.type === 'relation' && e.tags?.ref).map((e) => e.tags.ref))].sort()
  console.log(`[refs] found ${refs.length}: ${refs.join(', ')}`)

  await sleep(COOLDOWN_MS)
  const stationEls = await fetchBatched('stations', refs, stationsQuery)
  assertRefsPresent('stations', refs, stationEls)

  await sleep(COOLDOWN_MS)
  const geomEls = await fetchBatched('geometry', refs, geometryQuery)
  assertRefsPresent('geometry', refs, geomEls)

  writeFileSync(`${OUT_DIR}/bus_stations.json`, JSON.stringify(stationEls))
  writeFileSync(`${OUT_DIR}/bus_route_geometries.json`, JSON.stringify(geomEls))
  console.log(`done. stations elements: ${stationEls.length}, geometry elements: ${geomEls.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
