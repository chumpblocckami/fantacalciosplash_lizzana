/**
 * Pull the registered fantasy teams from the Apps Script web app into squadre.json,
 * which is what scripts/build-classifica.js ranks.
 *
 * Usage: node scripts/fetch-registrations.js
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { REGISTRATION_ENDPOINT } from '../js/constants.js';

const YEAR = process.env.YEAR || new Date().getFullYear().toString();
const OUTPUT = join('data', YEAR, 'squadre.json');

async function main() {
  console.log(`\n📥 Fetching registrations for ${YEAR}\n`);

  if (!REGISTRATION_ENDPOINT) {
    console.log('  ⚠ REGISTRATION_ENDPOINT is empty in js/constants.js. Skipping.');
    return;
  }

  const resp = await fetch(REGISTRATION_ENDPOINT, { signal: AbortSignal.timeout(30_000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} from the registration endpoint`);

  const squadre = await resp.json();
  if (!Array.isArray(squadre)) {
    throw new Error('The registration endpoint did not return a list of teams');
  }

  mkdirSync(join(OUTPUT, '..'), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(squadre, null, 2));
  console.log(`  ✓ ${OUTPUT} (${squadre.length} squadre)\n`);
}

main().catch(err => {
  console.error('❌ Could not fetch registrations:', err.message);
  process.exit(1);
});
