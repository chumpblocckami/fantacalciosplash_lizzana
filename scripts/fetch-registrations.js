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

const ATTEMPTS = 3;
const TIMEOUT_MS = 60_000;

/**
 * Read the team list from the Apps Script web app, retrying on timeout.
 *
 * A cold Apps Script deployment answers the first call of the hour in tens of seconds, and the
 * answer is every lineup rather than a summary, so a single 30s attempt loses the whole list and
 * leaves the classifica ranking yesterday's teams.
 *
 * @returns {Promise<Object[]>} Registered teams
 */
async function fetchSquadre() {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const resp = await fetch(REGISTRATION_ENDPOINT, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} from the registration endpoint`);

      const squadre = await resp.json();
      if (!Array.isArray(squadre)) {
        throw new Error('The registration endpoint did not return a list of teams');
      }
      return squadre;
    } catch (err) {
      lastError = err;
      console.log(`  ⏳ Attempt ${attempt}/${ATTEMPTS} failed: ${err.message}`);
    }
  }
  throw lastError;
}

async function main() {
  console.log(`\n📥 Fetching registrations for ${YEAR}\n`);

  if (!REGISTRATION_ENDPOINT) {
    console.log('  ⚠ REGISTRATION_ENDPOINT is empty in js/constants.js. Skipping.');
    return;
  }

  const squadre = await fetchSquadre();

  mkdirSync(join(OUTPUT, '..'), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(squadre, null, 2));
  console.log(`  ✓ ${OUTPUT} (${squadre.length} squadre)\n`);
}

// A failure here must not take the run down with it. This step is one of four in the
// tournament-day workflow, and the two before it have already recomputed the scores; exiting
// non-zero would skip the commit and throw those away for the sake of a registration list
// that has not changed since the deadline anyway. The previous squadre.json stays in place.
main().catch(err => {
  console.error(`❌ Could not fetch registrations: ${err.message}`);
  console.error('   Keeping the existing squadre.json and carrying on.');
});
