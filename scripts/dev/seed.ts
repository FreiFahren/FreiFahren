import { CITY_SLUGS } from '../../packages/cities/src/index.ts'

import { API, run } from './paths'

export async function seed(city?: string) {
    for (const slug of city ? [city] : CITY_SLUGS) {
        await run(API, ['bun', 'run', 'seed', '--city', slug])
    }
}

if (import.meta.main) await seed(process.argv[2])
