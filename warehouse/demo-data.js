/* Browser-only sample state. Function names follow Warehouse-APIs.md; no HTTP contract is assumed. */
function createWarehouseDemo() {
  const state = {
    incoming: [
      { id: 'SUP-1042', supplier: 'Northstar Supply', supplierId: 'SUP-NORTH', tracking: 'NS-804219', eta: 'Today · 10:30–12:00', estimate: 'current', received: false, items: ['ITM-201', 'ITM-202', 'ITM-203'] },
      { id: 'SUP-1043', supplier: 'Greenline Goods', supplierId: 'SUP-GREEN', tracking: 'GL-392810', eta: 'Arrival estimate unavailable', estimate: 'missing', received: false, items: ['ITM-204', 'ITM-205'] },
      { id: 'SUP-1041', supplier: 'Atlas Home', supplierId: 'SUP-ATLAS', tracking: 'AT-721184', eta: 'Received · Dock 02', estimate: 'current', received: true, items: ['ITM-206', 'ITM-207'] }
    ],
    items: [
      { id: 'ITM-201', name: 'Ceramic desk lamp', product: 'PRD-LAMP', supplier: 'SUP-NORTH', order: 'ORD-501', state: 'Expected', location: null, handling: 'Fragile · Keep upright' },
      { id: 'ITM-202', name: 'Linen cushion', product: 'PRD-CUSHION', supplier: 'SUP-NORTH', order: 'ORD-501', state: 'Expected', location: null, handling: 'Keep dry' },
      { id: 'ITM-203', name: 'Oak desk organiser', product: 'PRD-DESK', supplier: 'SUP-NORTH', order: 'ORD-502', state: 'Expected', location: null, handling: 'Standard handling' },
      { id: 'ITM-204', name: 'Cotton throw', product: 'PRD-THROW', supplier: 'SUP-GREEN', order: 'ORD-503', state: 'Expected', location: null, handling: 'Keep dry' },
      { id: 'ITM-205', name: 'Cotton throw', product: 'PRD-THROW', supplier: 'SUP-GREEN', order: 'ORD-504', state: 'Expected', location: null, handling: 'Keep dry' },
      { id: 'ITM-206', name: 'Glass carafe', product: 'PRD-CARAFE', supplier: 'SUP-ATLAS', order: 'ORD-505', state: 'Awaiting storage', location: null, handling: 'Fragile · Keep upright' },
      { id: 'ITM-207', name: 'Woven basket', product: 'PRD-BASKET', supplier: 'SUP-ATLAS', order: 'ORD-505', state: 'Awaiting storage', location: null, handling: 'Standard handling' },
      { id: 'ITM-208', name: 'Stoneware mug set', product: 'PRD-MUG', supplier: 'SUP-ATLAS', order: 'ORD-506', state: 'Stored', location: 'A-02-03', handling: 'Fragile · Use protective wrap' },
      { id: 'ITM-209', name: 'Linen table runner', product: 'PRD-RUNNER', supplier: 'SUP-NORTH', order: 'ORD-506', state: 'Stored', location: 'B-01-02', handling: 'Keep dry' },
      { id: 'ITM-210', name: 'Oak serving board', product: 'PRD-BOARD', supplier: 'SUP-NORTH', order: 'ORD-507', state: 'Stored', location: 'B-03-01', handling: 'Standard handling' },
      { id: 'ITM-211', name: 'Glass vase', product: 'PRD-VASE', supplier: 'SUP-ATLAS', order: 'ORD-508', state: 'Packed', location: 'Dispatch D-01', handling: 'Fragile · Keep upright', packageId: 'PKG-0841' },
      { id: 'ITM-212', name: 'Wool blanket', product: 'PRD-BLANKET', supplier: 'SUP-GREEN', order: 'ORD-509', state: 'Packed', location: 'Dispatch D-02', handling: 'Keep dry', packageId: 'PKG-0842' },
      { id: 'ITM-213', name: 'Desk mat', product: 'PRD-MAT', supplier: 'SUP-NORTH', order: 'ORD-510', state: 'Loaded', location: 'VAN-03', handling: 'Standard handling', packageId: 'PKG-0843' },
      { id: 'ITM-214', name: 'Reading light', product: 'PRD-LIGHT', supplier: 'SUP-NORTH', order: 'ORD-511', state: 'Packed', location: 'Dispatch D-03', handling: 'Standard handling', packageId: 'PKG-0844' },
      { id: 'ITM-215', name: 'Storage jar', product: 'PRD-JAR', supplier: 'SUP-ATLAS', order: 'ORD-512', state: 'Return expected', location: null, handling: 'Fragile', packageId: 'PKG-0830' },
      { id: 'ITM-216', name: 'Cotton bath towel', product: 'PRD-TOWEL', supplier: 'SUP-GREEN', order: 'ORD-513', state: 'Awaiting checks', location: 'Returns R-01', handling: 'Condition check required', packageId: 'PKG-0828' },
      { id: 'ITM-217', name: 'Amber glass tumbler', product: 'PRD-TUMBLER', supplier: 'SUP-ATLAS', order: 'ORD-514', state: 'Investigation', location: 'A-04-02', handling: 'Not found during picking', packageId: 'PKG-0840' }
    ],
    requests: [
      { id: 'REQ-0312', items: ['ITM-208', 'ITM-209'], destination: 'Dublin 8', address: '18 Camden Row, Dublin 8', eligibility: 'Released for packing', packageId: null },
      { id: 'REQ-0313', items: ['ITM-210'], destination: 'Dublin 6', address: '42 Rathmines Road, Dublin 6', eligibility: 'Released for packing', packageId: null }
    ],
    packages: [
      { id: 'PKG-0841', items: ['ITM-211'], scanned: ['ITM-211'], missing: [], destination: 'Dublin 2', address: '24 Pearse Street, Dublin 2', state: 'Ready', vehicle: 'VAN-01', location: 'Dispatch D-01', handling: 'Fragile · Keep upright', weight: 2.4, dimensions: [30, 25, 40] },
      { id: 'PKG-0842', items: ['ITM-212'], scanned: ['ITM-212'], missing: [], destination: 'Dublin 4', address: '9 Herbert Road, Dublin 4', state: 'Ready', vehicle: null, location: 'Dispatch D-02', handling: 'Keep dry', weight: 1.8, dimensions: [40, 30, 20] },
      { id: 'PKG-0843', items: ['ITM-213'], scanned: ['ITM-213'], missing: [], destination: 'Dublin 6', address: '6 Ranelagh Road, Dublin 6', state: 'Loaded', vehicle: 'VAN-03', location: 'VAN-03', handling: 'Standard handling', weight: 1.2, dimensions: [50, 25, 10] },
      { id: 'PKG-0844', items: ['ITM-214'], scanned: ['ITM-214'], missing: [], destination: 'Dublin 8', address: '11 Thomas Street, Dublin 8', state: 'Ready', vehicle: 'VAN-01', location: 'Dispatch D-03', handling: 'Standard handling', weight: 2, dimensions: [35, 20, 20] },
      { id: 'PKG-0840', items: ['ITM-217'], scanned: [], missing: ['ITM-217'], destination: 'Dublin 1', address: '5 Parnell Square, Dublin 1', state: 'On hold', vehicle: null, location: 'Packing P-02', handling: 'Missing item · Supervisor review required' },
      { id: 'PKG-0830', items: ['ITM-215'], scanned: ['ITM-215'], missing: [], destination: 'Dublin 3', address: '14 Clontarf Road, Dublin 3', state: 'Return expected', vehicle: null, location: 'In return transit', handling: 'Customer return · RET-0120', returnRef: 'RET-0120' },
      { id: 'PKG-0828', items: ['ITM-216'], scanned: ['ITM-216'], missing: [], destination: 'Dublin 7', address: '28 Manor Street, Dublin 7', state: 'Awaiting checks', vehicle: null, location: 'Returns R-01', handling: 'Failed delivery · Contents and condition checks required', returnRef: 'RET-0118' }
    ],
    vehicles: [
      { id: 'VAN-01', round: 'RND-071', name: 'East city round', destinations: ['Dublin 2', 'Dublin 4', 'Dublin 8'], dock: 'Bay 01', capacity: 12, available: true },
      { id: 'VAN-02', round: 'RND-072', name: 'North city round', destinations: ['Dublin 1', 'Dublin 3', 'Dublin 7'], dock: 'Bay 02', capacity: 10, available: true },
      { id: 'VAN-03', round: 'RND-073', name: 'South city round', destinations: ['Dublin 6'], dock: 'Bay 03', capacity: 8, available: true }
    ],
    activity: [{ text: 'PKG-0843 scanned onto VAN-03', time: 'Sample activity' }, { text: 'SUP-1041 received at Dock 02', time: 'Sample activity' }, { text: 'PKG-0841 ready for loading', time: 'Sample activity' }]
  };
  const find = (list, id, label) => {
    const value = list.find(entry => entry.id === String(id).trim().toUpperCase());
    if (!value) throw new Error(`Unknown ${label}: ${id}. Check the scanned ID.`);
    return value;
  };
  const item = id => find(state.items, id, 'item');
  const pkg = id => find(state.packages, id, 'package');
  const vehicle = id => find(state.vehicles, id, 'vehicle');
  const log = text => state.activity.unshift({ text, time: 'Just now · Demo action' });
  let nextPackage = 845;

  return {
    state,
    getIncomingPackages(itemIds) {
      return { packages: state.incoming.filter(p => p.items.some(id => itemIds.includes(id))), unregistered: itemIds.filter(id => !state.incoming.some(p => p.items.includes(id))) };
    },
    receiveIncomingPackage(id) {
      const incoming = find(state.incoming, id, 'supplier package');
      if (incoming.received) return { incoming, duplicate: true };
      incoming.received = true;
      incoming.items.forEach(id => { item(id).state = 'Awaiting storage'; });
      log(`${incoming.id} received; individual items still need storage confirmation`);
      return { incoming, duplicate: false };
    },
    matchUnlabelledItem(supplierId, productId, quantity) {
      const count = Number(quantity);
      if (!Number.isInteger(count) || count < 1) throw new Error('Enter a positive whole quantity.');
      const matches = state.items.filter(i => i.supplier === supplierId && i.product === String(productId).trim().toUpperCase() && i.state === 'Awaiting storage');
      if (count > matches.length) throw new Error('Quantity exceeds the outstanding items in received supplier packages. Check the supplier, product and quantity.');
      if (count < matches.length) throw new Error('More than one item allocation is possible. Ask a supervisor to review before storage.');
      return matches;
    },
    assignStorageLocation(id) {
      const current = item(id);
      if (current.state !== 'Awaiting storage') throw new Error('Only items awaiting storage can receive an assignment.');
      if (!current.assigned) current.assigned = `C-01-${String(state.items.indexOf(current) + 1).padStart(2, '0')}`;
      return current;
    },
    confirmItemStored(id, locationId) {
      const current = item(id);
      const location = String(locationId).trim().toUpperCase();
      if (current.state === 'Stored' && current.location === location) return { item: current, duplicate: true };
      if (current.state !== 'Awaiting storage' || !current.assigned) throw new Error('Request a storage assignment before confirming placement.');
      if (location !== current.assigned) throw new Error(`Wrong location. Place this item at ${current.assigned} and scan that location.`);
      current.location = location;
      current.state = 'Stored';
      log(`${current.id} stored at ${location}`);
      return { item: current, duplicate: false };
    },
    getPackagingRequest() {
      return state.requests.find(request => !request.packageId && request.items.every(id => item(id).state === 'Stored')) || null;
    },
    createPackage(requestId) {
      const request = find(state.requests, requestId, 'packing request');
      if (request.packageId) {
        const existing = pkg(request.packageId);
        if (existing.state !== 'Packing' && existing.state !== 'On hold') throw new Error('This packing request has already been completed.');
        return existing;
      }
      if (!request.items.every(id => item(id).state === 'Stored')) throw new Error('All requested items must be in storage before packing.');
      const created = { id: `PKG-${String(nextPackage++).padStart(4, '0')}`, requestId, items: [...request.items], scanned: [], missing: [], destination: request.destination, address: request.address, state: 'Packing', vehicle: null, location: 'Packing P-01', handling: [...new Set(request.items.map(id => item(id).handling))].join(' · ') };
      request.packageId = created.id;
      state.packages.unshift(created);
      created.items.forEach(id => { item(id).packageId = created.id; item(id).state = 'Awaiting packing'; });
      log(`${created.id} created for ${request.destination}`);
      return created;
    },
    addItemToPackage(packageId, itemId) {
      const current = pkg(packageId);
      const scannedItem = item(itemId);
      if (current.state !== 'Packing') throw new Error('This package is closed or on hold. Resolve exceptions before scanning.');
      if (!current.items.includes(scannedItem.id)) throw new Error('Wrong item. This item is not expected in this package.');
      if (current.scanned.includes(scannedItem.id)) return { package: current, duplicate: true };
      if (scannedItem.packageId !== current.id || scannedItem.state !== 'Awaiting packing') throw new Error('This item is unavailable or allocated to another package.');
      current.scanned.push(scannedItem.id);
      scannedItem.state = 'Packed';
      scannedItem.location = current.location;
      log(`${scannedItem.id} scanned into ${current.id}`);
      return { package: current, duplicate: false };
    },
    reportMissingItem(packageId, itemId) {
      const current = pkg(packageId);
      const missingItem = item(itemId);
      if (current.state !== 'Packing') throw new Error('Missing items can only be reported during active packing.');
      if (!current.items.includes(missingItem.id) || current.scanned.includes(missingItem.id)) throw new Error('Only an outstanding expected item can be reported missing.');
      current.missing.push(missingItem.id);
      current.state = 'On hold';
      missingItem.state = 'Investigation';
      log(`${current.id} on hold: ${missingItem.id} reported missing`);
      return current;
    },
    setPackageReady(packageId, weight, dimensions) {
      const current = pkg(packageId);
      if (current.state !== 'Packing' || current.missing.length || current.scanned.length !== current.items.length) throw new Error('Scan every required item and resolve all discrepancies before marking ready.');
      if (!Number.isFinite(Number(weight)) || Number(weight) <= 0 || !Array.isArray(dimensions) || dimensions.length !== 3 || dimensions.some(n => !Number.isFinite(Number(n)) || Number(n) <= 0)) throw new Error('Enter a positive weight and all three positive dimensions.');
      current.weight = Number(weight);
      current.dimensions = dimensions.map(Number);
      current.state = 'Ready';
      current.location = 'Dispatch D-04';
      current.items.forEach(id => { item(id).location = current.location; });
      log(`${current.id} ready for vehicle allocation`);
      return current;
    },
    assignPackagesToVehicles(packageIds, vehicleIds) {
      if (!packageIds.length || !vehicleIds.length) throw new Error('Choose packages and at least one vehicle.');
      const vehicles = vehicleIds.map(vehicle);
      const assigned = [], unresolved = [];
      for (const id of [...new Set(packageIds)]) {
        const current = pkg(id);
        if (current.state !== 'Ready' || current.vehicle) { unresolved.push(`${id}: not ready or already allocated`); continue; }
        // ponytail: demo capacity counts packages; the real API owns weight, space and operational restrictions.
        const target = vehicles.find(v => v.available && v.destinations.includes(current.destination) && state.packages.filter(p => p.vehicle === v.id && p.state !== 'Finalised').length < v.capacity);
        if (!target) { unresolved.push(`${id}: no available vehicle with capacity serving ${current.destination}`); continue; }
        current.vehicle = target.id;
        assigned.push(current);
        log(`${current.id} allocated to ${target.id}`);
      }
      return { assigned, unresolved };
    },
    getLoadInstruction(packageId) {
      const current = pkg(packageId);
      if (!['Ready', 'Loaded'].includes(current.state) || !current.vehicle) throw new Error('The package must be ready and allocated to a vehicle before loading.');
      return { package: current, vehicle: vehicle(current.vehicle), sequence: state.packages.filter(p => p.vehicle === current.vehicle && ['Ready', 'Loaded'].includes(p.state)).indexOf(current) + 1 };
    },
    confirmPackageLoaded(packageId, vehicleId) {
      const current = pkg(packageId);
      const target = vehicle(vehicleId);
      if (current.vehicle !== target.id) throw new Error(`Wrong vehicle. ${current.id} is allocated to ${current.vehicle || 'no vehicle'}.`);
      if (current.state === 'Loaded') return { package: current, duplicate: true };
      if (current.state !== 'Ready') throw new Error('Only ready, allocated packages can be loaded.');
      current.state = 'Loaded';
      current.location = target.id;
      current.items.forEach(id => { item(id).state = 'Loaded'; item(id).location = target.id; });
      log(`${current.id} scanned onto ${target.id}`);
      return { package: current, duplicate: false };
    },
    confirmPackagesLoaded(roundId, vehicleId, packageIds) {
      const target = vehicle(vehicleId);
      if (target.round !== roundId) throw new Error('The selected round does not belong to this vehicle.');
      if (!packageIds.length) throw new Error('No packages selected for finalisation.');
      const confirmed = [], unresolved = [];
      for (const id of [...new Set(packageIds)]) {
        const current = pkg(id);
        if (current.vehicle !== target.id || !['Loaded', 'Finalised'].includes(current.state)) { unresolved.push(`${id}: physical loading scan missing or vehicle mismatch`); continue; }
        if (current.state !== 'Finalised') {
          current.taskId = `DEMO-TASK-${current.id.slice(4)}`;
          current.state = 'Finalised';
          log(`${current.id} load finalised; demo delivery task linked`);
        }
        confirmed.push(current);
      }
      return { confirmed, unresolved };
    },
    getPackageInfo: pkg,
    getPackageStatus(id) { return pkg(id).state; },
    receiveReturnedPackage(id) {
      const current = pkg(id);
      if (current.state === 'Awaiting checks') return { package: current, duplicate: true };
      if (current.state !== 'Return expected' || !current.returnRef) throw new Error('No accepted return or unsuccessful-delivery record exists for this package. Ask a supervisor to review.');
      current.state = 'Awaiting checks';
      current.location = 'Returns R-01';
      current.items.forEach(id => { item(id).state = 'Awaiting checks'; item(id).location = current.location; });
      log(`${current.id} returned; contents and condition checks required`);
      return { package: current, duplicate: false };
    }
  };
}
if (typeof module !== 'undefined') module.exports = { createWarehouseDemo };
