# Delivery POC test suite

Requires Node.js 22+ and Docker running. No local Java installation is needed.
From the repository root:

```sh
npm ci
npx playwright install chromium webkit
npm test
```

`npm test` runs the 18 local scenarios in Chromium and WebKit: 36 executions.
Unimplemented behaviours are expected to fail. The original six scenarios in
`driver.spec.mjs` have not been edited, disabled or marked as expected failures.
The additional 14 scenarios are 11 browser cases, one Java/HTTP case and two real
provider journeys. Every scenario runs in both browser projects when configured.

```sh
npm run test:acceptance    # 17 browser scenarios per engine, fake external services
npm run test:contracts     # One grouped Java/HTTP scenario per engine
npm run test:integration   # Two real-provider journeys per engine; requires setup below
npm run verify:test-freeze
```

For a focused run, pass Playwright options after `--`, for example:

```sh
npm run test:acceptance -- --project chromium --grep 'unknown driver'
```

## What the added scenarios prove

Each scenario includes comments explaining the risk and how the test creates it.
All assertions use the rendered page or HTTP requests/responses. Clock control,
map tiles and external service responses are controlled at their public boundaries.

| Added scenarios | Purpose |
| --- | --- |
| Three assignment errors | Unknown driver, absent assignment and unavailable DCM show errors and never start session requests. |
| Initial hub fallback | Navigation starts before a position response; controls fit at 360px and 390px and meet 44px touch targets. |
| Next-task continuation | DCM can supply another task; its signature requirement replaces the previous task's captured photo. |
| Rapid confirmation | One submission stays locked until its matching acknowledgement; no premature state/navigation reads. |
| Uncertain failure retry | An unrelated attempt ID is not an acknowledgement; retry uses the same payload and advances only once. |
| Position resilience | A held request does not overlap another poll; older samples and errors retain the last marker without changing the task/route. |
| Refresh/sync failures | Failed navigation does not sync; false/failed sync preserves the displayed route and proof; true sync applies the exact response. |
| Obsolete refreshes | Older revisions, foreign tasks and responses superseded by an outcome cannot replace current navigation. |
| Page lifecycle | Hidden pages stop timers; repeated resumes do not multiply them; reload cancels the previous session's pending request. |
| Java/HTTP boundary | Public assets, all three forwarding prefixes, status/body/query preservation, five-second timeout and JSON-true sync. |
| Real success and failure | Real assignment, route, position, outcome, return route and provider records; failures also require operations-log evidence. |

The lifecycle test emulates the browser's Page Visibility properties/event because
Playwright has no shared Chromium/WebKit visibility control. Reload is the current
public session-reset action. It does not test a future in-page driver-switch control.

## Real-provider integration setup

The integration launcher starts the real Java container and **does not start the
fake service server**. Missing configuration fails explicitly; journeys are never
silently skipped or redirected to fixtures. Do not run it alongside the local suite
or manual demo: all use application port 5083.

Set `DCM_BASE_URL`, `ROUTING_BASE_URL` and `LOCATION_BASE_URL` to actual providers
reachable from Docker. For providers running on this laptop, use
`http://host.docker.internal:<provider-port>`, rather than `localhost`.

Seed a fresh one-delivery round for each journey and engine, with loaded packages,
an assigned vehicle, a configured hub and a predefined return route. Set:

- `INTEGRATION_SUCCESS_DRIVER_CHROMIUM`
- `INTEGRATION_FAILED_DRIVER_CHROMIUM`
- `INTEGRATION_SUCCESS_DRIVER_WEBKIT`
- `INTEGRATION_FAILED_DRIVER_WEBKIT`

These are driver IDs, not passwords. Each round is consumed by its outcome, so
reseed before repeating the integration run.

Provider persistence must be verified independently of the browser's outcome ACK.
Set two **read-only evidence URL templates**, reachable from the test runner:

- `DCM_OUTCOME_RECORD_URL`: retrieves the persisted outcome by attempt.
- `DCM_FAILURE_LOG_URL`: retrieves the operations failure-log entry by attempt.

Templates may contain `{attemptId}`, `{roundId}` and `{taskId}`. Each response must
be a JSON object containing those three IDs and `outcome` (`SUCCESS` or `FAILED`).
For example, an owner-provided adapter could expose
`http://<provider>/evidence/outcomes/{attemptId}`. This is a proposed **test evidence
interface**, not a claim that providers already implement that URL or schema.
Owners must supply compatible read endpoints/adapters before integration can pass.
The application itself never calls these evidence endpoints. Their responses are
attached to the Playwright test result for handoff review.

No application API is intercepted during integration. Only the agreed photo,
signature and Java fake-sync implementations remain stubs. Provider implementation,
seeding and evidence endpoints stay with their owning components.

## Reviewing and freezing this test-only revision

`baseline.json` includes the added tests and changed test support/configuration.
Its hashes detect edits; they do not establish approval by themselves. This expanded
suite is a candidate for review, not a claim that a new baseline has been committed.

After review and the user's commit, record its full SHA as `TEST_BASELINE_SHA` in
protected CI configuration. The verifier can then compare the working copy with
that committed manifest and its files. The former baseline SHA will intentionally
reject this expanded suite. Keep the new selection and CI enforcement outside the
later implementation branch. Application code must not change to make this test-only
revision green, and expected failures must not be skipped or weakened.
