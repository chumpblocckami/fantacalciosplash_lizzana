/**
 * Compute fantasy scores from scraped API data.
 * Reads local JSON files from assets/YEAR/api/ and outputs to data/YEAR/.
 *
 * Usage: node scripts/compute-scores.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fullName } from './names.js';

const YEAR = process.env.YEAR || new Date().getFullYear().toString();
const API_DIR = join('assets', YEAR, 'api');
const DATA_DIR = join('data', YEAR);

// Scoring constants (must match js/constants.js)
const POINTS = {
  GOAL: 2,
  YELLOW_CARD: -2,
  RED_CARD: -3,
  VICTORY: 2,
  DRAW: 1,
  DEFEAT: 0,
  MISSING_GAME: -2,
  CLEANSHEET: 5,
  CONCEDED_GOAL: -0.5,
  MVP: 3,
};

// The fantacalcio only covers the men's tournament.
const GENDER = 'male';

// Groups the organisers use for rehearsals, never part of the real tournament.
const EXCLUDED_GROUPS = ['test grafico'];

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJson(path, data) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`  ✓ ${path}`);
}

/**
 * A fixture only counts once the organisers have closed it.
 */
function isPlayed(fixture) {
  return fixture.closed === true || fixture.status === 'finished';
}

function isRelevant(fixture) {
  return (
    fixture.gender === GENDER &&
    !EXCLUDED_GROUPS.includes((fixture.group_name ?? '').toLowerCase())
  );
}

function emptyMatchPoints(teamPoints) {
  return {
    goals: 0,
    yellow_cards: 0,
    red_cards: 0,
    team_points: teamPoints,
    goalkeeper_points: 0,
    mvp_points: 0,
    total_points: teamPoints,
  };
}

function computeMatchPoints(player, teamScore, concededGoals, isMvp) {
  const goalPts = (player.goals ?? 0) * POINTS.GOAL;
  const yellowPts = (player.yellow_cards ?? 0) * POINTS.YELLOW_CARD;
  const redPts = (player.red_cards ?? 0) * POINTS.RED_CARD;
  const teamPts = teamScore > concededGoals ? POINTS.VICTORY
    : teamScore < concededGoals ? POINTS.DEFEAT : POINTS.DRAW;
  const gkPts = !player.is_goalkeeper ? 0
    : concededGoals === 0 ? POINTS.CLEANSHEET : concededGoals * POINTS.CONCEDED_GOAL;
  const mvpPts = isMvp ? POINTS.MVP : 0;

  return {
    goals: goalPts,
    yellow_cards: yellowPts,
    red_cards: redPts,
    team_points: teamPts,
    goalkeeper_points: gkPts,
    mvp_points: mvpPts,
    total_points: goalPts + yellowPts + redPts + teamPts + gkPts + mvpPts,
  };
}

function processTeam(team, concededGoals, ratings, mvpId) {
  if (!ratings[team.name]) ratings[team.name] = {};

  const seen = new Set();
  for (const player of [...(team.players ?? []), ...(team.substitutes ?? [])]) {
    if (seen.has(player.id)) continue;
    seen.add(player.id);

    const playerId = `${fullName(player)} | ${team.name}`;
    if (!ratings[team.name][playerId]) ratings[team.name][playerId] = [];
    ratings[team.name][playerId].push(
      computeMatchPoints(player, team.score, concededGoals, mvpId !== null && player.id === mvpId)
    );
  }
}

/**
 * Teams that never reached the knockout stage lose points for every round they missed.
 * Who qualified is read off the knockout fixtures themselves rather than a fixed cut-off,
 * so the malus follows whatever bracket size the organisers pick.
 */
function applyEliminationMalus(ratings, groupStageTeams, knockoutTeams, rounds) {
  if (!rounds) return;

  for (const team of groupStageTeams) {
    if (!ratings[team]) continue;
    const points = knockoutTeams.has(team) ? 0 : POINTS.MISSING_GAME;
    for (const playerId of Object.keys(ratings[team])) {
      for (let i = 0; i < rounds; i++) {
        ratings[team][playerId].push(emptyMatchPoints(points));
      }
    }
  }
}

function main() {
  console.log(`\n🧮 Computing scores for ${YEAR}\n`);

  const fixtureList = readJson(join(API_DIR, 'fixtures.json'))?.data;
  if (!fixtureList) {
    console.log('  ⚠ No fixtures.json found. Run the scraper first.');
    return;
  }

  const groups = readJson(join(API_DIR, 'groups.json'))?.data ?? [];
  const knockoutGroups = new Set(
    groups.filter(g => g.gender === GENDER && g.kind !== 'girone').map(g => g.name)
  );

  const ratings = {};              // { teamName: { playerId: [MatchPoints, ...] } }
  const results = [];              // [{ home, away, score, stage }]
  const groupStageTeams = new Set();
  const knockoutTeams = new Set();
  const knockoutRounds = new Set();
  let skipped = 0;

  for (const fixture of fixtureList) {
    if (!isRelevant(fixture)) continue;
    if (!isPlayed(fixture)) {
      skipped++;
      continue;
    }

    const detail = readJson(join(API_DIR, 'fixtures', `${fixture.id}.json`))?.data;
    if (!detail?.home_team || !detail?.away_team) continue;

    const home = detail.home_team;
    const away = detail.away_team;
    const mvpId = detail.best_player?.id ?? null;
    const stage = fixture.group_name;

    processTeam(home, away.score, ratings, mvpId);
    processTeam(away, home.score, ratings, mvpId);

    const bucket = knockoutGroups.has(stage) ? knockoutTeams : groupStageTeams;
    bucket.add(home.name);
    bucket.add(away.name);
    if (knockoutGroups.has(stage)) knockoutRounds.add(stage);

    results.push({
      home: home.name,
      away: away.name,
      score: `${home.score}-${away.score}`,
      stage,
    });
  }

  console.log(`  Processed ${results.length} matches (${skipped} not played yet)`);
  applyEliminationMalus(ratings, groupStageTeams, knockoutTeams, knockoutRounds.size);

  // Build punteggi table
  const punteggiRows = [];
  let maxMatches = 0;

  for (const teamData of Object.values(ratings)) {
    for (const [playerId, matchList] of Object.entries(teamData)) {
      maxMatches = Math.max(maxMatches, matchList.length);
      const row = { player: playerId };
      let total = 0;
      for (let i = 0; i < matchList.length; i++) {
        row[`Match ${i + 1}`] = matchList[i].total_points;
        total += matchList[i].total_points;
      }
      row.Premi = 0;
      row.Total = Math.round(total * 10) / 10;
      punteggiRows.push(row);
    }
  }

  // Players whose team played fewer matches are charged for the ones they missed
  for (const row of punteggiRows) {
    for (let i = 1; i <= maxMatches; i++) {
      if (row[`Match ${i}`] === undefined) {
        row[`Match ${i}`] = POINTS.MISSING_GAME;
        row.Total = Math.round((row.Total + POINTS.MISSING_GAME) * 10) / 10;
      }
    }
  }

  punteggiRows.sort((a, b) => b.Total - a.Total);

  writeJson(join(DATA_DIR, 'punteggi.json'), punteggiRows);
  writeJson(join(DATA_DIR, 'risultati.json'), results);

  // Raw per-match ratings, used to rebuild history.json
  const rawRatings = {};
  for (const teamData of Object.values(ratings)) {
    for (const [player, matches] of Object.entries(teamData)) {
      rawRatings[player] = matches;
    }
  }
  writeJson(join('assets', YEAR, 'punteggi.json'), rawRatings);

  console.log(`\n✅ Computed ${punteggiRows.length} player scores, ${results.length} match results\n`);
}

main();
