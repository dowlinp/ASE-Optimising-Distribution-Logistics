// Exercise the actual Java container over HTTP, with no browser interception.
import { test, expect } from '@playwright/test';
import { createNavigation } from './fixtures.mjs';

test('Java serves public assets, preserves forwarding contracts, times out and acknowledges fake sync', { tag: '@contracts' }, async ({ request }) => {
  for (const [path, contentType] of [
    ['/Delivery', 'text/html'],
    ['/delivery/driver.js', 'javascript'],
    ['/delivery/driver.css', 'text/css'],
    ['/delivery/vendor/leaflet/leaflet.js', 'javascript'],
    ['/delivery/vendor/leaflet/leaflet.css', 'text/css'],
    ['/delivery/vendor/leaflet/images/marker-icon.png', 'image/png'],
  ]) {
    const response = await request.get(path);
    expect.soft(response.status(), path).toBe(200);
    expect.soft(response.headers()['content-type'], path).toContain(contentType);
    expect.soft((await response.body()).length, path).toBeGreaterThan(0);
  }
  expect.soft((await request.get('/delivery/tests/fixtures.mjs')).status()).toBe(404);

  // Check all three configured services, including raw query preservation. The
  // expected payload is specified here, independently of gateway implementation.
  for (const service of ['dcm', 'routing', 'location']) {
    const path = '/__contract/echo?item=A%20B&check=1';
    const response = await request.get(`/api/${service}${path}`);
    expect.soft(response.status()).toBe(418);
    expect.soft(await response.json()).toEqual({ method: 'GET', path, body: null });
  }
  const payload = { attemptId: 'TRANSPORT-ATTEMPT', outcome: 'FAILED', proof: null };
  const posted = await request.post('/api/dcm/__contract/echo', { data: payload });
  expect.soft(posted.status()).toBe(418);
  expect.soft(posted.headers()['content-type']).toContain('application/json');
  expect.soft(await posted.text()).toBe(JSON.stringify({ method: 'POST', path: '/__contract/echo', body: payload }));

  // Use real elapsed time for the server timeout; advancing a browser clock does
  // not advance Java's HttpClient. A bounded client timeout prevents a harness hang.
  const started = performance.now();
  const timedOut = await request.get('/api/routing/__contract/slow', { timeout: 8000 });
  const elapsed = performance.now() - started;
  expect.soft(timedOut.status()).toBe(504);
  expect.soft(elapsed).toBeGreaterThanOrEqual(4500);
  expect.soft(elapsed).toBeLessThan(7500);

  // The only local business stub accepts the WHOLE navigation response and
  // acknowledges with the JSON boolean true, rather than an object or HTML page.
  const synced = await request.post('/api/sync', { data: createNavigation({ revision: 2 }) });
  expect.soft(synced.status()).toBe(200);
  expect.soft(synced.headers()['content-type']).toContain('application/json');
  expect.soft((await synced.text()).trim()).toBe('true');
  expect.soft((await request.get('/api/sync')).status()).toBe(405);
});
