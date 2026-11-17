# Delivery driver demo

The driver interface can be tested on a laptop and a phone using the same running
server. This launcher uses mock delivery, routing, and location services.

## Start the demo

Requires Node.js 22+ and Docker Desktop running. From the repository root:

```sh
node delivery/tests/serve.mjs
```

Wait for the Docker build to finish and the application to start. Keep this
terminal running; press **Ctrl+C** to stop the demo. Restart the launcher after
changing application code so Docker rebuilds it.

The `Running on http://0.0.0.0:5000` message shows the container's internal port.
The browser uses **5083**, which Docker publishes on the laptop's network interfaces.

## Test on the laptop

Open <http://127.0.0.1:5083/Delivery> (or <http://localhost:5083/Delivery>).
This continues to work when phone access is enabled.

For a quick narrow-screen check, open the browser's developer tools and enable
its device toolbar. Try a 390 × 844 viewport, then check on the actual phone too.

## Test on a phone

1. Connect both devices to the same Wi-Fi network, or connect the laptop to the
   phone's hotspot.
2. Find the laptop's Wi-Fi IP on macOS:

   ```sh
   ipconfig getifaddr en0
   ```
   You can also check it through wifi settings

   If this is empty, look up the active connection's IP in **System Settings →
   Wi-Fi → Details → TCP/IP**.

3. On the phone, open `http://<laptop-ip>:5083/Delivery`, replacing `<laptop-ip>`
   with that address. For example: `http://172.20.10.2:5083/Delivery`.
   `localhost` on the phone refers to the phone itself.
4. Allow incoming connections if macOS prompts you. If the hotspot prevents
   access, try both devices on a regular Wi-Fi network.

Use the laptop's current IP; it can change when reconnecting to a network.

## Manual checklist on both devices

1. Enter `DRIVER-1` and select **Start round**.
2. Check that `VAN-1`, `ROUND-1`, one remaining stop, and the destination
   **10 Parnell Square, Dublin** appear.
3. Check that the map, route line, and location markers are visible. The default
   next-stop ETA is **09:15**, and the finish time is **09:40** (Dublin time).
4. Open **Delivery instructions**, read the instructions, and close the dialog.
5. Confirm that **Confirm delivery** is disabled before selecting **Take photo**.
6. Select **Take photo**, then **Confirm delivery**. Check that the screen switches
   to **Return to hub**, shows zero stops, and draws the return route. The round
   summary should show **1 succeeded** and **0 failed** above the map.
7. On the phone, check portrait and landscape layouts: no horizontal scrolling,
   readable map and text, and usable buttons and dialog controls.

For the failure path, restart the demo and reload the page, start a round, then
select **Failed task** without taking a photo. It should switch to **Return to
hub** with zero stops only after the backend acknowledges the failure. A failed
submission should show an error and keep the current task available for retry.
The round summary should show **0 succeeded** and **1 failed**. Summary totals come
from DCM's round response as `summary: { succeeded, failed }`; missing totals display
as unavailable while the return route remains visible.

The devices share one mock backend. Completing the delivery on one device changes
the backend state for the other. For a fresh run, stop and restart the launcher,
then reload both browser pages. Existing pages do not automatically synchronise
their displayed delivery state.

## What is simulated?

- Leaflet displays real OpenStreetMap background tiles, requiring internet access
  during manual testing.
- The route is a line through hardcoded sample coordinates, rather than a
  calculated road route.
- Assignments, driver positions, ETAs, and finish times come from
  `tests/fixtures.mjs` and `tests/upstream.mjs`. They do not use live GPS or traffic.
- **Take photo** acknowledges simulated proof; it does not open the camera or
  capture/upload an image.
- Mock delivery outcomes are stored in memory and cleared on restart.

## Automated browser tests

Stop the manual demo first: the automated tests start their own server and use
the same ports and shared mock state. From the repository root:

```sh
npm ci
npx playwright install chromium
npm test
```

The Playwright configuration uses Chromium at 390 × 844 with Dublin time. It
stubs map tiles and freezes browser time; it does not replace testing on a real
phone. The interface supports successful photo deliveries and failed tasks. The
suite also specifies signature capture and periodic refresh flows that are not
yet implemented.

`npm test` first checks frozen test/support files. The approved phone-access change
and added summary checks are recorded in the updated baseline. Existing assertions
were retained; the suite still has five scenarios.

## Connection troubleshooting

- **403 on port 5000:** use port **5083**. macOS may already use 5000 for another service.
- **Laptop works, phone does not:** check the laptop IP, shared network, firewall,
  and hotspot restrictions. The launcher's mapping must be `5083:5000`, without
  the `127.0.0.1:` prefix.
- **Port already allocated:** stop the existing demo/test server before starting another.
- **Missing street tiles:** check internet access; map tiles are fetched separately
  from the local application.
