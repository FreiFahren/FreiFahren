import { CITY_DATABASE_SLUGS, getCityDatabase } from '@freifahren/cities'

// Absent means wrangler's default config — production. Preview environments pass a generated config
// Naming their own databases.
export const parseConfigArg = (argv: string[] = process.argv): string | undefined => {
    const flag = argv.indexOf('--config')
    if (flag === -1) return undefined

    const path = argv[flag + 1]
    if (!path) {
        throw new Error('--config requires a path to a wrangler config file')
    }
    return path
}

// Validated against the database registry rather than the runtime city registry, so a database can
// Be operated on before its transit configuration lands.
export const parseCityDatabasesArg = (argv: string[] = process.argv): string[] => {
    const flag = argv.indexOf('--city')
    if (flag === -1) return [...CITY_DATABASE_SLUGS]

    const slug = argv[flag + 1]
    if (!slug) {
        throw new Error('--city requires a value, e.g. --city berlin')
    }
    if (!getCityDatabase(slug)) {
        throw new Error(`Unknown city "${slug}" — not a provisioned city database in @freifahren/cities`)
    }
    return [slug]
}
