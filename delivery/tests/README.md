# Run the delivery tests

Requires Node.js 22+ and Docker running. From the repository root:

```sh
npm ci
npx playwright install chromium
npm test
```

Tests for unfinished features are expected to fail until those features are implemented.
