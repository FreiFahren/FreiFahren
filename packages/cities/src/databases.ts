import type { CityDatabaseConfig } from './types'

// This registry tracks provisioned city databases independently from city content.
// A city can receive its isolated D1 schema before its transit configuration is ready.
export const CITY_DATABASES = {
    berlin: {
        dbName: 'api-worker-db-eu',
        dbBinding: 'DB',
    },
    hamburg: {
        dbName: 'api-worker-db-hamburg-eu',
        dbBinding: 'DB_HAMBURG',
    },
    leipzig: {
        dbName: 'api-worker-db-leipzig',
        dbBinding: 'DB_LEIPZIG',
    },
    munich: {
        dbName: 'api-worker-db-munich-eu',
        dbBinding: 'DB_MUNICH',
    },
    cologne: {
        dbName: 'api-worker-db-cologne-eu',
        dbBinding: 'DB_COLOGNE',
    },
    nuremberg: {
        dbName: 'api-worker-db-nuremberg-eu',
        dbBinding: 'DB_NUREMBERG',
    },
    hannover: {
        dbName: 'api-worker-db-hannover-eu',
        dbBinding: 'DB_HANNOVER',
    },
    duesseldorf: {
        dbName: 'api-worker-db-duesseldorf-eu',
        dbBinding: 'DB_DUESSELDORF',
    },
} as const satisfies Record<string, CityDatabaseConfig>

export type CityDatabaseSlug = keyof typeof CITY_DATABASES

export const CITY_DATABASE_SLUGS = Object.keys(CITY_DATABASES) as CityDatabaseSlug[]

const isCityDatabaseSlug = (value: string): value is CityDatabaseSlug =>
    Object.prototype.hasOwnProperty.call(CITY_DATABASES, value)

/** Look up a provisioned city database by slug, or `undefined` if the slug isn't provisioned. */
export const getCityDatabase = (slug: string): CityDatabaseConfig | undefined =>
    isCityDatabaseSlug(slug) ? CITY_DATABASES[slug] : undefined
