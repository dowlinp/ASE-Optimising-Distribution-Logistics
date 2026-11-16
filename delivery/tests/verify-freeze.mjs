// Detect changes to approved tests and their support files using the baseline's SHA-256 hashes.
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function listFiles(directory) {
  // Include nested files so newly added, unapproved test support is also detected.
  const entries = readdirSync(directory, { withFileTypes: true });

  return entries.flatMap(entry => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

// No update mode: an approved readability or scope change needs a new baseline.
const manifestPath = 'delivery/tests/baseline.json';
const localManifest = readFileSync(manifestPath, 'utf8');
const approvedCommit = process.env.TEST_BASELINE_SHA;

// An optional committed baseline anchors the check outside the current working copy.
// Without it, only consistency with the local baseline.json is verified.
if (approvedCommit && !/^[a-f0-9]{40}$/.test(approvedCommit)) {
  throw new Error('TEST_BASELINE_SHA must be a full commit SHA');
}

let approvedManifest = localManifest;
if (approvedCommit) {
  approvedManifest = execFileSync(
    'git',
    ['show', `${approvedCommit}:${manifestPath}`],
    { encoding: 'utf8' },
  );
}

if (approvedManifest !== localManifest) {
  throw new Error('Baseline manifest differs from the approved commit');
}

const expectedFileHashes = JSON.parse(approvedManifest);

// Reject extra files as well as edits to existing files in this delivery test suite.
for (const file of listFiles('delivery/tests')) {
  if (file !== manifestPath && !(file in expectedFileHashes)) {
    throw new Error(`Unapproved test/support file: ${file}`);
  }
}

for (const [file, expectedHash] of Object.entries(expectedFileHashes)) {
  // Compare the current file's contents with the hash recorded at baseline approval.
  const currentHash = sha256(readFileSync(file));

  if (currentHash !== expectedHash) {
    throw new Error(`Frozen test/support file changed: ${file}`);
  }

  if (approvedCommit) {
    // Also confirm that the hash describes the file in the approved commit itself.
    const committedContents = execFileSync('git', ['show', `${approvedCommit}:${file}`]);

    if (sha256(committedContents) !== expectedHash) {
      throw new Error(`Manifest does not describe approved file: ${file}`);
    }
  }
}

const verifiedFileCount = Object.keys(expectedFileHashes).length;
const baselineDescription = approvedCommit
  ? ` against ${approvedCommit}`
  : ' (local manifest; set TEST_BASELINE_SHA to anchor to your committed baseline)';

console.log(`Verified ${verifiedFileCount} frozen files${baselineDescription}.`);
