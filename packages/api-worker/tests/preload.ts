import { existsSync, rmSync } from 'node:fs'

// We suppress logging in tests to avoid cluttering the output.
// But to debug a test failure, you can run `TEST_LOG_LEVEL=info bun test` to enable logging.
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? 'error'
// Use a local libsql file for tests. Ignore any postgres URL bun auto-loaded from .env — only
// honour DATABASE_URL_TEST when it is a libsql-supported scheme.
const candidate = process.env.DATABASE_URL_TEST
process.env.DATABASE_URL = candidate && /^(file|libsql|wss?|https?):/.test(candidate) ? candidate : 'file:./.test.db'

// Start each test run from a clean local SQLite file.
const fileUrl = process.env.DATABASE_URL
if (fileUrl.startsWith('file:')) {
    const path = fileUrl.slice('file:'.length)
    for (const suffix of ['', '-wal', '-shm']) {
        if (existsSync(path + suffix)) rmSync(path + suffix)
    }
}

const [{ migrate }, { setNodeDbProvider }, { createNodeDb, createNodeDbHandle }, { seedBaseData }] = await Promise.all([
    import('drizzle-orm/libsql/migrator'),
    import('../src/app-env'),
    import('../src/db/node'),
    import('../src/db/seed/seed'),
])

setNodeDbProvider(createNodeDb)

const { db, client } = createNodeDbHandle(process.env.DATABASE_URL!)

await client.execute('PRAGMA foreign_keys = ON')
await migrate(db, { migrationsFolder: './drizzle' })

// Seed the read-only reference tables (stations, lines, line_stations, segments) once for the whole test run.
await seedBaseData(db)

export {}
