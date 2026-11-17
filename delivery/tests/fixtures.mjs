// Example API responses used by driver.spec.mjs through the fake server in upstream.mjs.
// They let us test the driver screen without running real DCM or routing services.

// Every test round starts and finishes at this hub.
export const hub = {
  address: 'Dublin Hub, O’Connell Street',
  latitude: 53.3498,
  longitude: -6.2603,
};

// Default pending delivery. The signature test overrides PHOTO with SIGNATURE.
export const deliveryTask = {
  taskId: 'TASK-1',
  address: '10 Parnell Square, Dublin',
  latitude: 53.354,
  longitude: -6.263,
  instructions: 'Use the side entrance. Ring bell 4.',
  proofType: 'PHOTO',
};

// Three example points from the hub to the customer; no route is calculated here.
// GeoJSON uses [longitude, latitude], rather than [latitude, longitude].
export const outboundRouteCoordinates = [
  [-6.2603, 53.3498],
  [-6.261, 53.352],
  [-6.263, 53.354],
];

// Builds the assignment/current-round response returned by fake DCM.
// Zero completed tasks keeps TASK-1 active. Recording success or failure removes it,
// leaving no delivery tasks and allowing the interface to show the return to hub.
export function createRound(options = {}, completedTaskCount = 0, recordedOutcomes = []) {
  let activeTask = null;

  if (!completedTaskCount) {
    activeTask = {
      ...deliveryTask,
      proofType: options.proofType || 'PHOTO',
    };
  }

  return {
    roundId: 'ROUND-1',
    vehicleId: 'VAN-1',
    vehicleType: 'VAN',
    planId: 'PLAN-1',
    hub,
    activeTask,
    // Count delivery tasks only; returning to the hub is not another delivery.
    remainingStops: activeTask ? 1 : 0,
    // DCM supplies final totals; the interface must not calculate them from local clicks.
    summary: activeTask ? null : {
      succeeded: recordedOutcomes.filter(outcome => outcome.outcome === 'SUCCESS').length,
      failed: recordedOutcomes.filter(outcome => outcome.outcome === 'FAILED').length,
    },
  };
}

// Builds the route and timing response returned by the fake routing service.
// A pending delivery gets the outbound route; a completed delivery returns to the hub.
// The refresh test sets changedGeometry and revision to simulate an updated route and ETA.
export function createNavigation(options = {}, completedTaskCount = 0) {
  const round = createRound(options, completedTaskCount);
  let routeCoordinates;

  if (options.changedGeometry) {
    // A different route to the same delivery, used to test periodic refresh.
    routeCoordinates = [
      [-6.2603, 53.3498],
      [-6.266, 53.351],
      [-6.263, 53.354],
    ];
  } else if (round.activeTask) {
    routeCoordinates = outboundRouteCoordinates;
  } else {
    // Once the delivery is completed, the example route returns to the hub.
    routeCoordinates = [...outboundRouteCoordinates].reverse();
  }

  return {
    roundId: round.roundId,
    planId: round.planId,
    taskId: round.activeTask?.taskId || null,
    revision: options.revision || 1,
    mode: round.activeTask ? 'DELIVERY' : 'RETURN_TO_HUB',
    geometry: {
      type: 'LineString',
      coordinates: routeCoordinates,
    },
    // Fixed times match the frozen test clock; a newer revision has a later ETA.
    nextStopEta: options.revision > 1
      ? '2026-11-16T09:25:00Z'
      : '2026-11-16T09:15:00Z',
    estimatedFinishTime: '2026-11-16T09:40:00Z',
    remainingStops: round.remainingStops,
  };
}
