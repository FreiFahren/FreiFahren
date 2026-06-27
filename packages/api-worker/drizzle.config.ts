import type { Config } from 'drizzle-kit'

export default {
    schema: './src/db/schema/*',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
    casing: 'snake_case',
} satisfies Config
