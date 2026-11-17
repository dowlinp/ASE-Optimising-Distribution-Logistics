// Fake external HTTP APIs for the tests; this does not implement the real backend services.
import http from 'node:http';
import { createRound, createNavigation } from './fixtures.mjs';

// One small HTTP server stands in for DCM, routing and simulated location.
export function startFakeServices(port = 5091) {
  let options = {};
  let calls = [];
  let outcomes = [];
  // Remember attempt IDs so retrying the same outcome does not complete the task twice.
  let recordedAttempts = new Map();
  let completedTaskCount = 0;

  const server = http.createServer(async (request, response) => {
    // Read the submitted JSON, such as a delivery outcome or a test-control command.
    const bodyChunks = [];
    for await (const chunk of request) {
      bodyChunks.push(chunk);
    }

    let body = null;
    try {
      const bodyText = Buffer.concat(bodyChunks).toString();
      body = JSON.parse(bodyText || 'null');
    } catch {
      // Keep the existing null-body behaviour for invalid JSON.
    }

    const path = request.url.split('?')[0];

    function sendJson(statusCode, value) {
      response.writeHead(statusCode, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(value));
    }

    // Test-only controls reset the scenario, change responses, or inspect calls.
    if (path === '/__test/reset') {
      options = body || {};
      calls = [];
      outcomes = [];
      recordedAttempts = new Map();
      completedTaskCount = 0;
      return sendJson(200, true);
    }

    if (path === '/__test/options') {
      Object.assign(options, body);
      return sendJson(200, true);
    }

    if (path === '/__test/state') {
      return sendJson(200, {
        options,
        calls,
        outcomes,
        completed: completedTaskCount,
        failures: outcomes.filter(outcome => outcome.outcome === 'FAILED'),
      });
    }

    calls.push({ method: request.method, path: request.url, body });

    // Transport probes are test-provider endpoints, not application routes. The
    // unusual status and echoed bytes expose gateways that rewrite errors/bodies.
    if (path === '/__contract/echo') {
      return sendJson(418, { method: request.method, path: request.url, body });
    }
    if (path === '/__contract/slow') {
      // Longer than the host's specified five-second timeout. Other requests can
      // still be handled while this one waits; no application timer is mocked.
      setTimeout(() => sendJson(200, { late: true }), 6500).unref();
      return;
    }

    // Driver lookup returns the one vehicle and round assigned in the fixture data.
    if (path.includes('/drivers/')) {
      return sendJson(200, createRound(options, completedTaskCount, outcomes));
    }

    if (path.endsWith('/outcomes')) {
      // The error-handling test uses this option to reject an otherwise valid submission.
      if (options.outcomeStatus) {
        return sendJson(options.outcomeStatus, { error: 'Outcome rejected' });
      }

      if (!body?.attemptId || !['SUCCESS', 'FAILED'].includes(body.outcome)) {
        return sendJson(400, { error: 'Invalid outcome' });
      }

      const attemptWasRecorded = recordedAttempts.has(body.attemptId);
      const submittedPayload = JSON.stringify(body);

      if (attemptWasRecorded && recordedAttempts.get(body.attemptId) !== submittedPayload) {
        return sendJson(409, { error: 'Attempt payload changed' });
      }

      if (!attemptWasRecorded) {
        const currentRound = createRound(options, completedTaskCount);
        const requiredProofType = currentRound.activeTask?.proofType;

        if (body.outcome === 'SUCCESS') {
          // Successful delivery needs the task's required photo or signature acknowledgement.
          const hasRequiredProof = body.proof?.type === requiredProofType
            && body.proof?.confirmed === true;

          if (!hasRequiredProof) {
            return sendJson(422, { error: 'Required proof missing' });
          }
        }

        if (body.outcome === 'FAILED') {
          // Failure advances this POC round without proof or a failure reason.
          if (body.proof !== null || 'failureReason' in body) {
            return sendJson(422, { error: 'Unexpected failure proof/reason' });
          }
        }

        // A repeated attempt is acknowledged without advancing the round again.
        recordedAttempts.set(body.attemptId, submittedPayload);
        completedTaskCount++;
        outcomes.push(body);
      }

      return sendJson(200, { accepted: true, attemptId: body.attemptId });
    }

    if (path.endsWith('/navigation')) {
      // Return the outbound, refreshed or return-to-hub route selected by the fixtures.
      return sendJson(200, createNavigation(options, completedTaskCount));
    }

    if (path.endsWith('/position')) {
      // The polling test switches positionIndex to move between two fixed sample locations.
      return sendJson(200, {
        latitude: options.positionIndex ? 53.352 : 53.3498,
        longitude: options.positionIndex ? -6.261 : -6.2603,
        timestamp: options.positionIndex
          ? '2026-11-16T09:00:02Z'
          : '2026-11-16T09:00:00Z',
      });
    }

    if (path === '/rounds/ROUND-1') {
      // After an accepted outcome, this response tells the interface that no tasks remain.
      return sendJson(200, createRound(options, completedTaskCount, outcomes));
    }

    return sendJson(404, { error: 'Not found' });
  });

  return new Promise(resolve => {
    server.listen(port, '0.0.0.0', () => resolve(server));
  });
}
