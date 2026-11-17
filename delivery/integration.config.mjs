// Same browser matrix and Java host, but no mock DCM/routing/location server.
import acceptance from './playwright.config.mjs';

export default {
  ...acceptance,
  testMatch: 'integration.spec.mjs',
  timeout: 45000,
  webServer: {
    ...acceptance.webServer,
    command: 'node delivery/tests/serve.mjs --real-services',
  },
};
