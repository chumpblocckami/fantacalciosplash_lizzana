/**
 * Compute fantasy team rankings from punteggi + squadre.
 *
 * Usage: node scripts/build-classifica.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

import {
  POINTS_PER_MISSING_GAME,
  POINTS_PER_GOAL,
  POINTS_PER_YELLOW_CARD,
  POINTS_PER_RED_CARD,
  POINTS_PER_VICTORY,
  POINTS_PER_DRAW,
  POINTS_PER_DEFEAT,
  POINTS_PER_CLEANSHEET,
  POINTS_PER_CONCEDED_GOAL,
} from '../js/constants.js';
import {
  PHASES,
  PHASE_LABELS,
  isMatchColumn,
  phaseByLabel,
} from '../js/match-phases.js';
import { AWARDS, awardsForPlayer } from '../js/awards.js';

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

const SLOT_LABELS = ['Portiere', 'Titolare 1', 'Titolare 2', 'Titolare 3', 'Riserva'];

function round1(value) {
  return Math.round(value * 10) / 10;
}

/** Split a "Name | TEAM" id into the two halves the squad sheet displays. */
function splitPlayer(id) {
  if (!id || !id.includes('|')) return { name: (id || '').trim(), team: '' };
  const [name, team] = id.split('|');
  return { name: name.trim(), team: team.trim() };
}

/**
 * Reason chips for one match, derived from the raw per-match rating.
 *
 * The rating stores points, not event counts, so a `goals` of 4 is two goals.
 */
function chipsFrom(raw) {
  if (!raw) return [];
  const chips = [];
  const goals = raw.goals / POINTS_PER_GOAL;
  if (goals) {
    chips.push({ kind: 'goals', label: goals === 1 ? '1 gol' : `${goals} gol`, points: raw.goals });
  }
  const yellows = raw.yellow_cards / POINTS_PER_YELLOW_CARD;
  if (yellows) {
    chips.push({
      kind: 'yellow',
      label: yellows === 1 ? '1 giallo' : `${yellows} gialli`,
      points: raw.yellow_cards,
    });
  }
  const reds = raw.red_cards / POINTS_PER_RED_CARD;
  if (reds) {
    chips.push({
      kind: 'red',
      label: reds === 1 ? '1 rosso' : `${reds} rossi`,
      points: raw.red_cards,
    });
  }
  if (raw.team_points === POINTS_PER_VICTORY) {
    chips.push({ kind: 'win', label: 'vittoria', points: raw.team_points });
  } else if (raw.team_points === POINTS_PER_DRAW) {
    chips.push({ kind: 'draw', label: 'pareggio', points: raw.team_points });
  } else if (raw.team_points === POINTS_PER_DEFEAT) {
    chips.push({ kind: 'loss', label: 'sconfitta', points: raw.team_points });
  }
  if (raw.goalkeeper_points === POINTS_PER_CLEANSHEET) {
    chips.push({ kind: 'cleansheet', label: 'clean sheet', points: raw.goalkeeper_points });
  } else if (raw.goalkeeper_points) {
    const conceded = raw.goalkeeper_points / POINTS_PER_CONCEDED_GOAL;
    chips.push({
      kind: 'conceded',
      label: conceded === 1 ? '1 gol subito' : `${conceded} gol subiti`,
      points: raw.goalkeeper_points,
    });
  }
  if (raw.mvp_points) {
    chips.push({ kind: 'mvp', label: 'MVP', points: raw.mvp_points });
  }
  return chips;
}

function chipsFor(raw, ownScore, status) {
  if (raw) return chipsFrom(raw);
  if (status === 'eliminato' && ownScore === POINTS_PER_MISSING_GAME) {
    return [{ kind: 'malus', label: 'fase non disputata', points: ownScore }];
  }
  return [];
}

/**
 * A 0 in the girone with no raw rating means the team has not played this round yet.
 *
 * A player who took the field and scored nothing still has a raw entry (a defeat is stored
 * with team_points 0), so they are not mistaken for waiting. Once the malus is on, a missing
 * round is an elimination and is handled before this is asked.
 */
function isUnplayed(raw, ownScore, applyMalus) {
  if (applyMalus) return false;
  if (raw) return false;
  return ownScore === 0;
}

/** Every phase label, or legacy Match columns when the edition predates named phases. */
function collectPhaseColumns(punteggi) {
  const legacy = new Set();
  for (const row of punteggi) {
    for (const key of Object.keys(row)) {
      if (/^Match \d+$/.test(key)) legacy.add(key);
    }
  }
  if (legacy.size) {
    return [...legacy].sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
  }
  return PHASE_LABELS;
}

/**
 * Whether the real team skipped an optional phase (Playoff).
 *
 * @param {Object|null} row - Punteggi row for the player
 * @param {string}      label - Phase label
 * @param {string[]}    teamPhaseList - Phases this real team played (from fasi.json)
 */
function skippedOptionalPhase(row, label, teamPhaseList) {
  const phase = phaseByLabel(label);
  if (!phase || phase.required) return false;
  if (teamPhaseList.includes(label)) return false;
  if (row && Object.prototype.hasOwnProperty.call(row, label)) return false;
  return true;
}

/** Phases played by the real team behind a "Name | TEAM" id. */
function teamPhasesFor(playerId, fasiPerTeam) {
  if (!playerId?.includes('|')) return [];
  const team = playerId.split('|').pop().trim();
  return fasiPerTeam[team] ?? [];
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

  const fasiPerTeam = readJson(join(DATA_DIR, 'fasi.json')) ?? {};
  const premiWinners = readJson(join(DATA_DIR, 'premi.json'));

  // Editions that were computed before stato.json existed are all finished ones, so their tables
  // keep the malus they were built with. While the girone is still on, only earned points count.
  const stato = readJson(join(DATA_DIR, 'stato.json'));
  const applyMalus = stato ? Boolean(stato.apply_malus) : true;
  if (!applyMalus) {
    console.log('  ⏳ Girone in progress: points only, rule 6 malus held back until the ottavi.');
  }

  // Regolamento rule 1: one team per participant. The sheet can still hold a repeat, from a
  // rename or a manual edit, and ranking the same lineup twice would distort the table.
  const registered = dedupe(squadre);

  const pKey = 'player' in punteggi[0] ? 'player' : 'NOME';
  const scoreNames = punteggi.map(p => p[pKey]);
  const phaseCols = collectPhaseColumns(punteggi);
  const usesNamedPhases = phaseCols.some(label => phaseByLabel(label));

  const premiCol = Object.keys(punteggi[0]).find(k => k.toLowerCase().includes('premi'));

  // Per-match ingredients keyed by phase label (or legacy Match N index).
  const rawRatings = readJson(join('assets', YEAR, 'punteggi.json')) ?? {};

  const sheets = [];

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

    const slots = players.map((name, i) => ({
      slot: SLOT_LABELS[i],
      player: name,
      ...splitPlayer(name),
      counted_total: 0,
      premi: 0,
      matches: [],
    }));

    const phaseScore = (name, col) => {
      const row = scoreMap[name];
      const teamPhases = teamPhasesFor(name, fasiPerTeam);
      if (skippedOptionalPhase(row, col, teamPhases)) return 0;
      const phase = phaseByLabel(col);
      if (phase && !phase.countsForFanta && teamPhases.includes(col)) return 0;
      return scoreFor(row, col, applyMalus);
    };

    for (let mi = 0; mi < phaseCols.length; mi++) {
      const col = phaseCols[mi];
      const scores = starters.map(name => phaseScore(name, col));

      // Regolamento rules 5 and 6: the reserve comes on the moment one of the starters is
      // eliminated from the tournament, and when a reserve is available to come on there is
      // no malus -- the reserve's score stands in for the starter's. One reserve covers one
      // starter, so if two go out the second keeps the penalty.
      const out = starters.findIndex(name => isOut(name, col));
      const reserveComesOn = out !== -1 && reserve && !isOut(reserve, col);
      if (reserveComesOn) {
        scores[out] = phaseScore(reserve, col);
        reserveUsed = true;
      }

      total += scores.reduce((sum, score) => sum + score, 0);

      for (let i = 0; i < slots.length; i++) {
        const name = players[i];
        const isReserve = slots[i].slot === 'Riserva';
        const row = scoreMap[name];
        const ownScore = scoreFor(row, col, applyMalus);
        const raw = usesNamedPhases
          ? rawRatings[name]?.[col]
          : (rawRatings[name] ?? [])[mi];
        const eliminated = isOut(name, col);
        const teamPhases = teamPhasesFor(name, fasiPerTeam);
        const optionalSkip = skippedOptionalPhase(row, col, teamPhases);
        const finaleNoFanta = col === 'Finale' && teamPhases.includes('Finale')
          && ownScore === 0 && !eliminated && !raw;

        let status;
        let counted;
        if (optionalSkip) {
          status = 'non_disputato';
          counted = false;
        } else if (finaleNoFanta) {
          status = 'in_campo';
          counted = false;
        } else if (isReserve) {
          status = reserveComesOn ? 'subentrato' : 'panchina';
          counted = reserveComesOn;
        } else if (reserveComesOn && i === out) {
          status = 'eliminato';
          counted = false;
        } else if (eliminated) {
          status = 'eliminato';
          counted = true;
        } else if (isUnplayed(raw, ownScore, applyMalus)) {
          status = 'non_giocato';
          counted = true;
        } else {
          status = 'in_campo';
          counted = true;
        }

        slots[i].matches.push({
          column: col,
          phase: col,
          status,
          counted,
          total: optionalSkip ? null : (finaleNoFanta ? 0 : ownScore),
          chips: optionalSkip || finaleNoFanta ? [] : chipsFor(raw, ownScore, status),
        });
        if (counted) slots[i].counted_total += ownScore;
      }
    }

    // End-of-tournament prizes follow the player, so they count for whoever fielded them.
    // The reserve only counts if they came on, for the same reason their match scores do.
    const earning = new Set(reserveUsed ? players : starters);
    for (const slot of slots) {
      if (!earning.has(slot.player)) {
        slot.awards = [];
        slot.premi = 0;
        continue;
      }
      if (premiWinners) {
        slot.awards = awardsForPlayer(slot.player, premiWinners);
        slot.premi = slot.awards.reduce((sum, award) => sum + award.points, 0);
      } else if (premiCol) {
        const row = scoreMap[slot.player];
        const prize = row ? parseFloat(row[premiCol]) || 0 : 0;
        slot.premi = prize;
        slot.awards = prize
          ? [{ id: 'premi', label: 'Premi', points: prize }]
          : [];
      } else {
        slot.awards = [];
        slot.premi = 0;
      }
      slot.counted_total += slot.premi;
      total += slot.premi;
    }

    for (const slot of slots) slot.counted_total = round1(slot.counted_total);

    sheets.push({
      Allenatore: coach,
      Punteggio: round1(total),
      players: slots,
    });
  }

  sheets.sort((a, b) => b.Punteggio - a.Punteggio);
  const ranked = sheets.map((sheet, index) => ({
    Allenatore: sheet.Allenatore,
    Punteggio: sheet.Punteggio,
    rank: index + 1,
    players: sheet.players,
  }));
  const ranking = ranked.map(({ Allenatore, Punteggio }) => ({ Allenatore, Punteggio }));

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, 'classifica.json'), JSON.stringify(ranking, null, 2) + '\n');
  console.log(`  ✓ ${join(DATA_DIR, 'classifica.json')} (${ranking.length} teams)`);
  writeFileSync(join(DATA_DIR, 'dettaglio.json'), JSON.stringify(ranked, null, 2) + '\n');
  console.log(`  ✓ ${join(DATA_DIR, 'dettaglio.json')}`);
  console.log('\n✅ Classifica complete!\n');
}

main();
