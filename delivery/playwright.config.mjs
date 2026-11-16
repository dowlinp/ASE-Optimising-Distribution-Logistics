// Runs the five delivery tests in a phone-sized browser against the Java/Docker host.
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: './tests',
  testMatch: 'driver.spec.mjs',
  // The tests share one fake service, so run them one at a time to isolate state.
  workers: 1,
  // All timeout values are milliseconds; failed tests are not automatically retried.
  timeout: 20000,
  expect: { timeout: 5000 },
  retries: 0,

  // Use a consistent phone viewport and Dublin time when checking displayed estimates.
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:5083',
    viewport: { width: 390, height: 844 },
    timezoneId: 'Europe/Dublin',
    trace: 'retain-on-failure',
  },

  // Playwright starts the test services, waits for the driver page, then stops them.
  webServer: {
    command: 'node delivery/tests/serve.mjs',
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    url: 'http://127.0.0.1:5083/Delivery',
    reuseExistingServer: false,
    timeout: 120000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 },
  },
});
