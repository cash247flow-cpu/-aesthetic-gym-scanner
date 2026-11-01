// Test-only values. None of these are real: they exist only for the local servers a test run
// starts, and never for the deployed app.
export const E2E = {
  port: 3100,
  baseURL: "http://localhost:3100",
  passcode: "synthetic-e2e-passcode",
  sessionSecret: "synthetic-e2e-session-secret-0123456789abcdef",
  kvPort: 8443,
  kvAdminPort: 8444,
  kvToken: "synthetic-e2e-upstash-token",
} as const;
