// Per-test-file setup: ensures the env points at the test database
// before any application module that reads `env.ts` is imported.

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgres://fc:fc@localhost:5433/fc_test";
}
process.env.ADMIN_TOKEN ??= "test-admin-token-please-change";
process.env.SESSION_SECRET ??= "test-session-secret-must-be-long-enough";
process.env.CORS_ORIGIN ??= "http://localhost:5173";
process.env.WEB_URL ??= "http://localhost:5173";
process.env.NODE_ENV = "test";
