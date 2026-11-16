/* UI only: replace createWarehouseDemo with the real service once its contracts exist. */
(() => {
  'use strict';
  let demo = createWarehouseDemo();
  let currentView = 'overview';
  let query = '';
  let statusFilter = '';
  let toastTimer;
  const $ = selector => document.querySelector(selector);
  const content = $('#content');
  const dialog = $('#workflow-dialog');
  const escape = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
    );
  const icons = {
    overview:
      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    receiving: '<path d="M4 14v6h16v-6M12 3v12m-5-5 5 5 5-5M3 7h4m10 0h4"/>',
    items: '<path d="M3 4h18v16H3zM3 9h18M8 4v5m8-5v5M7 13h3m4 0h3M7 17h3m4 0h3"/>',
    packing: '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5M12 13v9M7 5.8l10 5.5v5"/>',
    packages: '<path d="M4 8h16v13H4zM3 3h18v5H3zM9 12h6"/>',
    loading:
      '<path d="M2 5h12v12H2zM14 9h4l4 5v3h-8M5 17a2 2 0 1 0 4 0m7 0a2 2 0 1 0 4 0M17 10v4h4"/>',
    returns: '<path d="M4 9h10a6 6 0 0 1 0 12h-3M4 9l5-5M4 9l5 5"/>',
    alert: '<path d="m12 3 10 18H2L12 3ZM12 9v5m0 3v1"/>'
  };
  const icon = name =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.packing}</svg>`;
  const views = {
    overview: [
      'Overview',
      'Your shift, at a glance.',
      'A clear view of what’s arriving, moving, and heading out.'
    ],
    receiving: [
      'Receiving',
      'Every arrival, accounted for.',
      'Receive supplier packages, check expected contents, and put items into storage.'
    ],
    items: [
      'Warehouse items',
      'Find it. Check it. Move it.',
      'Search individual items, storage locations, and processing states.'
    ],
    packing: [
      'Packing',
      'The next order starts here.',
      'Collect the right items, scan each one, and prepare packages for dispatch.'
    ],
    packages: [
      'All packages',
      'Every package. One place.',
      'Follow preparation, allocation, loading, and returns across the warehouse.'
    ],
    loading: [
      'Dispatch & loading',
      'Ready for the road.',
      'Allocate ready packages, confirm physical loading, and finalise vehicle loads.'
    ],
    returns: [
      'Returns',
      'A clear path back.',
      'Record physical returns and keep contents and condition checks visible.'
    ]
  };
  const badge = status => {
    const color =
      {
        Expected: 'gray',
        'Awaiting storage': 'amber',
        Stored: 'green',
        'Awaiting packing': 'blue',
        Packed: 'green',
        Packing: 'blue',
        Ready: 'green',
        Loaded: 'purple',
        Finalised: 'gray',
        'On hold': 'red',
        Investigation: 'red',
        'Return expected': 'amber',
        'Awaiting checks': 'amber',
        Received: 'green'
      }[status] || 'gray';
    return `<span class="badge ${color}">${escape(status)}</span>`;
  };
  const button = (label, action, id = '', style = 'button small') =>
    `<button type="button" class="${style}" data-action="${action}" data-id="${escape(id)}">${label}</button>`;
  const details = entries =>
    `<dl class="detail-list">${entries.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value || 'Not assigned')}</dd></div>`).join('')}</dl>`;
  const empty = (title, text) =>
    `<div class="empty"><strong>${escape(title)}</strong>${escape(text)}</div>`;
  const table = (headings, rows, className = '') =>
    `<div class="table-scroll"><table class="${className}"><thead><tr>${headings.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const idCell = (id, sub) =>
    `<div class="id-cell"><span class="box-icon">${icon('packing')}</span><div><strong>${escape(id)}</strong><small>${escape(sub)}</small></div></div>`;
  const field = (label, name, placeholder = '', extra = '') =>
    `<label class="field">${label}<input name="${name}" placeholder="${escape(placeholder)}" required ${extra}></label>`;
  const matching = record =>
    Object.values(record).join(' ').toLowerCase().includes(query.toLowerCase());

  function notify(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => {
      $('#toast').hidden = true;
    }, 4500);
  }

  function feedback(message, success = false) {
    const target = $('#dialog-feedback');
    target.textContent = message;
    target.className = success ? 'success' : '';
  }

  function openDialog(title, body, context = 'WAREHOUSE WORKFLOW') {
    $('#dialog-title').textContent = title;
    $('#dialog-context').textContent = context;
    $('#dialog-body').innerHTML = body;
    feedback('');
    if (!dialog.open) dialog.showModal();
  }

  function navigation() {
    const counts = {
      receiving: demo.state.incoming.filter(p => !p.received).length,
      packing:
        demo.state.packages.filter(p => p.state === 'Packing').length +
        demo.state.requests.filter(r => !r.packageId).length,
      loading: demo.state.packages.filter(p => ['Ready', 'Loaded'].includes(p.state)).length,
      returns: demo.state.packages.filter(p =>
        ['Return expected', 'Awaiting checks'].includes(p.state)
      ).length
    };
    $('#navigation').innerHTML = Object.entries(views)
      .map(
        ([view, data]) =>
          `${view === 'packages' ? '<div class="nav-divider"></div>' : ''}<button type="button" class="nav-button ${view === currentView ? 'active' : ''}" data-action="navigate" data-id="${view}" ${view === currentView ? 'aria-current="page"' : ''}>${icon(view)}<span>${data[0]}</span>${counts[view] ? `<span class="nav-count">${counts[view]}</span>` : ''}</button>`
      )
      .join('');
  }

  function alerts() {
    const result = [];
    const holds = demo.state.packages.filter(p => p.state === 'On hold');
    const unassigned = demo.state.packages.filter(p => p.state === 'Ready' && !p.vehicle);
    const arrivals = demo.state.incoming.filter(p => !p.received && p.estimate !== 'current');
    if (holds.length)
      result.push([
        `${holds.length} packing ${holds.length === 1 ? 'exception' : 'exceptions'}`,
        `${holds[0].id} · Missing item reported`,
        'Review package',
        'package',
        holds[0].id
      ]);
    if (unassigned.length)
      result.push([
        `${unassigned.length} ${unassigned.length === 1 ? 'package needs' : 'packages need'} a vehicle`,
        'Ready to dispatch · Allocation required',
        'Assign a vehicle',
        'load',
        unassigned[0].id
      ]);
    if (arrivals.length)
      result.push([
        'Arrival estimate unavailable',
        `${arrivals[0].id} · Check with supplier`,
        'View incoming packages',
        'navigate',
        'receiving'
      ]);
    return result;
  }

  function packageRows(packages, compact = false) {
    return packages.map(
      p =>
        `<tr><td>${idCell(p.id, `${p.items.length} ${p.items.length === 1 ? 'item' : 'items'}`)}</td><td>${escape(p.destination)}</td><td>${badge(p.state)}</td>${compact ? '' : `<td>${escape(p.location)}</td>`}<td>${escape(p.vehicle || 'Unassigned')}</td><td>${button('View →', 'package', p.id, 'row-action')}</td></tr>`
    );
  }

  function overview() {
    const s = demo.state;
    const waiting = s.incoming.filter(p => !p.received).length;
    const stored = s.items.filter(i => i.state === 'Stored').length;
    const ready = s.packages.filter(p => p.state === 'Ready').length;
    const attention = alerts();
    const stats = [
      ['Incoming packages', waiting, 'receiving', 'Expected supplier arrivals'],
      [
        'Items in storage',
        stored,
        'items',
        `${s.items.filter(i => i.state === 'Awaiting storage').length} items awaiting put-away`
      ],
      [
        'Ready for dispatch',
        ready,
        'loading',
        `${s.packages.filter(p => p.state === 'Ready' && p.vehicle).length} allocated to a vehicle`
      ],
      ['Needs attention', attention.length, 'alert', 'Exceptions to review']
    ];
    const active = s.packages.filter(
      p => !['Awaiting checks', 'Return expected', 'Finalised'].includes(p.state)
    );
    content.innerHTML = `<div class="stats">${stats.map(([label, count, image, note]) => `<div class="stat"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon(image)}</span></div><div class="stat-value">${String(count).padStart(2, '0')}</div><div class="stat-note">${note}</div></div>`).join('')}</div>
      <div class="section-title"><h2>Keep things moving</h2><span class="section-label">YOUR DAILY WORKFLOW</span></div>
      <div class="actions-grid">${[
        ['Receive a package', 'Check arrivals & store items', 'receiving', 'receive'],
        ['Start packing', 'Pick, scan & prepare a package', 'packing', 'next-packing'],
        ['Load a vehicle', 'Check assignments & loading', 'loading', 'navigate']
      ]
        .map(
          ([title, sub, image, action]) =>
            `<button type="button" class="action-card" data-action="${action}" data-id="loading"><span class="action-icon">${icon(image)}</span><span><strong>${title}</strong><small>${sub}</small></span><span class="arrow">↗</span></button>`
        )
        .join('')}</div>
      <div class="dashboard-grid"><div><section class="panel"><div class="panel-header"><div><h2>Packages in progress</h2><p>From the packing bench to the loading bay</p></div>${button('View all packages →', 'navigate', 'packages', 'text-button')}</div>${active.length ? table(['Package', 'Destination', 'Status', 'Vehicle', '<span class="sr-only">Actions</span>'], packageRows(active.slice(0, 6), true)) : empty('All caught up', 'There are no packages in preparation or loading.')}<div class="panel-foot">${active.length} active packages · Updated with your demo actions</div></section>
      <div class="flow-strip"><strong>Every scan counts.</strong><span>Receive</span><span>→</span><span>Store</span><span>→</span><span>Pack</span><span>→</span><span>Load</span><span>Separate steps. Clear progress.</span></div></div>
      <div class="side-stack"><section class="panel"><div class="panel-header"><h2>Needs attention</h2><span class="count-label">${attention.length} open</span></div>${attention.length ? attention.map(([title, description, label, action, id]) => `<div class="attention-item"><span class="attention-mark">!</span><div><strong>${escape(title)}</strong><p>${escape(description)}</p>${button(`${label} →`, action, id, 'text-button')}</div></div>`).join('') : empty('No open exceptions', 'Your queues are clear.')}</section><section class="panel"><div class="panel-header"><h2>Recent activity</h2><span class="section-label">DEMO</span></div>${s.activity
        .slice(0, 3)
        .map(
          event =>
            `<div class="activity-item"><span class="activity-dot"></span><div><strong>${escape(event.text)}</strong><small>${escape(event.time)}</small></div></div>`
        )
        .join('')}</section></div></div>`;
  }

  function listView() {
    const options =
      currentView === 'items'
        ? [
            'Expected',
            'Awaiting storage',
            'Stored',
            'Awaiting packing',
            'Packed',
            'Loaded',
            'Investigation',
            'Return expected',
            'Awaiting checks'
          ]
        : currentView === 'receiving'
          ? ['Expected', 'Received']
          : [
              'Packing',
              'On hold',
              'Ready',
              'Loaded',
              'Finalised',
              'Return expected',
              'Awaiting checks'
            ];
    content.innerHTML = `<section class="panel"><div class="panel-header"><div><h2>${views[currentView][0]}</h2><p>${currentView === 'receiving' ? 'Expected contents are not confirmed physical receipts.' : 'Search by ID, location, destination, or processing state.'}</p></div><span class="count-label">SAMPLE DATA</span></div><div class="toolbar"><label class="search-wrap"><span aria-hidden="true">⌕</span><span class="sr-only">Search ${views[currentView][0].toLowerCase()}</span><input id="list-search" type="search" placeholder="Search ${views[currentView][0].toLowerCase()}…" value="${escape(query)}"></label><label><span class="sr-only">Filter by status</span><select id="list-status"><option value="">All statuses</option>${options.map(status => `<option ${status === statusFilter ? 'selected' : ''}>${status}</option>`).join('')}</select></label><span id="filter-count" class="filter-count"></span></div><div id="list-results"></div></section>`;
    updateList();
  }

  function updateList() {
    let records, headings, rows;
    if (currentView === 'items') {
      records = demo.state.items.filter(
        i => matching(i) && (!statusFilter || i.state === statusFilter)
      );
      headings = [
        'Item / product',
        'Order',
        'Location',
        'Status',
        'Handling',
        '<span class="sr-only">Actions</span>'
      ];
      rows = records.map(
        i =>
          `<tr><td><strong>${escape(i.name)}</strong><small>${i.id} · ${i.product}</small></td><td>${i.order}</td><td>${escape(i.location || (i.assigned ? `Assigned: ${i.assigned}` : 'Not stored'))}</td><td>${badge(i.state)}</td><td>${escape(i.handling)}</td><td>${button(i.state === 'Awaiting storage' ? 'Store item →' : 'Details →', 'item', i.id, 'row-action')}</td></tr>`
      );
    } else if (currentView === 'receiving') {
      records = demo.state.incoming.filter(
        p =>
          matching(p) && (!statusFilter || (p.received ? 'Received' : 'Expected') === statusFilter)
      );
      headings = [
        'Supplier package',
        'Supplier',
        'Expected items',
        'Arrival / estimate',
        'Status',
        '<span class="sr-only">Actions</span>'
      ];
      rows = records.map(
        p =>
          `<tr><td>${idCell(p.id, p.tracking)}</td><td>${p.supplier}</td><td>${p.items.length} expected</td><td>${escape(p.eta)}${p.estimate !== 'current' ? '<small>Do not rely on an unconfirmed ETA</small>' : ''}</td><td>${badge(p.received ? 'Received' : 'Expected')}</td><td>${button(p.received ? 'Check contents →' : 'Receive →', 'receive', p.id, 'row-action')}</td></tr>`
      );
    } else {
      records = demo.state.packages.filter(
        p => matching(p) && (!statusFilter || p.state === statusFilter)
      );
      headings = [
        'Package',
        'Destination',
        'Status',
        'Location',
        'Vehicle',
        '<span class="sr-only">Actions</span>'
      ];
      rows = packageRows(records);
    }
    $('#filter-count').textContent = `${records.length} results`;
    $('#list-results').innerHTML = rows.length
      ? table(headings, rows)
      : empty('No matches found', 'Try a different search or choose another status.');
  }

  function packing() {
    const active = demo.state.packages.filter(p => ['Packing', 'On hold'].includes(p.state));
    const next = demo.getPackagingRequest();
    content.innerHTML = `<div class="section-title"><div><h2>Packing workbench</h2><p>Only released requests with stored items are available.</p></div>${button('Get next packing job', 'next-packing', '', 'button primary')}</div><div class="work-grid">${
      next
        ? `<section class="panel work-card"><div class="meta"><span class="eyebrow">NEXT AVAILABLE JOB</span>${badge('Ready')}</div><h3>${next.id}</h3><p>${next.items.length} items · ${escape(next.destination)}</p>${details(
            [
              ['Destination', next.address],
              ['Availability', next.eligibility]
            ]
          )}<div class="hint">Collect from the listed locations, create a package, then scan each individual item.</div>${button('View packing request →', 'next-packing')}</section>`
        : `<section class="panel">${empty('No new packing jobs', 'Continue active work or check again after more items are stored.')}</section>`
    }${active.map(p => `<section class="panel work-card"><div class="meta"><span class="eyebrow">${p.requestId || 'PACKING EXCEPTION'}</span>${badge(p.state)}</div><h3>${p.id}</h3><p>${escape(p.destination)} · ${p.scanned.length} of ${p.items.length} items scanned</p><div class="progress-track"><div class="progress-fill" style="width:${(p.scanned.length / p.items.length) * 100}%"></div></div><div class="hint ${p.missing.length ? 'warning' : ''}">${p.missing.length ? `${p.missing.join(', ')} missing. Keep this work on hold for supervisor review.` : 'Scan all expected contents before marking this package ready.'}</div>${button(p.state === 'On hold' ? 'Review exception →' : 'Continue packing →', 'package', p.id)}</section>`).join('')}</div><div class="flow-strip"><strong>Consolidation guidance</strong><span>The real service will release jobs using destination groups and the three-day rule. This demo uses pre-released sample requests.</span></div>`;
  }

  function loading() {
    const unallocated = demo.state.packages.filter(p => p.state === 'Ready' && !p.vehicle);
    const dispatch = demo.state.packages.filter(p =>
      ['Ready', 'Loaded', 'On hold', 'Packing'].includes(p.state)
    );
    content.innerHTML = `<div class="section-title"><div><h2>Prepared packages & dispatch queue</h2><p>Finalised loads leave this queue and remain in All packages.</p></div><span class="count-label">${unallocated.length} awaiting allocation</span></div><section class="panel">${
      dispatch.length
        ? table(
            [
              'Package',
              'Destination',
              'Status',
              'Location',
              'Vehicle',
              '<span class="sr-only">Actions</span>'
            ],
            dispatch.map(
              p =>
                `<tr><td>${idCell(p.id, `${p.items.length} items`)}</td><td>${p.destination}</td><td>${badge(p.state)}</td><td>${escape(p.location)}</td><td>${p.vehicle || 'Unassigned'}</td><td>${button(p.state === 'Ready' ? (p.vehicle ? 'Load →' : 'Allocate →') : 'View →', p.state === 'Ready' ? 'load' : 'package', p.id, 'row-action')}</td></tr>`
            )
          )
        : empty('Dispatch queue clear', 'New packages appear here as packing work is prepared.')
    }</section><div class="section-title" style="margin-top:27px"><div><h2>Vehicle loading bays</h2><p>A load scan and load finalisation are separate confirmations.</p></div></div><div class="work-grid">${demo.state.vehicles
      .map(v => {
        const assigned = demo.state.packages.filter(
          p => p.vehicle === v.id && ['Ready', 'Loaded'].includes(p.state)
        );
        const loaded = assigned.filter(p => p.state === 'Loaded');
        return `<section class="panel work-card"><div class="meta"><div class="vehicle-heading">${icon('loading')}<div><h3>${v.id}</h3><small>${v.name} · ${v.dock}</small></div></div><span class="count-label">${v.round}</span></div><p>${loaded.length} scanned / ${assigned.length} allocated · Demo capacity: ${v.capacity} packages</p><div class="progress-track"><div class="progress-fill" style="width:${assigned.length ? (loaded.length / assigned.length) * 100 : 0}%"></div></div>${
          assigned.length
            ? table(
                ['Package', 'State', '<span class="sr-only">Actions</span>'],
                assigned.map(
                  p =>
                    `<tr><td><strong>${p.id}</strong></td><td>${badge(p.state)}</td><td>${button('Instructions →', 'load', p.id, 'row-action')}</td></tr>`
                ),
                'dialog-table'
              )
            : '<div class="hint">No active packages allocated to this vehicle.</div>'
        }<button type="button" class="button small ${loaded.length ? 'primary' : ''}" data-action="finalise" data-id="${v.id}" ${loaded.length ? '' : 'disabled'}>Review & finalise load →</button></section>`;
      })
      .join('')}</div>`;
  }

  function returns() {
    const packages = demo.state.packages.filter(p =>
      ['Return expected', 'Awaiting checks'].includes(p.state)
    );
    content.innerHTML = `<div class="section-title"><div><h2>Return receipts</h2><p>Record arrival against a known return or unsuccessful-delivery record.</p></div>${button('Receive a return', 'return', '', 'button primary')}</div><section class="panel">${
      packages.length
        ? table(
            [
              'Package',
              'Return reference',
              'Location',
              'Status',
              '<span class="sr-only">Actions</span>'
            ],
            packages.map(
              p =>
                `<tr><td>${idCell(p.id, p.destination)}</td><td>${p.returnRef}</td><td>${p.location}</td><td>${badge(p.state)}</td><td>${button(p.state === 'Return expected' ? 'Receive return →' : 'View checks →', p.state === 'Return expected' ? 'return' : 'package', p.id, 'row-action')}</td></tr>`
            )
          )
        : empty('No returns awaiting receipt', 'Accepted returns appear here when available.')
    }<div class="return-copy">Receipt records physical arrival only. Contents checks, condition checks, restocking decisions, and refunds remain separate. This demo does not approve them.</div></section>`;
  }

  function render() {
    navigation();
    $('#page-title').textContent = views[currentView][1];
    $('#page-subtitle').textContent = views[currentView][2];
    if (currentView === 'overview') overview();
    else if (['receiving', 'items', 'packages'].includes(currentView)) listView();
    else if (currentView === 'packing') packing();
    else if (currentView === 'loading') loading();
    else returns();
  }

  function receiveDialog(id = '') {
    const incoming = demo.state.incoming.find(p => p.id === id);
    const received = incoming?.received;
    openDialog(
      received ? incoming.id : 'Receive a supplier package',
      `<div class="hint">Scan a registered supplier package first. Receipt shows expected contents; each item still needs a separate storage confirmation.</div><form data-form="receive" class="form-section"><label class="field">Supplier package ID<input name="packageId" placeholder="Scan or enter SUP-1042" value="${escape(id)}" list="incoming-ids" required autocomplete="off"><datalist id="incoming-ids">${demo.state.incoming.map(p => `<option value="${p.id}">${p.supplier}</option>`).join('')}</datalist></label><div class="form-actions"><button class="button primary" type="submit">${received ? 'Check receipt scan' : 'Confirm package received'}</button></div></form>${
        received
          ? `${details([
              ['Supplier', incoming.supplier],
              ['Tracking reference', incoming.tracking],
              ['Expected contents', `${incoming.items.length} individual items`],
              ['Receipt', 'Recorded · Demo']
            ])}<h3>Check & store expected contents</h3>${table(
              ['Expected item', 'State', '<span class="sr-only">Action</span>'],
              incoming.items.map(id => {
                const i = demo.state.items.find(item => item.id === id);
                return `<tr><td><strong>${i.name}</strong><small>${i.id}</small></td><td>${badge(i.state)}</td><td>${i.state === 'Awaiting storage' ? button('Assign storage →', 'store', i.id, 'row-action') : escape(i.location || 'Not stored')}</td></tr>`;
              }),
              'dialog-table'
            )}<div class="form-section"><h3>Item has no individual label?</h3><form data-form="match"><div class="form-grid"><label class="field">Supplier<select name="supplierId">${demo.state.incoming.map(p => `<option value="${p.supplierId}" ${p.id === id ? 'selected' : ''}>${p.supplier}</option>`).join('')}</select></label>${field('Product ID', 'productId', 'e.g. PRD-LAMP')}${field('Quantity', 'quantity', '1', 'type="number" min="1" step="1"')}</div><div class="form-actions"><button class="button" type="submit">Match expected items</button></div></form><div id="match-results"></div></div>`
          : ''
      }`,
      'RECEIVING / ARRIVAL SCAN'
    );
  }

  function storageDialog(id) {
    const i = demo.assignStorageLocation(id);
    openDialog(
      `Store ${i.id}`,
      `<div class="hint warning">Place the physical item in its assigned location, then scan that location to confirm.</div>${details(
        [
          ['Item', i.name],
          ['Order', i.order],
          ['Assigned location', i.assigned],
          ['Handling instructions', i.handling]
        ]
      )}<form data-form="store" data-id="${i.id}">${field('Storage location scan', 'location', `Scan ${i.assigned}`, 'autocomplete="off"')}<div class="form-actions"><button type="submit" class="button primary">Confirm item stored</button></div></form>`,
      'RECEIVING / PHYSICAL PLACEMENT'
    );
  }

  function itemDialog(id) {
    const i = demo.state.items.find(item => item.id === id);
    if (i.state === 'Awaiting storage') return storageDialog(id);
    const incoming = demo.getIncomingPackages([id]);
    openDialog(
      i.id,
      `${badge(i.state)}${details([
        ['Product', `${i.name} · ${i.product}`],
        ['Order', i.order],
        ['Location', i.location || 'No physical storage confirmed'],
        ['Handling', i.handling],
        ['Supplier package', incoming.packages[0]?.id || 'No active supplier package registration'],
        ['Outgoing package', i.packageId || 'Not allocated']
      ])}${i.state === 'Expected' ? '<div class="hint warning">This is an expected item. Receive its supplier package before assigning storage.</div>' : ''}${i.packageId ? button('View linked package →', 'package', i.packageId) : ''}`,
      'INVENTORY / ITEM DETAILS'
    );
  }

  function nextPackingDialog() {
    const request = demo.getPackagingRequest();
    if (!request)
      return openDialog(
        'No new packing job',
        empty(
          'You’re up to date',
          'Continue active packing jobs or check again after items are stored.'
        ),
        'PACKING / NEXT REQUEST'
      );
    openDialog(
      request.id,
      `${details([
        ['Destination', request.address],
        ['Items required', `${request.items.length} individual items`],
        ['Eligibility', request.eligibility],
        ['Request status', 'Available']
      ])}${table(
        ['Item', 'Collect from', 'Handling'],
        request.items.map(id => {
          const i = demo.state.items.find(item => item.id === id);
          return `<tr><td><strong>${i.name}</strong><small>${i.id}</small></td><td>${i.location}</td><td>${i.handling}</td></tr>`;
        }),
        'dialog-table'
      )}<div class="hint">Create one outgoing package for this request. Scan each item after physically placing it inside.</div><div class="form-actions">${button('Create package & start scanning', 'create-package', request.id, 'button primary')}</div>`,
      'PACKING / RELEASED REQUEST'
    );
  }

  function packageDialog(id) {
    const p = demo.getPackageInfo(id);
    const packing = p.state === 'Packing';
    const missing = p.state === 'On hold';
    openDialog(
      p.id,
      `${badge(p.state)}${details([
        ['Destination', p.address],
        ['Warehouse location', p.location],
        ['Assigned vehicle', p.vehicle],
        ['Delivery task', p.taskId || 'Not registered'],
        ['Handling', p.handling],
        [
          'Packed measurements',
          p.weight ? `${p.weight} kg · ${p.dimensions.join(' × ')} cm` : 'Not recorded'
        ]
      ])}${packing ? `<h3>Scan package contents</h3><p class="section-label">${p.scanned.length} of ${p.items.length} items scanned</p><div class="progress-track"><div class="progress-fill" style="width:${(p.scanned.length / p.items.length) * 100}%"></div></div>` : ''}${table(
        ['Item', 'Location / collection point', 'Check'],
        p.items.map(id => {
          const i = demo.state.items.find(item => item.id === id);
          return `<tr><td><strong>${i.name}</strong><small>${i.id}</small></td><td>${escape(i.location || 'Not confirmed')}</td><td>${p.missing.includes(id) ? badge('Investigation') : p.scanned.includes(id) ? '<span class="badge green">Scanned</span>' : packing ? button('Report missing', 'missing', `${p.id}|${id}`, 'row-action') : badge(i.state)}</td></tr>`;
        }),
        'dialog-table'
      )}${packing ? `<form data-form="scan-item" data-id="${p.id}">${field('Item barcode', 'itemId', 'Scan an expected Item ID', 'autocomplete="off"')}<div class="form-actions"><button type="submit" class="button primary">Add item to package</button></div></form><div class="form-section"><h3>Complete packing</h3><form data-form="ready" data-id="${p.id}"><div class="form-grid">${field('Weight (kg)', 'weight', '0.00', 'type="number" min="0.01" step="0.01"')}${field('Length (cm)', 'length', '0', 'type="number" min="0.1" step="0.1"')}${field('Width (cm)', 'width', '0', 'type="number" min="0.1" step="0.1"')}${field('Height (cm)', 'height', '0', 'type="number" min="0.1" step="0.1"')}</div><div class="form-actions"><button type="submit" class="button primary" ${p.scanned.length === p.items.length ? '' : 'disabled'}>Mark package ready</button></div></form></div>` : missing ? '<div class="hint warning">Packing is on hold. A required item is missing. Ask a supervisor to investigate and resolve the discrepancy; readiness is blocked.</div>' : p.state === 'Ready' ? `<div class="form-actions">${button(p.vehicle ? 'View loading instructions →' : 'Allocate a vehicle →', 'load', p.id, 'button primary')}</div>` : p.state === 'Loaded' ? `<div class="hint">Physical load scan recorded. Finalise the vehicle load separately to register delivery tasks.</div><div class="form-actions">${button('Review vehicle load →', 'finalise', p.vehicle, 'button primary')}</div>` : p.state === 'Awaiting checks' ? '<div class="hint warning">Return received. Contents and condition checks are outstanding. Do not restock or issue a refund based on this receipt.</div>' : p.state === 'Return expected' ? `<div class="form-actions">${button('Record physical return →', 'return', p.id, 'button primary')}</div>` : '<div class="hint success">Load finalised. The task reference is simulated; no delivery service was called.</div>'}`,
      packing ? 'PACKING / ITEM SCANS' : 'PACKAGE / OPERATIONAL DETAILS'
    );
    if (packing) $('input[name="itemId"]').focus();
  }

  function loadDialog(id) {
    const p = demo.getPackageInfo(id);
    if (!p.vehicle) {
      openDialog(
        `Allocate ${p.id}`,
        `${details([
          ['Destination', p.destination],
          ['Collection location', p.location],
          ['Weight', `${p.weight} kg`],
          ['Handling', p.handling]
        ])}<div class="hint">Choose an available vehicle serving this destination. Demo capacity is measured in packages; real restrictions belong to the future API.</div><form data-form="allocate" data-id="${p.id}" class="form-section"><label class="field">Vehicle<select name="vehicleId">${demo.state.vehicles.map(v => `<option value="${v.id}" ${v.destinations.includes(p.destination) ? '' : 'disabled'}>${v.id} · ${v.name}${v.destinations.includes(p.destination) ? '' : ' · Different service area'}</option>`).join('')}</select></label><div class="form-actions"><button class="button primary" type="submit">Assign to vehicle</button></div></form>`,
        'DISPATCH / VEHICLE ALLOCATION'
      );
      return;
    }
    const instruction = demo.getLoadInstruction(id);
    openDialog(
      `Load ${p.id}`,
      `${badge(p.state)}${details([
        ['Collect from', p.state === 'Loaded' ? 'Already scanned onto vehicle' : p.location],
        ['Vehicle', p.vehicle],
        ['Loading bay', instruction.vehicle.dock],
        ['Round', instruction.vehicle.round],
        ['Demo loading sequence', instruction.sequence],
        ['Handling instructions', p.handling]
      ])}<div class="hint">Scan both the package and its assigned vehicle after physically loading. Reading these instructions does not record loading.</div><form data-form="load" data-id="${p.id}" class="form-section"><div class="form-grid">${field('Package barcode', 'packageId', `Scan ${p.id}`, 'autocomplete="off"')}${field('Vehicle barcode', 'vehicleId', `Scan ${p.vehicle}`, 'autocomplete="off"')}</div><div class="form-actions"><button class="button primary" type="submit">Confirm physically loaded</button></div></form>${p.state === 'Loaded' ? `<div class="form-section">${button('Review & finalise vehicle load →', 'finalise', p.vehicle)}</div>` : ''}`,
      'LOADING / PHYSICAL SCAN'
    );
  }

  function finaliseDialog(id) {
    const v = demo.state.vehicles.find(vehicle => vehicle.id === id);
    const packages = demo.state.packages.filter(
      p => p.vehicle === id && ['Ready', 'Loaded'].includes(p.state)
    );
    openDialog(
      `Finalise ${id}`,
      `${details([
        ['Round', v.round],
        ['Vehicle', v.id]
      ])}${table(
        ['Package', 'Physical scan'],
        packages.map(
          p =>
            `<tr><td><strong>${p.id}</strong></td><td>${p.state === 'Loaded' ? '<span class="badge green">Recorded</span>' : '<span class="badge amber">Missing load scan</span>'}</td></tr>`
        ),
        'dialog-table'
      )}<div class="hint warning">Only packages with a valid load scan will be finalised. Missing scans remain unresolved. Delivery task registration is simulated in this demo.</div><form data-form="finalise" data-id="${v.id}" class="form-actions"><button class="button primary" type="submit" ${packages.some(p => p.state === 'Loaded') ? '' : 'disabled'}>Confirm load & simulate task registration</button></form>`,
      'LOADING / ROUND FINALISATION'
    );
  }

  function returnDialog(id = '') {
    openDialog(
      'Receive a returned package',
      `<div class="hint">Use the original Package ID. An accepted return or unsuccessful-delivery record must already exist.</div><form data-form="return" class="form-section">${field('Returned package ID', 'packageId', 'Scan or enter PKG-0830', `value="${escape(id)}" list="return-ids" autocomplete="off"`)}<datalist id="return-ids">${demo.state.packages
        .filter(p => p.returnRef)
        .map(p => `<option value="${p.id}">${p.returnRef}</option>`)
        .join(
          ''
        )}</datalist><div class="form-actions"><button type="submit" class="button primary">Confirm physical receipt</button></div></form>`,
      'RETURNS / PHYSICAL RECEIPT'
    );
  }

  function navigate(view, focus = true) {
    currentView = Object.hasOwn(views, view) ? view : 'overview';
    query = '';
    statusFilter = '';
    render();
    if (focus) $('#main').focus({ preventScroll: true });
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const { action, id } = target.dataset;
    try {
      if (action === 'navigate') {
        dialog.close();
        if (location.hash === `#${id}`) navigate(id);
        else location.hash = id;
      } else if (action === 'receive') receiveDialog(id === 'loading' ? '' : id);
      else if (action === 'item') itemDialog(id);
      else if (action === 'store') storageDialog(id);
      else if (action === 'next-packing') nextPackingDialog();
      else if (action === 'create-package') {
        const p = demo.createPackage(id);
        render();
        packageDialog(p.id);
      } else if (action === 'package') packageDialog(id);
      else if (action === 'missing') {
        const [packageId, itemId] = id.split('|');
        demo.reportMissingItem(packageId, itemId);
        render();
        packageDialog(packageId);
        feedback(`${itemId} reported missing. Packing placed on hold for supervisor review.`);
      } else if (action === 'load') loadDialog(id);
      else if (action === 'finalise') finaliseDialog(id);
      else if (action === 'return') returnDialog(id);
    } catch (error) {
      if (dialog.open) feedback(error.message);
      else notify(error.message);
    }
  });

  document.addEventListener('submit', event => {
    const form = event.target.closest('[data-form]');
    if (!form) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const id = form.dataset.id;
    const normalized = value => String(value).trim().toUpperCase();
    try {
      switch (form.dataset.form) {
        case 'receive': {
          const result = demo.receiveIncomingPackage(data.packageId);
          render();
          receiveDialog(result.incoming.id);
          feedback(
            result.duplicate
              ? 'Receipt already recorded. No duplicate arrival was created.'
              : 'Package received. Check and store each expected item separately.',
            true
          );
          break;
        }
        case 'match': {
          const items = demo.matchUnlabelledItem(data.supplierId, data.productId, data.quantity);
          $('#match-results').innerHTML = items
            .map(
              i =>
                `<div class="hint success" style="margin-top:10px">Matched ${i.id} · ${escape(i.name)} ${button('Assign storage →', 'store', i.id, 'text-button')}</div>`
            )
            .join('');
          feedback(
            'Unique match found. Assign storage and confirm physical placement for each item.',
            true
          );
          break;
        }
        case 'store': {
          const result = demo.confirmItemStored(id, data.location);
          dialog.close();
          render();
          notify(`${result.item.id} stored at ${result.item.location}.`);
          break;
        }
        case 'scan-item': {
          const result = demo.addItemToPackage(id, data.itemId);
          render();
          packageDialog(id);
          feedback(
            result.duplicate
              ? 'Duplicate scan recognised. This item was already added.'
              : 'Item scan accepted. Packing progress updated.',
            true
          );
          break;
        }
        case 'ready':
          demo.setPackageReady(id, data.weight, [data.length, data.width, data.height]);
          render();
          packageDialog(id);
          feedback(
            'Packing complete. Ready for vehicle allocation; physical loading is still required.',
            true
          );
          break;
        case 'allocate': {
          const result = demo.assignPackagesToVehicles([id], [data.vehicleId]);
          if (result.unresolved.length) throw new Error(result.unresolved.join('. '));
          render();
          loadDialog(id);
          feedback(
            'Vehicle allocated. Follow the instructions and scan both IDs after loading.',
            true
          );
          break;
        }
        case 'load': {
          if (normalized(data.packageId) !== id)
            throw new Error(`Wrong package. These instructions are for ${id}.`);
          const result = demo.confirmPackageLoaded(data.packageId, data.vehicleId);
          render();
          loadDialog(id);
          feedback(
            result.duplicate
              ? 'Duplicate loading scan recognised. No duplicate movement recorded.'
              : 'Physical loading recorded. Finalise the vehicle load separately.',
            true
          );
          break;
        }
        case 'finalise': {
          const vehicle = demo.state.vehicles.find(v => v.id === id);
          const packages = demo.state.packages.filter(
            p => p.vehicle === id && ['Ready', 'Loaded'].includes(p.state)
          );
          const result = demo.confirmPackagesLoaded(
            vehicle.round,
            id,
            packages.map(p => p.id)
          );
          render();
          openDialog(
            'Load finalisation result',
            `<div class="hint success">${result.confirmed.length} packages finalised with simulated delivery task references.</div>${
              result.confirmed.length
                ? table(
                    ['Package', 'Demo task reference'],
                    result.confirmed.map(p => `<tr><td>${p.id}</td><td>${p.taskId}</td></tr>`),
                    'dialog-table'
                  )
                : ''
            }${result.unresolved.length ? `<div class="hint warning"><strong>Unresolved</strong><br>${result.unresolved.map(escape).join('<br>')}</div>` : ''}<p class="section-label">Finalised packages remain available in All packages. No delivery service was contacted.</p>`,
            'LOADING / DEMO RESULT'
          );
          break;
        }
        case 'return': {
          const result = demo.receiveReturnedPackage(data.packageId);
          render();
          packageDialog(result.package.id);
          feedback(
            result.duplicate
              ? 'Return receipt already recorded. No duplicate receipt created.'
              : 'Return received. Contents and condition checks remain outstanding.',
            true
          );
          break;
        }
      }
    } catch (error) {
      if (form.dataset.form === 'match') $('#match-results').innerHTML = '';
      feedback(error.message);
    }
  });
  content.addEventListener('input', event => {
    if (event.target.id === 'list-search') {
      query = event.target.value;
      updateList();
    }
  });
  content.addEventListener('change', event => {
    if (event.target.id === 'list-status') {
      statusFilter = event.target.value;
      updateList();
    }
  });
  $('#quick-receive').addEventListener('click', () => receiveDialog());
  $('#close-dialog').addEventListener('click', () => dialog.close());
  $('#reset-demo').addEventListener('click', () => {
    demo = createWarehouseDemo();
    query = '';
    statusFilter = '';
    dialog.close();
    render();
    notify('Demo reset to its starting sample data.');
  });
  window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
  navigate(location.hash.slice(1), false);
})();
