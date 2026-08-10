/**
 * Scrape team and player data from the Calciosplash API and save to local JSON files.
 * Intended to run in GitHub Actions (Node.js).
 *
 * Usage: node scripts/scrape.js
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fullName } from './names.js';
import { GSP_API_URL } from '../js/constants.js';

const API_URL = process.env.GSP_API_URL || GSP_API_URL;
const YEAR = process.env.YEAR || new Date().getFullYear().toString();
const API_DIR = join('assets', YEAR, 'api');
const DATA_DIR = join('data', YEAR);

async function fetchJson(url) {
  const resp = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) {
    if (resp.status === 404) return null;
    throw new Error(`HTTP ${resp.status} from ${url}`);
  }
  return resp.json();
}

function saveJson(path, data) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`  ✓ ${path}`);
}

async function scrapeTeams() {
  console.log('👥 Scraping teams...');
  const teams = await fetchJson(`${API_URL}/teams`);
  if (!teams?.data) throw new Error('No teams returned by the API');
  saveJson(join(API_DIR, 'teams.json'), teams);

  const rosters = [];
  for (const team of teams.data) {
    const detail = await fetchJson(`${API_URL}/teams/${team.id}`);
    if (!detail?.data) {
      console.log(`  ⏭ No detail for team ${team.id} (${team.name})`);
      continue;
    }
    saveJson(join(API_DIR, 'teams', `${team.id}.json`), detail);
    rosters.push({ ...detail.data, gender: team.gender });
  }
  return rosters;
}

async function scrapeGroups() {
  console.log('📋 Scraping groups...');
  const groups = await fetchJson(`${API_URL}/groups?all=1`);
  if (!groups?.data) return;
  saveJson(join(API_DIR, 'groups.json'), groups);

  for (const group of groups.data) {
    const ranking = await fetchJson(`${API_URL}/groups/${group.id}/ranking`);
    if (ranking) saveJson(join(API_DIR, 'groups', `${group.id}`, 'ranking.json'), ranking);
  }
}

/**
 * The fixture list carries only scores; per-player goals and cards live on the detail endpoint.
 */
async function scrapeFixtures() {
  console.log('📅 Scraping fixtures...');
  const fixtures = await fetchJson(`${API_URL}/fixtures`);
  if (!fixtures?.data) return;
  saveJson(join(API_DIR, 'fixtures.json'), fixtures);

  for (const fixture of fixtures.data) {
    const detail = await fetchJson(`${API_URL}/fixtures/${fixture.id}`);
    if (detail) saveJson(join(API_DIR, 'fixtures', `${fixture.id}.json`), detail);
  }
}

/**
 * Build data/YEAR/giocatori.json from the scraped rosters.
 *
 * Only the men's tournament is covered by the fantacalcio; the women's teams stay in the raw
 * API snapshots. The API does not expose Quotazione, so any price already assigned by
 * scripts/assign_quotazioni.py is carried over rather than overwritten.
 */
function buildGiocatori(rosters) {
  console.log('📝 Building giocatori.json...');
  const path = join(DATA_DIR, 'giocatori.json');
  const existing = new Map();
  if (existsSync(path)) {
    for (const player of JSON.parse(readFileSync(path, 'utf-8'))) {
      existing.set(`${player.Nominativo}|${player.Squadra}`, player.Quotazione);
    }
  }

  const giocatori = [];
  for (const team of rosters.filter(t => t.gender !== 'female')) {
    for (const player of team.players ?? []) {
      const name = fullName(player);
      giocatori.push({
        Nominativo: name,
        Squadra: team.name,
        Soprannome: player.username ?? '',
        Quotazione: existing.get(`${name}|${team.name}`) ?? null,
        Ruolo: player.is_goalkeeper ? 'Portiere' : 'Movimento',
      });
    }
  }

  const priced = giocatori.filter(g => g.Quotazione !== null).length;
  console.log(`  Carried over ${priced} existing quotazioni`);
  saveJson(path, giocatori);
  return giocatori;
}

async function main() {
  console.log(`\n🏟 Scraping Calciosplash API for ${YEAR}\n`);
  console.log(`API: ${API_URL}\n`);

  const rosters = await scrapeTeams();
  await scrapeGroups();
  await scrapeFixtures();
  const giocatori = buildGiocatori(rosters);

  console.log(`\n✅ Scrape complete: ${rosters.length} teams, ${giocatori.length} players\n`);
}

main().catch(err => {
  console.error('❌ Scrape failed:', err);
  process.exit(1);
});
