import { POINTS_PER_MISSING_GAME } from './constants.js';

/**
 * Normalize a player name for fuzzy matching.
 * Handles differences like "Rita Levi's" vs "RITA LEVI'S", extra spaces, etc.
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Find the closest matching player name from the scores list.
 */
function findClosestPlayer(playerName, scorePlayerNames) {
  const normalized = normalizeName(playerName);
  let bestMatch = null;
  let bestDist = Infinity;

  for (const candidate of scorePlayerNames) {
    const dist = levenshtein(normalized, normalizeName(candidate));
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = candidate;
    }
  }

  const maxLen = Math.max(normalized.length, normalizeName(bestMatch || '').length);
  const ratio = maxLen > 0 ? 1 - bestDist / maxLen : 0;

  return ratio >= 0.8 ? bestMatch : null;
}

/**
 * Compute the fantasy classifica (ranking) from punteggi (player scores) and squadre (registered teams).
 *
 * Port of bets.py with corrected substitute logic:
 * - The reserve enters only when a starter's team is eliminated (score = POINTS_PER_MISSING_GAME for all remaining matches)
 *
 * @param {Object[]} punteggi - Player scores array [{player, "Match 1", ..., Total}, ...]
 * @param {Object[]} squadre  - Registered teams [{Fantallenatore, Portiere, "Titolare 1", ...}, ...]
 * @returns {Object[]} Sorted ranking [{allenatore, punteggio, dettaglio}, ...]
 */
export function computeClassifica(punteggi, squadre) {
  if (!punteggi?.length || !squadre?.length) return [];

  const playerKey = findPlayerKey(punteggi[0]);
  const scorePlayerNames = punteggi.map(p => p[playerKey]);
  const matchColumns = getMatchColumns(punteggi[0]);
  const ranking = [];

  for (const team of squadre) {
    const coach = team.Fantallenatore || team.fantallenatore || '';
    const myPlayersRaw = [
      team.Portiere || team.portiere || '',
      team['Titolare 1'] || team['titolare 1'] || '',
      team['Titolare 2'] || team['titolare 2'] || '',
      team['Titolare 3'] || team['titolare 3'] || '',
      team.Riserva || team.riserva || '',
    ].filter(Boolean);

    const myPlayers = myPlayersRaw.map(raw => {
      const sanitized = sanitizePlayerName(raw);
      return findClosestPlayer(sanitized, scorePlayerNames) || sanitized;
    });

    const starterNames = myPlayers.slice(0, 4); // GK + 3 starters
    const reserveName = myPlayers[4] || null;

    // Build a score lookup for this team's players
    const playerScores = {};
    for (const name of myPlayers) {
      const row = punteggi.find(p => normalizeName(p[playerKey]) === normalizeName(name));
      if (row) playerScores[name] = row;
    }

    let totalScore = 0;
    const matchDetails = {};

    for (const col of matchColumns) {
      // Check which starters are eliminated (score = MISSING_GAME penalty)
      let activeCount = 0;
      let starterTotal = 0;
      let reserveUsed = false;

      for (const starter of starterNames) {
        const row = playerScores[starter];
        const val = row ? (parseFloat(row[col]) || 0) : POINTS_PER_MISSING_GAME;
        starterTotal += val;
        if (val !== POINTS_PER_MISSING_GAME) {
          activeCount++;
        }
      }

      // Reserve enters only when a starter is eliminated
      let reserveScore = 0;
      if (activeCount < 4 && reserveName) {
        const reserveRow = playerScores[reserveName];
        reserveScore = reserveRow ? (parseFloat(reserveRow[col]) || 0) : POINTS_PER_MISSING_GAME;
        reserveUsed = true;
      }

      const matchTotal = starterTotal + reserveScore;
      matchDetails[col] = matchTotal;
      totalScore += matchTotal;
    }

    // Add "Premi" column if present
    const premiCol = findPremiColumn(punteggi[0]);
    if (premiCol) {
      let premiTotal = 0;
      for (const name of myPlayers) {
        const row = playerScores[name];
        if (row) premiTotal += parseFloat(row[premiCol]) || 0;
      }
      matchDetails['Premi'] = premiTotal;
      totalScore += premiTotal;
    }

    ranking.push({
      allenatore: coach,
      punteggio: Math.round(totalScore * 10) / 10,
      dettaglio: matchDetails,
    });
  }

  ranking.sort((a, b) => b.punteggio - a.punteggio);
  return ranking;
}

// ===== HELPERS =====

function sanitizePlayerName(raw) {
  if (!raw.includes('|')) return raw.trim();
  const [player, team] = raw.split('|');
  return `${player.split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')} | ${team.trim().toUpperCase()}`;
}

function findPlayerKey(row) {
  if ('player' in row) return 'player';
  if ('NOME' in row) return 'NOME';
  return Object.keys(row)[0];
}

function getMatchColumns(row) {
  return Object.keys(row).filter(k => {
    const kl = k.toLowerCase();
    return kl.startsWith('match') || kl.startsWith('ottavi') || kl.startsWith('quarti')
      || kl.startsWith('semifinal') || kl.startsWith('final') || kl.startsWith('sedicesimi')
      || kl.startsWith('bonus');
  });
}

function findPremiColumn(row) {
  for (const k of Object.keys(row)) {
    if (k.toLowerCase().includes('premi')) return k;
  }
  return null;
}
