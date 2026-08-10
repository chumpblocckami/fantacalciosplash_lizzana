/**
 * Compute fantasy team rankings from punteggi + squadre.
 *
 * Usage: node scripts/build-classifica.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const YEAR = process.env.YEAR || new Date().getFullYear().toString();
const DATA_DIR = join('data', YEAR);

const POINTS_MISSING = -2;

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

function sanitize(raw) {
  if (!raw || !raw.includes('|')) return (raw || '').trim();
  const [player, team] = raw.split('|');
  return `${player.split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')} | ${team.trim().toUpperCase()}`;
}

function main() {
  console.log(`\n🏆 Building classifica for ${YEAR}\n`);

  const punteggi = readJson(join(DATA_DIR, 'punteggi.json'));
  const squadre = readJson(join(DATA_DIR, 'squadre.json'));

  if (!punteggi || !squadre) {
    console.log('  ⚠ Missing punteggi.json or squadre.json. Skipping.');
    return;
  }

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

  for (const team of squadre) {
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

    let total = 0;

    for (const col of matchCols) {
      let activeCount = 0;
      let starterTotal = 0;

      for (const s of starters) {
        const row = scoreMap[s];
        const val = row ? (parseFloat(row[col]) || 0) : POINTS_MISSING;
        starterTotal += val;
        if (val !== POINTS_MISSING) activeCount++;
      }

      let reserveScore = 0;
      if (activeCount < 4 && reserve) {
        const row = scoreMap[reserve];
        reserveScore = row ? (parseFloat(row[col]) || 0) : POINTS_MISSING;
      }

      total += starterTotal + reserveScore;
    }

    // Premi
    if (premiCol) {
      for (const name of players) {
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
