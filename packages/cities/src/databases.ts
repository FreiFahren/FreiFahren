import type { CityDatabaseConfig } from './types'

// This registry tracks provisioned city databases independently from city content.
// A city can receive its isolated D1 schema before its transit configuration is ready.
export const CITY_DATABASES = {
    berlin: {
        dbName: 'api-worker-db-eu',
        dbBinding: 'DB',
    },
    leipzig: {
        dbName: 'api-worker-db-leipzig',
        dbBinding: 'DB_LEIPZIG',
    },
} as const satisfies Record<string, CityDatabaseConfig>

export type CityDatabaseSlug = keyof typeof CITY_DATABASES

/** Every provisioned city database, in registry order. Drives the migration fan-out. */
export const CITY_DATABASE_SLUGS = Object.keys(CITY_DATABASES) as CityDatabaseSlug[]

const isCityDatabaseSlug = (value: string): value is CityDatabaseSlug =>
    Object.prototype.hasOwnProperty.call(CITY_DATABASES, value)

/**
 * Look up a provisioned city database by slug, or `undefined` if the slug isn't provisioned.
 * Separate from `getCity`: a database can exist (and receive migrations) before the city has
 * runtime transit configuration.
 */
export const getCityDatabase = (slug: string): CityDatabaseConfig | undefined =>
    isCityDatabaseSlug(slug) ? CITY_DATABASES[slug] : undefined
