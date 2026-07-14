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
