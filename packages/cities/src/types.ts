// Shared city-registry types. Dependency-free plain TS so this package can be
// consumed unchanged by every toolchain in the monorepo (Vite build, the three
// Worker bundles, and the seed scripts). Do not import runtime dependencies here.

/** The transit route types the pipeline understands, in no particular order. */
export const ROUTE_TYPES = ['subway', 'tram', 'light_rail', 'train'] as const

export type RouteType = (typeof ROUTE_TYPES)[number]

/** `[longitude, latitude]` — GeoJSON/MapLibre order. */
export type LngLat = readonly [number, number]

/** `[west, south, east, north]` — GeoJSON bbox order. */
export type BBox = readonly [number, number, number, number]

/**
 * City-specific seed configuration. The pipeline-global tuning (Overpass
 * endpoint, merge threshold, geometry tolerance) is intentionally NOT here — it
 * doesn't vary by city and lives with the seed pipeline.
 */
export interface CitySeedConfig {
    /**
     * OSM `admin_level` regex identifying the city boundary relation. Usually
     * 4–6 for a city-sized boundary.
     */
    adminLevel: string
    /**
     * OSM `operator` tag values whose route relations should be seeded.
     * Filtering by operator keeps the query focused without coupling the
     * pipeline to a hand-maintained list of line refs that drifts whenever the
     * network changes.
     */
    operators: readonly string[]
    /**
     * Optional operational area for the seeded stop set. Route relations remain
     * intact so their geometry and stop ordering come from one OSM snapshot.
     */
    stationBounds?: BBox
    /**
     * Route types ordered most-to-least prioritized — used to pick a single
     * "highest" route type when a station is served by several. Also the set of
     * OSM `route` values to include.
     */
    routeTypePriority: readonly [RouteType, ...RouteType[]]
    /**
     * Route types listed here always get the configured color regardless of the
     * OSM relation tags (used to give all S-Bahn lines one shared green and all
     * tram lines one shared red). Route types absent from this map fall back to
     * the OSM colour/color tag — best for subway lines with per-line branding.
     */
    colors: Partial<Record<RouteType, string>>
    /**
     * Fallback color when neither a configured route color nor an OSM
     * colour/color tag is available. Mirrors the DB default on `lines.color`.
     */
    defaultLineColor: string
}

/**
 * Per-city language/extraction profile for the Telegram bot. Extraction logic
 * stays city-agnostic and reads everything it needs from here.
 */
export interface CityTelegramProfile {
    /** Inspector-report vocabulary the LLM prompt highlights to the model. */
    inspectorKeywords: string
    /** Free-text reminder of the local circular-line name. Empty = no circular line. */
    circularLineAlias: string
    /** Regex source recognizing user shorthand for the circular line. Empty = no circular line. */
    circularLinePattern: string
    /**
     * `[pattern, replacement]` regex-source pairs applied during normalization
     * so user-typed abbreviations match canonical names (e.g. "str." -> "strasse").
     * Patterns are matched globally after lowercasing and letter folding.
     */
    abbreviations: readonly (readonly [string, string])[]
    /**
     * Few-shot examples appended to the extraction prompt, in the local
     * language. Empty string disables few-shot.
     */
    promptExamples: string
}

/**
 * Public community channels surfaced in the app for a city. Only genuinely per-city
 * channels live here — Instagram/GitHub are shared across all cities (one account
 * each) and stay as frontend constants.
 */
export interface CityCommunity {
    /** Telegram group handle reports are synced with (e.g. `@FreiFahren_BE`). */
    telegramHandle: string
}

/**
 * Basemap tile-build inputs for a city. Consumed by the tile-server pipeline
 * (packages/tile-server). The archive's suggested view is derived from `map`
 * (center + zoom), so there is no separate view to keep in sync here.
 */
export interface CityTiles {
    /** Geofabrik OSM extract the basemap is built from. */
    osmUrl: string
    /** Crop this regional extract to `map.bounds` before generating the archive. */
    clipToMapBounds?: boolean
}

/** Map defaults for the city's basemap. */
export interface CityMap {
    /** Initial map center. */
    center: LngLat
    /** Initial zoom level. */
    zoom: number
    /** Metro-area extent. Used for optional tile cropping. */
    bounds: BBox
    /** URL of the MapLibre style JSON served by the tile-server. */
    styleUrl: string
}

/**
 * A single city's complete configuration. City is a runtime dimension resolved
 * from the hostname (or an explicit `?city=` param on the API); this registry is
 * the single source of truth for everything that differs between cities.
 */
export interface CityConfig extends CityDatabaseConfig {
    /** Stable identifier used as the registry key and the API `?city=` value. */
    slug: string
    /** Subdomain the city is served from (`<subdomain>.freifahren.org`). */
    subdomain: string
    /** Human-readable name shown in the UI. */
    displayName: string
    /** BCP-47 language tag for the city's primary language. */
    lang: string
    /** IANA timezone used to bucket reports into local service hours. */
    timezone: string
    map: CityMap
    /** Basemap tile-build inputs. Every city ships with a basemap. */
    tiles: CityTiles
    seed: CitySeedConfig
    telegram: CityTelegramProfile
    community: CityCommunity
}

/** The D1 resources provisioned for each city. */
export interface CityDatabaseConfig {
    /** D1 database name. */
    dbName: string
    /** Static Worker binding name for this city's D1 database. */
    dbBinding: string
}
