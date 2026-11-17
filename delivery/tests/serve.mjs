// Test launcher used by Playwright: build the app, start fake APIs, and clean up afterward.
import { spawn, spawnSync } from 'node:child_process';
import { startFakeServices } from './upstream.mjs';

// Integration runs must fail clearly if providers are absent, never silently use
// the fake APIs. URLs must be reachable from inside Docker (not container localhost).
const realServices = process.argv.includes('--real-services');
const serviceKeys = ['DCM_BASE_URL', 'ROUTING_BASE_URL', 'LOCATION_BASE_URL'];
const serviceUrls = serviceKeys.map(key => {
  if (!realServices) return 'http://host.docker.internal:5091';
  if (!process.env[key]) throw new Error(`Real-provider integration requires ${key}`);
  const url = new URL(process.env[key]);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${key} must be an HTTP(S) URL`);
  return url.href;
});

// Rebuild so tests always exercise the current application source.
const build = spawnSync(
  'docker',
  ['build', '-q', '-t', 'driver-poc-tests', '.'],
  { stdio: 'inherit' },
);

if (build.error || build.status !== 0) {
  throw build.error || new Error('Docker test image build failed');
}

const fakeServices = realServices ? null : await startFakeServices();
const containerName = `driver-tests-${process.pid}`;
// The browser reaches Java on port 5083. Local acceptance uses fake APIs on host
// port 5091; integration uses the three explicitly configured provider addresses.
const containerProcess = spawn(
  'docker',
  [
    'run',
    '--rm',
    '--name', containerName,
    '--add-host=host.docker.internal:host-gateway',
    '-p', '5083:5000',
    ...serviceKeys.flatMap((key, index) => ['-e', `${key}=${serviceUrls[index]}`]),
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
  fakeServices?.close();

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
    fakeServices?.close();
    process.exit(code || 0);
  }
});
