# Warehouse worker GUI

Open `/Warehouse` in the existing Java application (`java App.java` from the repository root).
For a frontend-only preview with Node.js, run `node warehouse/preview.cjs` and open
<http://127.0.0.1:5050/Warehouse>.

The responsive interface includes an overview, supplier receiving and item storage,
searchable inventory and packages, guided packing, vehicle allocation and loading,
load finalisation, and return receipt. Keyboard-wedge barcode scanners can type into
the scan fields and submit with Enter. Storage locations and vehicle scans must match
the displayed instructions.

All records are sample data held in memory. Refreshing the page or choosing **Reset
demo** restores the starting records. Nothing is sent to a backend or delivery system.

`demo-data.js` supplies simulated operations named after `Warehouse-APIs.md`.
`warehouse.js` renders the interface and `../css/warehouse.css` supplies its styles.
No HTTP routes or response schemas for the future API are invented. The Java app
only gains an allowlisted static JavaScript asset route.

The demo uses pre-released packing requests rather than guessing the three-day
consolidation calculation, and counts packages for vehicle capacity. The future API
must enforce real capacity and handling restrictions, request allocation, access
control, consolidation eligibility, and delivery-task registration. Supervisor-only
order registration, return acceptance, archiving, exception resolution, condition
checks, refunds, and restocking are outside this worker GUI.

Run the dependency-free demo workflow checks with:

```sh
node warehouse/demo-data.test.cjs
```
