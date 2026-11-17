// First driver slice: retrieve a round, collect simulated photo proof, and confirm delivery.
const element = selector => document.querySelector(selector);
const form = element('#driver-form');
const roundSection = element('#round');
const photoButton = element('#photo-button');
const confirmButton = element('#confirm-button');
const failedButton = element('#failed-button');
const instructionsDialog = element('#instructions-dialog');

let round;
let position;
let proofConfirmed = false;
let pendingOutcome;
let submitting = false;
let outcomeAccepted = false;
let map;
let routeLayer;
let markerLayer;

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}). Please try again.`);
  }

  return response.json();
}

function showError(error) {
  const message = element('#error');
  message.textContent = error.message;
  message.hidden = false;
}

function showValue(name, value) {
  element(`[data-testid="${name}"]`).textContent = value;
}

function validPosition(value) {
  return value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
    && Math.abs(value.latitude) <= 90 && Math.abs(value.longitude) <= 180;
}

// Service responses are untrusted; check the fields needed to display or submit a task.
function validateRound(value) {
  const ids = [value?.roundId, value?.vehicleId, value?.planId];
  if (!ids.every(id => typeof id === 'string' && id.length > 0)
      || !validPosition(value.hub) || typeof value.hub.address !== 'string'
      || !Number.isInteger(value.remainingStops) || value.remainingStops < 0) {
    throw new Error('The service returned an invalid round.');
  }

  if (value.activeTask !== null) {
    const task = value.activeTask;
    if (!validPosition(task) || typeof task.taskId !== 'string'
        || typeof task.address !== 'string' || typeof task.instructions !== 'string'
        || !['PHOTO', 'SIGNATURE'].includes(task.proofType)) {
      throw new Error('The service returned an invalid delivery task.');
    }
  }
}

async function readNavigation(currentRound) {
  const coordinates = new URLSearchParams({
    latitude: position.latitude,
    longitude: position.longitude,
  });
  const navigation = await requestJson(
    `/api/routing/rounds/${encodeURIComponent(currentRound.roundId)}/navigation?${coordinates}`,
  );
  const points = navigation.geometry?.coordinates;

  if (navigation.roundId !== currentRound.roundId
      || navigation.taskId !== (currentRound.activeTask?.taskId ?? null)
      || navigation.geometry?.type !== 'LineString' || !Array.isArray(points)
      || points.length < 2 || !points.every(point => Array.isArray(point)
        && validPosition({ longitude: point[0], latitude: point[1] }))
      || !Number.isFinite(Date.parse(navigation.nextStopEta))
      || !Number.isFinite(Date.parse(navigation.estimatedFinishTime))) {
    throw new Error('The service returned invalid navigation.');
  }

  return navigation;
}

// Reuse the map between tasks, replacing the route and markers with service-supplied data.
function displayMap(navigation) {
  if (!map) {
    map = L.map('map', { scrollWheelZoom: false })
      .setView([round.hub.latitude, round.hub.longitude], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
  }

  if (routeLayer) {
    routeLayer.remove();
  }
  routeLayer = L.geoJSON(navigation.geometry, {
    style: { color: '#175d54', weight: 5 },
  }).addTo(map);

  markerLayer.clearLayers();
  L.marker([round.hub.latitude, round.hub.longitude], {
    alt: 'Hub', keyboard: false, interactive: false,
  }).addTo(markerLayer);
  if (round.activeTask) {
    L.marker([round.activeTask.latitude, round.activeTask.longitude], {
      alt: 'Delivery destination', keyboard: false, interactive: false,
    }).addTo(markerLayer);
  }
  const driver = L.marker([position.latitude, position.longitude], {
    alt: 'Driver location',
    keyboard: false,
    interactive: false,
    zIndexOffset: 1000,
  }).addTo(markerLayer);
  driver.getElement().classList.add('driver-marker');

  map.invalidateSize();
  map.fitBounds(routeLayer.getBounds(), { padding: [30, 30], animate: false });
}

function renderRound(navigation) {
  roundSection.hidden = false;
  const task = round.activeTask;
  const formatTime = value => new Date(value).toLocaleTimeString('en-IE', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Dublin',
  });

  showValue('vehicle-id', round.vehicleId);
  showValue('round-id', round.roundId);
  showValue('task-id', task?.taskId ?? '');
  showValue('navigation-mode', task ? 'Delivery' : 'Return to hub');
  showValue('next-stop-eta', formatTime(navigation.nextStopEta));
  showValue('estimated-finish-time', formatTime(navigation.estimatedFinishTime));
  showValue('remaining-stops', round.remainingStops);

  // Show DCM's final counts without replacing the navigation back to the hub.
  const summaryPanel = element('#round-summary');
  summaryPanel.hidden = !!task || round.remainingStops !== 0;
  if (!summaryPanel.hidden) {
    const summary = round.summary;
    const validTotals = Number.isInteger(summary?.succeeded) && summary.succeeded >= 0
      && Number.isInteger(summary?.failed) && summary.failed >= 0;
    showValue('succeeded-count', validTotals ? summary.succeeded : 'Unavailable');
    showValue('failed-count', validTotals ? summary.failed : 'Unavailable');
  }

  element('#destination').textContent = task?.address ?? round.hub.address;
  element('#task').hidden = !task;
  element('#instructions-button').hidden = !task;
  photoButton.hidden = task?.proofType !== 'PHOTO';
  element('#proof-status').textContent = task?.proofType === 'SIGNATURE'
    ? 'Signature required.' : 'Take a photo before confirming this delivery.';
  confirmButton.disabled = true;
  displayMap(navigation);
}

// Resolve the driver's assigned vehicle and round before requesting position and navigation.
form.addEventListener('submit', async event => {
  event.preventDefault();
  const startButton = form.querySelector('button');
  startButton.disabled = true;
  element('#error').hidden = true;

  try {
    const driverId = element('#driver-id').value.trim();
    if (!driverId) {
      throw new Error('Enter a driver ID.');
    }
    const assignedRound = await requestJson(
      `/api/dcm/drivers/${encodeURIComponent(driverId)}/active-round`,
    );
    validateRound(assignedRound);
    const initialPosition = await requestJson(
      `/api/location/vehicles/${encodeURIComponent(assignedRound.vehicleId)}/position`,
    );
    if (!validPosition(initialPosition)) {
      throw new Error('The service returned an invalid driver position.');
    }
    position = initialPosition;
    const navigation = await readNavigation(assignedRound);
    round = assignedRound;
    proofConfirmed = false;
    pendingOutcome = undefined;
    outcomeAccepted = false;
    form.hidden = true;
    renderRound(navigation);
  } catch (error) {
    showError(error);
  } finally {
    startButton.disabled = false;
  }
});

// Photo capture is deliberately simulated for the POC; no file is captured or uploaded.
function takePhoto() {
  return true;
}

photoButton.addEventListener('click', () => {
  proofConfirmed = takePhoto();
  element('#proof-status').textContent = 'Photo recorded.';
  confirmButton.disabled = !proofConfirmed || submitting || outcomeAccepted;
});

async function submitOutcome(outcome) {
  if (!round?.activeTask || submitting || outcomeAccepted
      || (pendingOutcome && pendingOutcome.outcome !== outcome)
      || (outcome === 'SUCCESS' && (!proofConfirmed || round.activeTask.proofType !== 'PHOTO'))) {
    return;
  }
  submitting = true;
  confirmButton.disabled = true;
  photoButton.disabled = true;
  failedButton.disabled = true;
  element('#error').hidden = true;

  try {
    // Retry the same payload if an acknowledgement is lost; do not switch outcomes.
    pendingOutcome ||= {
      attemptId: crypto.getRandomValues(new Uint32Array(4)).join('-'),
      outcome,
      proof: outcome === 'SUCCESS' ? { type: 'PHOTO', confirmed: true } : null,
    };
    const acknowledgement = await requestJson(
      `/api/dcm/rounds/${encodeURIComponent(round.roundId)}/tasks/${encodeURIComponent(round.activeTask.taskId)}/outcomes`,
      {
        method: 'POST',
        body: JSON.stringify(pendingOutcome),
      },
    );
    if (acknowledgement.accepted !== true || acknowledgement.attemptId !== pendingOutcome.attemptId) {
      throw new Error('The delivery has not been acknowledged.');
    }
    // Once acknowledged, keep submission locked even if fetching the next state fails.
    outcomeAccepted = true;

    // DCM determines the next task; routing supplies its route or the return to the hub.
    const nextRound = await requestJson(`/api/dcm/rounds/${encodeURIComponent(round.roundId)}`);
    validateRound(nextRound);
    const nextNavigation = await readNavigation(nextRound);
    round = nextRound;
    proofConfirmed = false;
    pendingOutcome = undefined;
    outcomeAccepted = false;
    renderRound(nextNavigation);
  } catch (error) {
    showError(error);
  } finally {
    submitting = false;
    photoButton.disabled = !!pendingOutcome || outcomeAccepted;
    confirmButton.disabled = !proofConfirmed || outcomeAccepted || pendingOutcome?.outcome === 'FAILED';
    failedButton.disabled = outcomeAccepted || pendingOutcome?.outcome === 'SUCCESS';
  }
}

confirmButton.addEventListener('click', () => submitOutcome('SUCCESS'));
failedButton.addEventListener('click', () => submitOutcome('FAILED'));

element('#instructions-button').addEventListener('click', () => {
  element('#instructions-text').textContent = round.activeTask.instructions;
  instructionsDialog.showModal();
});
element('#close-instructions').addEventListener('click', () => instructionsDialog.close());
