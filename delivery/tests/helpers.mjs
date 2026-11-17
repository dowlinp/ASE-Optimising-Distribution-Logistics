// Shared test setup: start a known driver round and inspect calls to the fake services.
import { expect } from '@playwright/test';

// These endpoints control the fake services, not the driver application.
async function callTestService(action, body) {
  let requestOptions = {};

  if (body !== undefined) {
    requestOptions = {
      method: 'POST',
      body: JSON.stringify(body),
    };
  }

  const response = await fetch(
    `http://127.0.0.1:5091/__test/${action}`,
    requestOptions,
  );

  return response.json();
}

export function readServiceState() {
  // Return recorded API calls and outcomes so tests can check what the interface sent.
  return callTestService('state');
}

export function setServiceOptions(options) {
  // Change fake responses during a test, such as providing a refreshed route.
  return callTestService('options', options);
}

export async function openDriverPage(page, options = {}) {
  // Clear the previous test's calls and completed tasks before opening the driver screen.
  await callTestService('reset', options);

  // Freeze browser time so polling can be tested without waiting 30 real seconds.
  const startTime = new Date('2026-11-16T09:00:00Z');
  await page.clock.install({ time: startTime });
  await page.clock.pauseAt(startTime);

  // Keep map tiles deterministic and avoid external tile requests during tests.
  await page.route('https://*.tile.openstreetmap.org/**', route => {
    return route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
        'base64',
      ),
    });
  });

  // Assignment-error tests need to open the form without assuming lookup will succeed.
  await page.goto('/Delivery');
}

export async function startAssignedRound(page, options = {}) {
  await openDriverPage(page, options);
  // Start through the real form, then wait until the task, route and marker are visible.
  const driverIdInput = page.getByLabel('Driver ID', { exact: true });
  await expect(driverIdInput).toBeVisible();
  await driverIdInput.fill('DRIVER-1');
  await page.getByRole('button', { name: 'Start round', exact: true }).click();

  await expect(page.getByTestId('task-id')).toHaveText('TASK-1');
  await expect(page.locator('#map svg path.leaflet-interactive')).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Driver location', exact: true }),
  ).toBeVisible();
}

export async function countServiceRequests(pathSuffix) {
  // Ignore query parameters when counting requests to a particular endpoint.
  const serviceState = await readServiceState();
  const matchingRequests = serviceState.calls.filter(request => {
    const pathWithoutQuery = request.path.split('?')[0];
    return pathWithoutQuery.endsWith(pathSuffix);
  });

  return matchingRequests.length;
}
