// Global Jest test setup
// Use in-memory sqlite for faster isolated e2e tests when real Postgres not available.
process.env.TEST_DB_SQLITE = process.env.TEST_DB_SQLITE || 'true';
// Increase default timeout for slower module/bootstrap operations.
jest.setTimeout(20000);
