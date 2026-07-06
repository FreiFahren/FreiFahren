import type { Config } from 'drizzle-kit'

// `db:generate` reads the schema files and emits SQLite migrations offline (no credentials needed).
// Migrations are applied to D1 with `wrangler d1 migrations apply` (see the db:migrate* scripts);
// the d1-http credentials below only matter for drizzle-kit commands that connect to the remote D1
// (e.g. db:studio) and are read from the environment.
export default {
    schema: './src/db/schema/*',
    out: './drizzle',
    dialect: 'sqlite',
    driver: 'd1-http',
    dbCredentials: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
        databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID ?? '',
        token: process.env.CLOUDFLARE_API_TOKEN ?? '',
    },
    casing: 'snake_case',
} satisfies Config
