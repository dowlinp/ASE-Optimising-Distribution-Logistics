// Real thin-slice journeys. No assignment, round, navigation, position or outcome
// requests are intercepted. Photo/signature and Java's fake sync remain the POC stubs.
import { test, expect } from '@playwright/test';

function requiredSetting(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Real-provider integration requires ${name}; see delivery/tests/README.md`);
  return value;
}

function evidenceUrl(setting, ids) {
  // Providers expose read-only evidence, or a read-only adapter, using these tokens.
  // The driver application does not acquire a new evidence/logging dependency.
  return requiredSetting(setting).replace(/\{(attemptId|roundId|taskId)\}/g,
    (_, field) => encodeURIComponent(ids[field]));
}

for (const outcome of ['SUCCESS', 'FAILED']) {
  test(`real-provider ${outcome.toLowerCase()} is recorded and returns the driver to the configured hub`, async ({ page, request }, testInfo) => {
    // Each journey/engine needs a fresh seeded driver with one pending delivery.
    // Reusing an already-completed round would test seed setup, not this workflow.
    const driverId = requiredSetting(`INTEGRATION_${outcome}_DRIVER_${testInfo.project.name.toUpperCase()}`);
    requiredSetting('DCM_OUTCOME_RECORD_URL');
    if (outcome === 'FAILED') requiredSetting('DCM_FAILURE_LOG_URL');
    const isResponse = (response, path) => new URL(response.url()).pathname === path;
    await page.goto('/Delivery');
    await page.getByLabel('Driver ID', { exact: true }).fill(driverId);

    const assignmentResponse = page.waitForResponse(response =>
      isResponse(response, `/api/dcm/drivers/${encodeURIComponent(driverId)}/active-round`));
    const positionResponse = page.waitForResponse(response => /\/api\/location\/vehicles\/[^/]+\/position$/.test(new URL(response.url()).pathname));
    const navigationResponse = page.waitForResponse(response => /\/api\/routing\/rounds\/[^/]+\/navigation$/.test(new URL(response.url()).pathname));
    await page.getByRole('button', { name: 'Start round', exact: true }).click();
    const assigned = await assignmentResponse;
    expect(assigned.ok()).toBe(true);
    const round = await assigned.json();
    expect(round.remainingStops, 'Seed one pending delivery per integration driver').toBe(1);
    expect(round.activeTask).toMatchObject({ taskId: expect.any(String), proofType: expect.stringMatching(/^(PHOTO|SIGNATURE)$/) });
    expect(round.hub).toMatchObject({ address: expect.any(String), latitude: expect.any(Number), longitude: expect.any(Number) });

    const position = await positionResponse;
    expect(position.ok()).toBe(true);
    expect(new URL(position.url()).pathname).toBe(`/api/location/vehicles/${encodeURIComponent(round.vehicleId)}/position`);
    expect(await position.json()).toMatchObject({ latitude: expect.any(Number), longitude: expect.any(Number), timestamp: expect.stringMatching(/Z$/) });
    const outbound = await navigationResponse;
    expect(outbound.ok()).toBe(true);
    const navigation = await outbound.json();
    expect(navigation).toMatchObject({ roundId: round.roundId, planId: round.planId, taskId: round.activeTask.taskId, mode: 'DELIVERY', geometry: { type: 'LineString' } });
    await expect(page.getByTestId('task-id')).toHaveText(round.activeTask.taskId);
    await expect(page.getByTestId('vehicle-id')).toHaveText(round.vehicleId);
    await expect(page.locator('#map svg path.leaflet-interactive')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Driver location', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm delivery', exact: true })).toBeDisabled();

    if (outcome === 'SUCCESS') {
      await page.getByRole('button', {
        name: round.activeTask.proofType === 'SIGNATURE' ? 'Capture signature' : 'Take photo', exact: true,
      }).click();
    }
    const outcomePath = `/api/dcm/rounds/${encodeURIComponent(round.roundId)}/tasks/${encodeURIComponent(round.activeTask.taskId)}/outcomes`;
    const outcomeResponse = page.waitForResponse(response => isResponse(response, outcomePath) && response.request().method() === 'POST');
    const nextRoundResponse = page.waitForResponse(response => isResponse(response, `/api/dcm/rounds/${encodeURIComponent(round.roundId)}`));
    const returnNavigationResponse = page.waitForResponse(response => isResponse(response, `/api/routing/rounds/${encodeURIComponent(round.roundId)}/navigation`));
    await page.getByRole('button', {
      name: outcome === 'SUCCESS' ? 'Confirm delivery' : 'Failed task', exact: true,
    }).click();

    const recordedResponse = await outcomeResponse;
    expect(recordedResponse.ok()).toBe(true);
    const payload = recordedResponse.request().postDataJSON();
    expect(payload).toEqual({
      attemptId: expect.any(String), outcome,
      proof: outcome === 'SUCCESS' ? { type: round.activeTask.proofType, confirmed: true } : null,
    });
    expect(payload.attemptId.length).toBeGreaterThan(0);
    expect(await recordedResponse.json()).toMatchObject({ accepted: true, attemptId: payload.attemptId });
    const nextRound = await nextRoundResponse;
    expect(nextRound.ok()).toBe(true);
    expect(await nextRound.json()).toMatchObject({ roundId: round.roundId, activeTask: null, remainingStops: 0, hub: round.hub });
    const returnNavigation = await returnNavigationResponse;
    expect(returnNavigation.ok()).toBe(true);
    expect(await returnNavigation.json()).toMatchObject({ roundId: round.roundId, taskId: null, mode: 'RETURN_TO_HUB', remainingStops: 0 });
    await expect(page.getByTestId('navigation-mode')).toHaveText('Return to hub');
    await expect(page.getByTestId('remaining-stops')).toHaveText('0');
    await expect(page.getByText(round.hub.address, { exact: true })).toBeVisible();
    await expect(page.locator('#map svg path.leaflet-interactive')).toBeVisible();

    // The browser ACK is not sufficient evidence of persistence. Read the actual
    // provider's outcome record, and its operations log for a failed delivery.
    const ids = { attemptId: payload.attemptId, roundId: round.roundId, taskId: round.activeTask.taskId };
    for (const setting of outcome === 'FAILED'
      ? ['DCM_OUTCOME_RECORD_URL', 'DCM_FAILURE_LOG_URL'] : ['DCM_OUTCOME_RECORD_URL']) {
      let record;
      // Operations logging may be asynchronous. Wait for bounded, independently
      // observable persistence instead of depending on an arbitrary sleep.
      await expect.poll(async () => {
        const evidence = await request.get(evidenceUrl(setting, ids));
        record = evidence.ok() ? await evidence.json() : { status: evidence.status() };
        return record;
      }, { message: setting }).toMatchObject({ ...ids, outcome });
      await testInfo.attach(setting.toLowerCase(), { body: JSON.stringify(record, null, 2), contentType: 'application/json' });
    }
  });
}
