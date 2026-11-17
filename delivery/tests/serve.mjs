// Test launcher used by Playwright: build the app, start fake APIs, and clean up afterward.
import { spawn, spawnSync } from 'node:child_process';
import { startFakeServices } from './upstream.mjs';

// Rebuild so tests always exercise the current application source.
const build = spawnSync(
  'docker',
  ['build', '-q', '-t', 'driver-poc-tests', '.'],
  { stdio: 'inherit' },
);

if (build.error || build.status !== 0) {
  throw build.error || new Error('Docker test image build failed');
}

const fakeServices = await startFakeServices();
const containerName = `driver-tests-${process.pid}`;
// The browser reaches Java on port 5083; Java reaches the fake APIs on host port 5091.
// All three service URLs point to the same fake server, which handles their routes.
const containerProcess = spawn(
  'docker',
  [
    'run',
    '--rm',
    '--name', containerName,
    '--add-host=host.docker.internal:host-gateway',
    '-p', '5083:5000',
    '-e', 'DCM_BASE_URL=http://host.docker.internal:5091',
    '-e', 'ROUTING_BASE_URL=http://host.docker.internal:5091',
    '-e', 'LOCATION_BASE_URL=http://host.docker.internal:5091',
    'driver-poc-tests',
  ],
  // Keep the Docker client alive until our shutdown handler explicitly stops its container.
  { stdio: 'inherit', detached: true },
);

let stopping = false;

function stopTestServices() {
  // Multiple shutdown signals must not trigger duplicate container-stop commands.
  if (stopping) {
    return;
  }

  stopping = true;
  fakeServices.close();

  const stopContainer = spawn(
    'docker',
    ['stop', containerName],
    { stdio: 'ignore' },
  );
  stopContainer.on('exit', () => process.exit());
}

// Handle both Playwright finishing the run and a developer interrupting it with Ctrl+C.
process.on('SIGTERM', stopTestServices);
process.on('SIGINT', stopTestServices);

containerProcess.on('exit', code => {
  // If the application exits unexpectedly, stop the fake APIs and report its exit code.
  if (!stopping) {
    fakeServices.close();
    process.exit(code || 0);
  }
});
