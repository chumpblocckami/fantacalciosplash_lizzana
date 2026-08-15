/**
 * Scrape team and player data from the Calciosplash API and save to local JSON files.
 * Intended to run in GitHub Actions (Node.js).
 *
 * Usage: node scripts/scrape.js
 */

import { writeFileSync, readFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fullName } from './names.js';
import { isGoalkeeper } from './goalkeeper-overrides.js';
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

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
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
  if (!groups?.data) return [];
  saveJson(join(API_DIR, 'groups.json'), groups);

  for (const group of groups.data) {
    const ranking = await fetchJson(`${API_URL}/groups/${group.id}/ranking`);
    if (ranking) saveJson(join(API_DIR, 'groups', `${group.id}`, 'ranking.json'), ranking);
  }
  return groups.data;
}

// What the detail endpoint keeps answering for after a fixture has left the list, and therefore
// what has to be taken from it rather than from the last summary that was published.
const LIVE_FIELDS = [
  'closed', 'live', 'status', 'state', 'state_label', 'half_time',
  'home_score', 'away_score', 'scheduled_at',
];

/** Fixture ids already on disk from an earlier run, whether or not the API still lists them. */
function savedFixtureIds() {
  const dir = join(API_DIR, 'fixtures');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .map(name => Number.parseInt(name, 10))
    .filter(Number.isInteger);
}

/** Team id to the gender and group it plays in, the two things a fixture detail does not say. */
function placeByTeam(groups) {
  const byTeam = new Map();
  for (const group of groups ?? []) {
    for (const team of group.teams ?? []) {
      byTeam.set(team.id, { gender: group.gender, group_name: group.name });
    }
  }
  return byTeam;
}

function slimTeam({ id, name, tag, logo_url } = {}) {
  return { id, name, tag, logo_url };
}

/**
 * The fixture list carries only scores; per-player goals and cards live on the detail endpoint.
 *
 * /api/fixtures drops a fixture the moment the organisers close it, so on its own the list only
 * ever shows matches that have not been played and nothing downstream would score a single one.
 * Every id seen before is therefore carried over and re-read from /api/fixtures/{id}, which does
 * still answer for a closed match, and the list written to disk is the union of the two.
 */
async function scrapeFixtures(groups) {
  console.log('📅 Scraping fixtures...');
  const listed = await fetchJson(`${API_URL}/fixtures`);
  if (!listed?.data) return;

  const known = new Map();
  for (const fixture of readJson(join(API_DIR, 'fixtures.json'))?.data ?? []) {
    known.set(fixture.id, fixture);
  }
  for (const id of savedFixtureIds()) {
    if (!known.has(id)) known.set(id, null);
  }
  for (const fixture of listed.data) {
    known.set(fixture.id, { ...known.get(fixture.id), ...fixture });
  }

  const place = placeByTeam(groups);
  const fixtures = [];

  for (const id of [...known.keys()].sort((a, b) => a - b)) {
    const summary = known.get(id);
    const detail = await fetchJson(`${API_URL}/fixtures/${id}`);
    const played = detail?.data;

    // The organisers withdraw fixtures as well as close them. One that answers with nothing and
    // is no longer summarised anywhere is off the calendar rather than finished.
    if (!played?.home_team) {
      if (summary) fixtures.push(summary);
      continue;
    }
    saveJson(join(API_DIR, 'fixtures', `${id}.json`), detail);

    // gender and group_name are absent from the detail, so they stay as the list last published
    // them; a fixture recovered from disk alone is placed by the group its home team plays in.
    const merged = summary ?? {
      id,
      home_team: slimTeam(played.home_team),
      away_team: slimTeam(played.away_team),
      ...(place.get(played.home_team.id) ?? {}),
    };
    for (const field of LIVE_FIELDS) {
      if (field in played) merged[field] = played[field];
    }
    fixtures.push(merged);
  }

  // Chronological, so the round columns downstream follow the order the matches were played and
  // the file stops reshuffling every time the list endpoint changes length.
  fixtures.sort((a, b) =>
    String(a.scheduled_at ?? '').localeCompare(String(b.scheduled_at ?? '')) || a.id - b.id);

  saveJson(join(API_DIR, 'fixtures.json'), { ...listed, data: fixtures });
  console.log(`  ${fixtures.length} fixtures, ${fixtures.filter(f => f.closed).length} closed`);
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
        Ruolo: isGoalkeeper(player, team.name) ? 'Portiere' : 'Movimento',
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
  const groups = await scrapeGroups();
  await scrapeFixtures(groups);
  const giocatori = buildGiocatori(rosters);

  console.log(`\n✅ Scrape complete: ${rosters.length} teams, ${giocatori.length} players\n`);
}

main().catch(err => {
  console.error('❌ Scrape failed:', err);
  process.exit(1);
});
