# Run the delivery tests

Requires Node.js 22+ and Docker running. From the repository root:

```sh
npm ci
npx playwright install chromium
npm test
```

The five tests are expected to fail until the driver interface is implemented.
