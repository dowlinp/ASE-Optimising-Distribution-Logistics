// Browser acceptance tests for the driver interface, using fake external services.
// Each test checks visible behaviour and the API requests sent by the interface.
import { test, expect } from '@playwright/test';
import {
  startAssignedRound,
  setServiceOptions,
  readServiceState,
  countServiceRequests,
} from './helpers.mjs';
import { createNavigation } from './fixtures.mjs';

test('driver completes a photo-required delivery and receives the return-to-hub route', async ({ page }) => {
  // Checks the displayed plan, required photo, successful confirmation and return to the hub.
  await startAssignedRound(page);

  // Final totals are shown only after the last task has been acknowledged.
  await expect(page.getByRole('region', { name: 'Round summary', exact: true })).not.toBeVisible();

  await expect(page.getByTestId('vehicle-id')).toHaveText('VAN-1');
  await expect(page.getByTestId('round-id')).toHaveText('ROUND-1');
  await expect(page.getByTestId('next-stop-eta')).toContainText('09:15');
  await expect(page.getByTestId('estimated-finish-time')).toContainText('09:40');
  await expect(page.getByTestId('remaining-stops')).toHaveText('1');
  await expect(page.getByRole('img', { name: 'Hub', exact: true })).toBeVisible();

  // Instructions must be available below the map.
  const instructionsButton = page.getByRole('button', {
    name: 'Delivery instructions',
    exact: true,
  });
  const mapBounds = await page.locator('#map').boundingBox();
  const instructionsBounds = await instructionsButton.boundingBox();

  expect(instructionsBounds.y).toBeGreaterThanOrEqual(mapBounds.y + mapBounds.height);

  await instructionsButton.click();
  await expect(page.getByRole('dialog')).toContainText(
    'Use the side entrance. Ring bell 4.',
  );
  await page.getByRole('button', { name: 'Close instructions', exact: true }).click();

  // Check the basic phone layout and confirmation touch target.
  const fitsPhoneWidth = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= innerWidth;
  });
  expect(fitsPhoneWidth).toBe(true);

  const confirmButton = page.getByRole('button', {
    name: 'Confirm delivery',
    exact: true,
  });
  const confirmButtonBounds = await confirmButton.boundingBox();
  expect(confirmButtonBounds.height).toBeGreaterThanOrEqual(44);

  // Confirmation requires the task's photo acknowledgement.
  await expect(confirmButton).toBeDisabled();
  await page.getByRole('button', { name: 'Take photo', exact: true }).click();
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  // This is the last delivery, so the acknowledged outcome leads back to the hub.
  await expect(page.getByTestId('navigation-mode')).toHaveText('Return to hub');
  await expect(page.getByTestId('remaining-stops')).toHaveText('0');

  const summary = page.getByRole('region', { name: 'Round summary', exact: true });
  await expect(summary).toBeVisible();
  await expect(summary.getByTestId('succeeded-count')).toHaveText('1');
  await expect(summary.getByTestId('failed-count')).toHaveText('0');
  await expect(page.locator('#map svg path.leaflet-interactive')).toBeVisible();

  const serviceState = await readServiceState();
  expect(serviceState.outcomes).toEqual([
    {
      attemptId: expect.any(String),
      outcome: 'SUCCESS',
      proof: { type: 'PHOTO', confirmed: true },
    },
  ]);

  const outcomeRequest = serviceState.calls.find(request => {
    return request.path.endsWith('/outcomes');
  });
  expect(outcomeRequest.path).toBe('/rounds/ROUND-1/tasks/TASK-1/outcomes');
});

test('signature-required delivery uses signature instead of photo', async ({ page }) => {
  // Checks that a signature-required task accepts signature proof instead of a photo.
  await startAssignedRound(page, { proofType: 'SIGNATURE' });

  const confirmButton = page.getByRole('button', {
    name: 'Confirm delivery',
    exact: true,
  });

  // The task determines the proof type; the driver cannot choose a photo instead.
  await expect(confirmButton).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Take photo', exact: true }),
  ).not.toBeVisible();

  await page.getByRole('button', { name: 'Capture signature', exact: true }).click();
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect(page.getByTestId('navigation-mode')).toHaveText('Return to hub');

  const serviceState = await readServiceState();
  expect(serviceState.outcomes).toEqual([
    {
      attemptId: expect.any(String),
      outcome: 'SUCCESS',
      proof: { type: 'SIGNATURE', confirmed: true },
    },
  ]);
});

test('failed delivery advances without proof or reason and is sent to DCM', async ({ page }) => {
  // Checks that reporting failure advances the round without proof or a failure reason.
  await startAssignedRound(page, { proofType: 'SIGNATURE' });
  await page.getByRole('button', { name: 'Failed task', exact: true }).click();

  await expect(page.getByTestId('navigation-mode')).toHaveText('Return to hub');
  await expect(page.getByTestId('remaining-stops')).toHaveText('0');

  // A failed final task appears in the summary while the return route stays visible.
  const summary = page.getByRole('region', { name: 'Round summary', exact: true });
  await expect(summary).toBeVisible();
  await expect(summary.getByTestId('succeeded-count')).toHaveText('0');
  await expect(summary.getByTestId('failed-count')).toHaveText('1');
  await expect(page.locator('#map svg path.leaflet-interactive')).toBeVisible();

  const serviceState = await readServiceState();
  expect(serviceState.failures).toEqual([
    {
      attemptId: expect.any(String),
      outcome: 'FAILED',
      proof: null,
    },
  ]);
});

test('external coordinates move the marker and periodic refresh passes the updated route to sync', async ({ page }) => {
  // Checks location polling and route refresh while preserving the active task and its proof.
  await startAssignedRound(page);

  const driverMarker = page.getByRole('img', {
    name: 'Driver location',
    exact: true,
  });
  const initialMarkerBounds = await driverMarker.boundingBox();
  const initialPositionRequestCount = await countServiceRequests('/position');

  // The fake location and routing services now have updated data to return.
  await setServiceOptions({
    positionIndex: 1,
    revision: 2,
    changedGeometry: true,
  });

  // Position polling happens at one second, not before it.
  await page.clock.runFor(999);
  expect(await countServiceRequests('/position')).toBe(initialPositionRequestCount);

  await page.clock.runFor(1);
  await expect.poll(() => countServiceRequests('/position')).toBe(
    initialPositionRequestCount + 1,
  );
  await expect.poll(async () => {
    const currentMarkerBounds = await driverMarker.boundingBox();
    return currentMarkerBounds.y;
  }).not.toBe(initialMarkerBounds.y);

  // A route refresh must preserve proof already captured for this task.
  await page.getByRole('button', { name: 'Take photo', exact: true }).click();

  const routeLine = page.locator('#map svg path.leaflet-interactive');
  const initialRoutePath = await routeLine.getAttribute('d');
  const syncRequestPromise = page.waitForRequest(request => {
    return request.url().endsWith('/api/sync') && request.method() === 'POST';
  });

  // One second has elapsed; advance the remaining 29 seconds to the refresh.
  await page.clock.runFor(29000);

  const syncRequest = await syncRequestPromise;
  const expectedNavigation = createNavigation({
    revision: 2,
    changedGeometry: true,
  });
  expect(syncRequest.postDataJSON()).toEqual(expectedNavigation);

  const syncResponse = await syncRequest.response();
  expect(syncResponse.status()).toBe(200);
  expect(await syncResponse.json()).toBe(true);

  await expect(page.getByTestId('next-stop-eta')).toContainText('09:25');
  await expect(routeLine).not.toHaveAttribute('d', initialRoutePath);
  await expect(page.getByTestId('task-id')).toHaveText('TASK-1');
  await expect(
    page.getByRole('button', { name: 'Confirm delivery', exact: true }),
  ).toBeEnabled();
});

test('unacknowledged outcome leaves the current task in place', async ({ page }) => {
  // Checks that a rejected submission shows an error and keeps the current task pending.
  await startAssignedRound(page, { outcomeStatus: 503 });
  await page.getByRole('button', { name: 'Take photo', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delivery', exact: true }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('task-id')).toHaveText('TASK-1');
  await expect(page.getByTestId('remaining-stops')).toHaveText('1');

  const serviceState = await readServiceState();
  expect(serviceState.outcomes).toEqual([]);
});

test('accepted outcome can retry round and route reads without resubmitting delivery', async ({ page }) => {
  // Fail each follow-up read once, after the outcome has already been saved by DCM.
  await startAssignedRound(page);
  let failRoundRead = true;
  let failRouteRead = true;

  await page.route('**/api/dcm/rounds/ROUND-1', route => {
    if (failRoundRead) {
      failRoundRead = false;
      return route.fulfill({ status: 503, json: { error: 'Round temporarily unavailable' } });
    }
    return route.continue();
  });
  await page.route('**/api/routing/rounds/ROUND-1/navigation?*', route => {
    if (failRouteRead) {
      failRouteRead = false;
      return route.fulfill({ status: 503, json: { error: 'Route temporarily unavailable' } });
    }
    return route.continue();
  });

  await page.getByRole('button', { name: 'Take photo', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delivery', exact: true }).click();

  const retryButton = page.getByRole('button', { name: 'Retry', exact: true });
  await expect(page.getByRole('alert')).toContainText('Your update was saved');
  await expect(retryButton).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm delivery', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Failed task', exact: true })).toBeDisabled();

  // The first retry gets the round, but the route is still unavailable.
  await retryButton.click();
  await expect(retryButton).toBeEnabled();
  await expect.poll(() => countServiceRequests('/rounds/ROUND-1')).toBe(1);
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await countServiceRequests('/outcomes')).toBe(1);

  // The second retry recovers the return route and summary without another POST.
  await retryButton.click();
  await expect(page.getByTestId('navigation-mode')).toHaveText('Return to hub');
  await expect(page.getByTestId('succeeded-count')).toHaveText('1');
  await expect(page.getByTestId('failed-count')).toHaveText('0');
  await expect(retryButton).not.toBeVisible();
  await expect(page.getByRole('alert')).not.toBeVisible();
  expect(await countServiceRequests('/outcomes')).toBe(1);
  expect((await readServiceState()).completed).toBe(1);
});
