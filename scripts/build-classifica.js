/**
 * Compute fantasy team rankings from punteggi + squadre.
 *
 * Usage: node scripts/build-classifica.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

import { POINTS_PER_MISSING_GAME } from '../js/constants.js';

const YEAR = process.env.YEAR || new Date().getFullYear().toString();
const DATA_DIR = join('data', YEAR);

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function normalize(name) {
  return name.toLowerCase().replace(/[''`]/g, "'").replace(/\s+/g, ' ').trim();
}

function levenshtein(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  return m[a.length][b.length];
}

function findClosest(name, candidates) {
  const norm = normalize(name);
  let best = null, bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(norm, normalize(c));
    if (d < bestDist) { bestDist = d; best = c; }
  }
  const maxLen = Math.max(norm.length, normalize(best || '').length);
  return maxLen > 0 && (1 - bestDist / maxLen) >= 0.8 ? best : null;
}

/**
 * Keep one entry per fantallenatore, the most recent one.
 *
 * Coach names are compared the same way player names are, so trailing spaces and case do not
 * let the same person through twice.
 */
function dedupe(squadre) {
  const byCoach = new Map();
  for (const team of squadre) {
    byCoach.set(normalize(team.Fantallenatore || team.fantallenatore || ''), team);
  }
  return [...byCoach.values()];
}

/**
 * One player's score in one match column.
 *
 * Not being in the punteggi at all means the player's real team has not taken the field. Once
 * the knockouts have started that is a phase they never reached and rule 6 applies, but while
 * the girone is still being played it only means their first match has not come round yet, and
 * charging the malus then would show a table of negative scores before anybody had done
 * anything wrong.
 */
function scoreFor(row, column, applyMalus) {
  if (row) return parseFloat(row[column]) || 0;
  return applyMalus ? POINTS_PER_MISSING_GAME : 0;
}

/**
 * Build the test for "this player's team was out of the tournament for this match".
 *
 * compute-scores.js writes eliminazioni.json alongside the punteggi, listing exactly which
 * columns a player missed because their team had gone out. Older editions predate that file,
 * so there is a fallback that infers it from the score. The fallback is only a guess: a defeat
 * with a booking also comes to -2, and it will read as an elimination.
 *
 * @param {Object}  eliminazioni - Player id to the columns their team did not play
 * @param {boolean} known        - Whether eliminazioni.json was there to read
 * @param {Object}  scoreMap     - Player id to their punteggi row
 * @param {boolean} applyMalus   - Whether rule 6 is in force yet
 */
function eliminationTest(eliminazioni, known, scoreMap, applyMalus) {
  return (name, column) => {
    if (!name) return false;
    const row = scoreMap[name];
    // Somebody the sheet names who never took the field counts as unavailable throughout, but
    // only once the knockouts have started. Treating them as out during the girone would spend
    // the reserve on a starter who is merely waiting to play.
    if (!row) return applyMalus;
    return known
      ? (eliminazioni[name] ?? []).includes(column)
      : scoreFor(row, column, applyMalus) === POINTS_PER_MISSING_GAME;
  };
}

function sanitize(raw) {
  if (!raw || !raw.includes('|')) return (raw || '').trim();
  const [player, team] = raw.split('|');
  return `${player.split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')} | ${team.trim().toUpperCase()}`;
}

function main() {
  console.log(`\n🏆 Building classifica for ${YEAR}\n`);

  const punteggi = readJson(join(DATA_DIR, 'punteggi.json'));
  const squadre = readJson(join(DATA_DIR, 'squadre.json'));

  // Both files exist but are empty until the first match is closed.
  if (!punteggi?.length || !squadre?.length) {
    console.log('  ⚠ No punteggi or squadre yet. Skipping.');
    return;
  }

  // Which matches each player missed because their team was out of the tournament, written by
  // compute-scores.js. Without it a genuine -2, which a defeat plus a booking produces, is
  // indistinguishable from an elimination.
  const eliminazioni = readJson(join(DATA_DIR, 'eliminazioni.json'));
  if (!eliminazioni) {
    console.log('  ⚠ No eliminazioni.json; inferring who is out from the scores instead.');
  }

  // Editions that were computed before stato.json existed are all finished ones, so their tables
  // keep the malus they were built with. While the girone is still on, only earned points count.
  const stato = readJson(join(DATA_DIR, 'stato.json'));
  const applyMalus = stato ? Boolean(stato.apply_malus) : true;
  if (!applyMalus) {
    console.log('  ⏳ Girone in progress: points only, rule 6 malus held back until the knockouts.');
  }

  // Regolamento rule 1: one team per participant. The sheet can still hold a repeat, from a
  // rename or a manual edit, and ranking the same lineup twice would distort the table.
  const registered = dedupe(squadre);

  const pKey = 'player' in punteggi[0] ? 'player' : 'NOME';
  const scoreNames = punteggi.map(p => p[pKey]);
  const matchCols = Object.keys(punteggi[0]).filter(k => {
    const kl = k.toLowerCase();
    return kl.startsWith('match') || kl.startsWith('ottavi') || kl.startsWith('quarti')
      || kl.startsWith('semifinal') || kl.startsWith('final') || kl.startsWith('sedicesimi')
      || kl.startsWith('bonus');
  });

  const premiCol = Object.keys(punteggi[0]).find(k => k.toLowerCase().includes('premi'));

  const ranking = [];

  for (const team of registered) {
    const coach = team.Fantallenatore || team.fantallenatore || '';
    const playersRaw = [
      team.Portiere || team.portiere || '',
      team['Titolare 1'] || team['titolare 1'] || '',
      team['Titolare 2'] || team['titolare 2'] || '',
      team['Titolare 3'] || team['titolare 3'] || '',
      team.Riserva || team.riserva || '',
    ].filter(Boolean);

    const players = playersRaw.map(r => findClosest(sanitize(r), scoreNames) || sanitize(r));
    const starters = players.slice(0, 4);
    const reserve = players[4] || null;

    const scoreMap = {};
    for (const name of players) {
      scoreMap[name] = punteggi.find(p => normalize(p[pKey]) === normalize(name));
    }

    const isOut = eliminationTest(eliminazioni ?? {}, eliminazioni !== null, scoreMap, applyMalus);
    let reserveUsed = false;
    let total = 0;

    for (const col of matchCols) {
      const scores = starters.map(name => scoreFor(scoreMap[name], col, applyMalus));

      // Regolamento rules 5 and 6: the reserve comes on the moment one of the starters is
      // eliminated from the tournament, and when a reserve is available to come on there is
      // no malus -- the reserve's score stands in for the starter's. One reserve covers one
      // starter, so if two go out the second keeps the penalty.
      const out = starters.findIndex(name => isOut(name, col));
      if (out !== -1 && reserve && !isOut(reserve, col)) {
        scores[out] = scoreFor(scoreMap[reserve], col, applyMalus);
        reserveUsed = true;
      }

      total += scores.reduce((sum, score) => sum + score, 0);
    }

    // End-of-tournament prizes follow the player, so they count for whoever fielded them.
    // The reserve only counts if they came on, for the same reason their match scores do.
    if (premiCol) {
      const earning = reserveUsed ? players : starters;
      for (const name of earning) {
        const row = scoreMap[name];
        if (row) total += parseFloat(row[premiCol]) || 0;
      }
    }

    ranking.push({
      Allenatore: coach,
      Punteggio: Math.round(total * 10) / 10,
    });
  }

  ranking.sort((a, b) => b.Punteggio - a.Punteggio);

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, 'classifica.json'), JSON.stringify(ranking, null, 2));
  console.log(`  ✓ ${join(DATA_DIR, 'classifica.json')} (${ranking.length} teams)`);
  console.log('\n✅ Classifica complete!\n');
}

main();
