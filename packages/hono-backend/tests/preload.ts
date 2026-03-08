// We suppress logging in tests to avoid cluttering the output.
// But to debug a test failure, you can run `TEST_LOG_LEVEL=info bun test` to enable logging.
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? 'error'
process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/freifahren_test'
