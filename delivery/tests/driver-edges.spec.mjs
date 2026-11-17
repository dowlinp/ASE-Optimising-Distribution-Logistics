// Additional acceptance scenarios for issue #3. Only HTTP/browser boundaries are
// controlled here: no application functions, variables or Leaflet internals are read.
import { test, expect } from '@playwright/test';
import { createRound, createNavigation } from './fixtures.mjs';
import {
  openDriverPage, startAssignedRound, readServiceState, countServiceRequests, setServiceOptions,
} from './helpers.mjs';

const assignmentPath = '**/api/dcm/drivers/*/active-round';
const positionPath = '**/api/location/vehicles/*/position';
const navigationPath = '**/api/routing/rounds/*/navigation?*';
const outcomePath = '**/api/dcm/rounds/*/tasks/*/outcomes';
const routeLine = page => page.locator('#map svg path.leaflet-interactive');
const confirm = page => page.getByRole('button', { name: 'Confirm delivery', exact: true });
const failed = page => page.getByRole('button', { name: 'Failed task', exact: true });
const driverMarker = page => page.getByRole('img', { name: 'Driver location', exact: true });

async function enterDriver(page, id = 'DRIVER-1') {
  await page.getByLabel('Driver ID', { exact: true }).fill(id);
  await page.getByRole('button', { name: 'Start round', exact: true }).click();
}

// These are three separate cases because 404, an empty assignment and a failed
// service response must all prevent a session from starting. The browser clock
// then advances a full refresh period to catch timers started after failed lookup.
for (const scenario of [
  { name: 'unknown driver', status: 404, body: { error: 'Unknown driver' } },
  { name: 'missing assignment', status: 200, body: null },
  { name: 'failed assignment lookup', status: 503, body: { error: 'DCM unavailable' } },
]) {
  test(`${scenario.name} shows an error without starting session requests`, async ({ page }) => {
    let lookupCount = 0;
    const sessionRequests = [];
    page.on('request', request => {
      if (/\/api\/(location|routing)\/|\/api\/sync$/.test(request.url())) {
        sessionRequests.push(request.url());
      }
    });
    await page.route(assignmentPath, async route => {
      lookupCount++;
      await route.fulfill({ status: scenario.status, json: scenario.body });
    });
    await openDriverPage(page);
    await enterDriver(page, 'NO-ASSIGNMENT');

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Assigned round', exact: true })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Start round', exact: true })).toBeEnabled();
    await page.clock.runFor(30000);
    expect(lookupCount).toBe(1);
    expect(sessionRequests).toEqual([]);
  });
}

test('initial navigation uses the configured hub while position is unavailable and fits both phone widths', async ({ page }) => {
  // Hold the first position response. Navigation must not wait for GPS/simulation;
  // its first query uses the hub returned by DCM, rather than hardcoded coordinates.
  const positionGate = Promise.withResolvers();
  const navigationQueries = [];
  const positionSample = { latitude: 53.352, longitude: -6.261, timestamp: '2026-11-16T09:00:02Z' };
  await page.route(positionPath, async route => {
    await positionGate.promise;
    await route.fulfill({ json: positionSample });
  });
  await page.route(navigationPath, route => {
    navigationQueries.push(new URL(route.request().url()).searchParams);
    return route.continue();
  });
  try {
    await openDriverPage(page);
    await enterDriver(page);
    await expect(routeLine(page)).toBeVisible();
    expect(navigationQueries[0].get('latitude')).toBe('53.3498');
    expect(navigationQueries[0].get('longitude')).toBe('-6.2603');
    const initialViewport = page.viewportSize();
    const markerBefore = await driverMarker(page).boundingBox();
    const routeBefore = await routeLine(page).getAttribute('d');

    // Check actual rendered dimensions in each engine, not just viewport settings.
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const control of [confirm(page), failed(page),
        page.getByRole('button', { name: 'Take photo', exact: true }),
        page.getByRole('button', { name: 'Delivery instructions', exact: true })]) {
        const bounds = await control.boundingBox();
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      }
    }
    // Restore the original viewport before comparing marker/route geometry.
    await page.setViewportSize(initialViewport);
    positionGate.resolve();
    await expect.poll(async () => (await driverMarker(page).boundingBox()).y).not.toBe(markerBefore.y);
    await expect(page.getByTestId('task-id')).toHaveText('TASK-1');
    expect(navigationQueries).toHaveLength(1);
    // Position changes must not make another navigation request or complete a task.
    expect((await readServiceState()).outcomes).toEqual([]);
    await expect(routeLine(page)).toHaveAttribute('d', routeBefore);
  } finally {
    positionGate.resolve();
  }
});

test('an acknowledged outcome displays the next authoritative task and clears the previous proof', async ({ page }) => {
  await startAssignedRound(page);
  // A second seeded task guards the continuation branch without adding delivery
  // reassignment. It is returned only by the round read after TASK-1 is accepted.
  const nextRound = {
    ...createRound(),
    activeTask: {
      taskId: 'TASK-2', address: '25 Mountjoy Square, Dublin',
      latitude: 53.357, longitude: -6.259,
      instructions: 'Ask reception for the recipient.', proofType: 'SIGNATURE',
    },
    remainingStops: 1,
  };
  await page.route('**/api/dcm/rounds/ROUND-1', route => route.fulfill({ json: nextRound }));
  await page.route(navigationPath, route => route.fulfill({ json: {
    ...createNavigation(), taskId: 'TASK-2', revision: 2,
    geometry: { type: 'LineString', coordinates: [[-6.263, 53.354], [-6.259, 53.357]] },
    nextStopEta: '2026-11-16T09:30:00Z', estimatedFinishTime: '2026-11-16T10:00:00Z',
  } }));
  await page.getByRole('button', { name: 'Take photo', exact: true }).click();
  await confirm(page).click();

  await expect(page.getByTestId('task-id')).toHaveText('TASK-2');
  await expect(page.getByText('25 Mountjoy Square, Dublin', { exact: true })).toBeVisible();
  await expect(page.getByTestId('next-stop-eta')).toHaveText('09:30');
  await expect(page.getByTestId('estimated-finish-time')).toHaveText('10:00');
  await expect(page.getByTestId('remaining-stops')).toHaveText('1');
  await expect(confirm(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Take photo', exact: true })).not.toBeVisible();
  const signatureButton = page.getByRole('button', { name: 'Capture signature', exact: true });
  await expect(signatureButton).toBeVisible();
  await signatureButton.click();
  await expect(confirm(page)).toBeEnabled();
  await page.getByRole('button', { name: 'Delivery instructions', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Ask reception for the recipient.');
  expect((await readServiceState()).outcomes).toHaveLength(1);
});

test('rapid confirmation submits once and waits for the matching acknowledgement before reading the next state', async ({ page }) => {
  await startAssignedRound(page);
  const acknowledgementGate = Promise.withResolvers();
  let submissions = 0;
  const followUpReads = [];
  page.on('request', request => {
    if (/\/api\/dcm\/rounds\/ROUND-1$|\/navigation\?/.test(request.url())) {
      followUpReads.push(request.url());
    }
  });
  await page.route(outcomePath, async route => {
    submissions++;
    // DCM has recorded the outcome, but the driver has not received its ACK yet.
    const response = await route.fetch();
    await acknowledgementGate.promise;
    await route.fulfill({ response });
  });
  try {
    await page.getByRole('button', { name: 'Take photo', exact: true }).click();
    // Two real pointer clicks exercise the event/submission guard without calling
    // submitOutcome directly or bypassing the button's native disabled state.
    const bounds = await confirm(page).boundingBox();
    await page.mouse.dblclick(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await expect.poll(() => submissions).toBe(1);
    await expect(confirm(page)).toBeDisabled();
    await expect(failed(page)).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Take photo', exact: true })).toBeDisabled();
    await expect(page.getByTestId('task-id')).toHaveText('TASK-1');
    expect(followUpReads).toEqual([]);
    acknowledgementGate.resolve();
    await expect(page.getByTestId('navigation-mode')).toHaveText('Return to hub');
    expect(submissions).toBe(1);
    expect(followUpReads.filter(url => url.endsWith('/api/dcm/rounds/ROUND-1'))).toHaveLength(1);
    expect(followUpReads.filter(url => url.includes('/navigation?'))).toHaveLength(1);
  } finally {
    acknowledgementGate.resolve();
  }
});

test('an uncertain failed outcome keeps its task and retries the identical attempt without duplicate progression', async ({ page }) => {
  await startAssignedRound(page);
  const payloads = [];
  await page.route(outcomePath, async route => {
    payloads.push(route.request().postDataJSON());
    if (payloads.length === 1) {
      // A rejected failure must also leave the task available for retry.
      return route.fulfill({ status: 503, json: { error: 'Outcome unavailable' } });
    }
    const response = await route.fetch();
    // Simulate an unusable ACK after DCM has already persisted the failure. A 200
    // alone is insufficient: its attempt ID must correspond to the submitted one.
    return payloads.length === 2
      ? route.fulfill({ json: { accepted: true, attemptId: 'UNRELATED-ATTEMPT' } })
      : route.fulfill({ response });
  });
  await failed(page).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('task-id')).toHaveText('TASK-1');
  await expect(page.getByTestId('remaining-stops')).toHaveText('1');
  await expect(failed(page)).toBeEnabled();
  expect((await readServiceState()).failures).toEqual([]);
  await failed(page).click();
  await expect.poll(() => payloads.length).toBe(2);
  await expect(failed(page)).toBeEnabled();
  await expect(page.getByTestId('task-id')).toHaveText('TASK-1');
  await expect(page.getByRole('alert')).toBeVisible();
  await failed(page).click();
  await expect(page.getByTestId('navigation-mode')).toHaveText('Return to hub');
  expect(payloads).toHaveLength(3);
  expect(payloads[0]).toEqual({ attemptId: expect.any(String), outcome: 'FAILED', proof: null });
  expect(payloads[0].attemptId.length).toBeGreaterThan(0);
  expect(payloads[1]).toEqual(payloads[0]);
  expect(payloads[2]).toEqual(payloads[0]);
  const service = await readServiceState();
  expect(service.completed).toBe(1);
  expect(service.failures).toEqual([payloads[0]]);
});

test('position polling rejects older samples, retains the marker on errors and never overlaps requests', async ({ page }) => {
  await startAssignedRound(page);
  const originalRoute = await routeLine(page).getAttribute('d');
  const originalMarker = await driverMarker(page).boundingBox();
  const responseGate = Promise.withResolvers();
  let samplesRequested = 0;
  await page.route(positionPath, async route => {
    samplesRequested++;
    if (samplesRequested === 1) {
      await responseGate.promise;
      return route.fulfill({ json: {
        latitude: 53.352, longitude: -6.261, timestamp: '2026-11-16T09:00:03Z',
      } });
    }
    if (samplesRequested === 2) {
      // Arrives later over HTTP but was observed earlier: it must not move back.
      return route.fulfill({ json: {
        latitude: 53.3498, longitude: -6.2603, timestamp: '2026-11-16T09:00:01Z',
      } });
    }
    return route.fulfill({ status: 503, json: { error: 'Position unavailable' } });
  });
  try {
    await page.clock.runFor(1000);
    await expect.poll(() => samplesRequested).toBe(1);
    // A second tick while the first read is pending must not start another read.
    await page.clock.runFor(1000);
    expect(samplesRequested).toBe(1);
    responseGate.resolve();
    await expect.poll(async () => (await driverMarker(page).boundingBox()).y).not.toBe(originalMarker.y);
    const latestMarker = await driverMarker(page).boundingBox();
    const olderSample = page.waitForResponse(response => response.url().includes('/api/location/') && response.url().endsWith('/position'));
    await page.clock.runFor(1000);
    await expect.poll(() => samplesRequested).toBe(2);
    await (await olderSample).finished();
    // Let the response's UI work finish before making a negative assertion.
    await page.clock.runFor(16);
    expect((await driverMarker(page).boundingBox()).y).toBe(latestMarker.y);
    await page.clock.runFor(1000);
    await expect.poll(() => samplesRequested).toBe(3);
    await expect(page.locator('[role="status"], [role="alert"]')
      .filter({ hasText: /position|location/i }).filter({ hasText: /fail|error|unavailable|unable|retry/i })).toBeVisible();
    expect(await driverMarker(page).boundingBox()).toEqual(latestMarker);
    await expect(routeLine(page)).toHaveAttribute('d', originalRoute);
    await expect(page.getByTestId('task-id')).toHaveText('TASK-1');
    expect((await readServiceState()).outcomes).toEqual([]);
  } finally {
    responseGate.resolve();
  }
});

test('refreshed navigation is applied only after true sync and failures retain the route and proof', async ({ page }) => {
  await startAssignedRound(page);
  await page.getByRole('button', { name: 'Take photo', exact: true }).click();
  const originalRoute = await routeLine(page).getAttribute('d');
  const navigation = createNavigation({ revision: 2, changedGeometry: true });
  const syncGate = Promise.withResolvers();
  let refreshes = 0;
  const queryPositions = [];
  const syncBodies = [];
  await page.route(navigationPath, route => {
    refreshes++;
    const query = new URL(route.request().url()).searchParams;
    queryPositions.push({ latitude: query.get('latitude'), longitude: query.get('longitude') });
    // A failed navigation read must not call sync with stale or missing data.
    return refreshes === 1
      ? route.fulfill({ status: 503, json: { error: 'Route unavailable' } })
      : route.fulfill({ json: navigation });
  });
  await page.route('**/api/sync', async route => {
    syncBodies.push(route.request().postDataJSON());
    if (syncBodies.length === 1) {
      await syncGate.promise;
      return route.fulfill({ json: false });
    }
    return syncBodies.length === 2
      ? route.fulfill({ status: 503, json: { error: 'Sync unavailable' } })
      : route.fulfill({ json: true });
  });
  try {
    // A refreshed route must originate at the latest external position, not
    // the original hub used to load the first route.
    await setServiceOptions({ positionIndex: 1 });
    await page.clock.runFor(1000);
    await expect.poll(() => countServiceRequests('/position')).toBe(2);
    await page.clock.runFor(29000);
    await expect.poll(() => refreshes).toBe(1);
    expect(queryPositions[0]).toEqual({ latitude: '53.352', longitude: '-6.261' });
    await expect(page.locator('[role="status"], [role="alert"]')
      .filter({ hasText: /route|navigation/i }).filter({ hasText: /fail|error|unavailable|unable|retry/i })).toBeVisible();
    expect(syncBodies).toEqual([]);

    await page.clock.runFor(30000);
    await expect.poll(() => syncBodies.length).toBe(1);
    expect(syncBodies[0]).toEqual(navigation);
    await expect(routeLine(page)).toHaveAttribute('d', originalRoute);
    await expect(page.getByTestId('next-stop-eta')).toHaveText('09:15');
    syncGate.resolve();
    await expect(page.locator('[role="status"], [role="alert"]')
      .filter({ hasText: /sync/i }).filter({ hasText: /fail|error|unavailable|reject|unable|retry/i })).toBeVisible();
    await expect(confirm(page)).toBeEnabled();

    await page.clock.runFor(30000);
    await expect.poll(() => syncBodies.length).toBe(2);
    await expect(routeLine(page)).toHaveAttribute('d', originalRoute);
    await expect(page.getByTestId('next-stop-eta')).toHaveText('09:15');
    await expect(confirm(page)).toBeEnabled();

    await page.clock.runFor(30000);
    await expect.poll(() => syncBodies.length).toBe(3);
    expect(syncBodies).toEqual([navigation, navigation, navigation]);
    await expect(routeLine(page)).not.toHaveAttribute('d', originalRoute);
    await expect(page.getByTestId('next-stop-eta')).toHaveText('09:25');
    await expect(page.getByTestId('task-id')).toHaveText('TASK-1');
    await expect(confirm(page)).toBeEnabled();
  } finally {
    syncGate.resolve();
  }
});

test('older revisions, foreign tasks and a refresh superseded by outcome acknowledgement cannot overwrite navigation', async ({ page }) => {
  await startAssignedRound(page);
  await page.getByRole('button', { name: 'Take photo', exact: true }).click();
  const lateRefresh = Promise.withResolvers();
  const lateFinished = Promise.withResolvers();
  let refreshes = 0;
  await page.route('**/api/sync', route => route.fulfill({ json: true }));
  await page.route(navigationPath, async route => {
    refreshes++;
    if (refreshes === 4) {
      // This belongs to TASK-1 but finishes after the accepted outcome changed
      // the authoritative task to null. Even a higher revision is now obsolete.
      await lateRefresh.promise;
      try {
        await route.fulfill({ json: createNavigation({ revision: 99 }) });
      } catch {
        // Cancellation is correct too; a canceled HTTP request cannot be fulfilled.
      } finally {
        lateFinished.resolve();
      }
      return;
    }
    const replies = [
      createNavigation({ revision: 3, changedGeometry: true }),
      createNavigation({ revision: 2 }),
      { ...createNavigation({ revision: 4 }), taskId: 'UNRELATED-TASK' },
    ];
    return route.fulfill({ json: replies[refreshes - 1] ?? createNavigation({ revision: 5 }, 1) });
  });
  try {
    await page.clock.runFor(30000);
    await expect.poll(() => refreshes).toBe(1);
    await expect(page.getByTestId('next-stop-eta')).toHaveText('09:25');
    const acceptedRoute = await routeLine(page).getAttribute('d');
    for (const count of [2, 3]) {
      const staleResponse = page.waitForResponse(response => response.url().includes('/navigation?'));
      await page.clock.runFor(30000);
      await expect.poll(() => refreshes).toBe(count);
      await (await staleResponse).finished();
      await page.clock.runFor(16);
      await expect(routeLine(page)).toHaveAttribute('d', acceptedRoute);
      await expect(page.getByTestId('task-id')).toHaveText('TASK-1');
      await expect(confirm(page)).toBeEnabled();
    }
    await page.clock.runFor(30000);
    await expect.poll(() => refreshes).toBe(4);
    await confirm(page).click();
    await expect(page.getByTestId('navigation-mode')).toHaveText('Return to hub');
    const returnRoute = await routeLine(page).getAttribute('d');
    lateRefresh.resolve();
    await lateFinished.promise;
    await page.clock.runFor(16);
    await expect(page.getByTestId('remaining-stops')).toHaveText('0');
    await expect(routeLine(page)).toHaveAttribute('d', returnRoute);
    await expect(page.getByTestId('navigation-mode')).toHaveText('Return to hub');
  } finally {
    lateRefresh.resolve();
  }
});

test('hidden pages pause polling, repeated resumes keep one timer and reloading cancels the old session', async ({ page }) => {
  await startAssignedRound(page);
  // Playwright has no cross-engine visibility toggle. Emulate the browser's
  // Page Visibility boundary only; do not invoke or inspect the app's handlers.
  async function setHidden(hidden) {
    await page.evaluate(value => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
      Object.defineProperty(document, 'visibilityState', {
        configurable: true, get: () => value ? 'hidden' : 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  }
  await page.clock.runFor(1000);
  await expect.poll(() => countServiceRequests('/position')).toBe(2);
  await setHidden(true);
  const hiddenCounts = [await countServiceRequests('/position'), await countServiceRequests('/navigation')];
  await page.clock.runFor(60000);
  expect([await countServiceRequests('/position'), await countServiceRequests('/navigation')]).toEqual(hiddenCounts);

  for (let cycle = 0; cycle < 3; cycle++) {
    await setHidden(false);
    await setHidden(true);
  }
  await setHidden(false);
  await page.clock.runFor(1000);
  const resumedCount = await countServiceRequests('/position');
  await page.clock.runFor(1000);
  await expect.poll(() => countServiceRequests('/position')).toBe(resumedCount + 1);

  // A real page reload is the existing public way to start another driver session.
  // The prior session's pending response must be canceled and cannot affect it.
  const pending = Promise.withResolvers();
  let pendingRequest;
  await page.route(positionPath, async route => {
    pendingRequest = route.request();
    await pending.promise;
    try {
      await route.fulfill({ json: { latitude: 53.3, longitude: -6.2, timestamp: '2026-11-16T10:00:00Z' } });
    } catch {
      // A navigation-aborted request is the expected result of ending this session.
    }
  }, { times: 1 });
  try {
    await page.clock.runFor(1000);
    await expect.poll(() => !!pendingRequest).toBe(true);
    const cancellation = page.waitForEvent('requestfailed', {
      predicate: request => request === pendingRequest,
    });
    await page.reload();
    await cancellation;
    pending.resolve();
    await enterDriver(page);
    await expect(page.getByTestId('task-id')).toHaveText('TASK-1');
    await expect(driverMarker(page)).toBeVisible();
  } finally {
    pending.resolve();
  }
});
