/**
 * Compute fantasy scores from scraped API data.
 * Reads local JSON files from assets/YEAR/api/ and outputs to data/YEAR/.
 *
 * Usage: node scripts/compute-scores.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fullName } from './names.js';
import {
  POINTS_PER_GOAL,
  POINTS_PER_YELLOW_CARD,
  POINTS_PER_RED_CARD,
  POINTS_PER_VICTORY,
  POINTS_PER_DRAW,
  POINTS_PER_DEFEAT,
  POINTS_PER_MISSING_GAME,
  POINTS_PER_CLEANSHEET,
  POINTS_PER_CONCEDED_GOAL,
  POINTS_MVP,
  POINTS_TOP_SCORER,
} from '../js/constants.js';

const YEAR = process.env.YEAR || new Date().getFullYear().toString();
const API_DIR = join('assets', YEAR, 'api');
const DATA_DIR = join('data', YEAR);

// The fantacalcio only covers the men's tournament.
const GENDER = 'male';

// Groups the organisers use for rehearsals, never part of the real tournament.
const EXCLUDED_GROUPS = ['test grafico'];

// Regolamento rule 8: "La finale 3 / 4 posto non conta ai fini dei punteggi fanta, contera
// invece per le classifiche capocannonieri." Written as a pattern because the organisers spell
// the group differently from year to year: "Terzo/Quarto M", "terzo quarto", "3/4 M".
const THIRD_PLACE_PLAY_OFF = /(terzo\s*[/ ]\s*quarto|3\s*\/\s*4)/i;

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

/**
 * Whether a fixture belongs to the knockout / elimination stage rather than the girone.
 *
 * Rule 6's malus is for a phase a team did not reach. During the group stage that cannot be
 * told apart from a phase it has not played yet, so the penalty stays off the table until at
 * least one men's knockout match has been closed. The group's `kind` is the usual signal;
 * the name is the fallback for a listing that has no groups.json, or that names the round
 * "Semifinali M" / "Ottavi" without setting kind.
 */
function isKnockout(fixture, groupsByName) {
  const name = fixture.group_name ?? '';
  if (THIRD_PLACE_PLAY_OFF.test(name)) return true;
  const kind = groupsByName.get(name)?.kind;
  if (kind && kind.toLowerCase() !== 'girone') return true;
  return /(ottavi|quarti|semifinali?|finale|playoffs?|sedicesimi)/i.test(name);
}

function computeMatchPoints(player, teamScore, concededGoals, isMvp) {
  const goalPts = (player.goals ?? 0) * POINTS_PER_GOAL;
  const yellowPts = (player.yellow_cards ?? 0) * POINTS_PER_YELLOW_CARD;
  const redPts = (player.red_cards ?? 0) * POINTS_PER_RED_CARD;
  const teamPts = teamScore > concededGoals ? POINTS_PER_VICTORY
    : teamScore < concededGoals ? POINTS_PER_DEFEAT : POINTS_PER_DRAW;
  const gkPts = !player.is_goalkeeper ? 0
    : concededGoals === 0 ? POINTS_PER_CLEANSHEET : concededGoals * POINTS_PER_CONCEDED_GOAL;
  const mvpPts = isMvp ? POINTS_MVP : 0;

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

/** Every player a team named for a fixture, each one only once. */
function squad(team) {
  const seen = new Map();
  for (const player of [...(team.players ?? []), ...(team.substitutes ?? [])]) {
    if (!seen.has(player.id)) seen.set(player.id, player);
  }
  return [...seen.values()];
}

function main() {
  console.log(`\n🧮 Computing scores for ${YEAR}\n`);

  const fixtureList = readJson(join(API_DIR, 'fixtures.json'))?.data;
  if (!fixtureList) {
    console.log('  ⚠ No fixtures.json found. Run the scraper first.');
    return;
  }

  const groupsByName = new Map(
    (readJson(join(API_DIR, 'groups.json'))?.data ?? []).map(group => [group.name, group])
  );

  const rosters = new Map();       // team -> Set(playerId), everyone who ever played for it
  const scored = new Map();        // `fixtureId::team` -> Map(playerId -> MatchPoints)
  const teamFixtures = new Map();  // team -> [fixtureId], in the order they were played
  const goalsScored = new Map();   // playerId -> goals, the third-place play-off included
  const results = [];              // [{ home, away, score, stage }]
  let skipped = 0;

  /** Record one team's contribution to one fixture. */
  const record = (fixtureId, team, concededGoals, mvpId, countsForFanta) => {
    const players = squad(team);
    if (!rosters.has(team.name)) rosters.set(team.name, new Set());

    const points = new Map();
    for (const player of players) {
      const playerId = `${fullName(player)} | ${team.name}`;
      goalsScored.set(playerId, (goalsScored.get(playerId) ?? 0) + (player.goals ?? 0));
      if (!countsForFanta) continue;

      rosters.get(team.name).add(playerId);
      points.set(playerId, computeMatchPoints(player, team.score, concededGoals, player.id === mvpId));
    }

    if (!countsForFanta) return;
    scored.set(`${fixtureId}::${team.name}`, points);
    if (!teamFixtures.has(team.name)) teamFixtures.set(team.name, []);
    teamFixtures.get(team.name).push(fixtureId);
  };

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

    // The play-off is still shown on the scoreboard and still feeds the capocannoniere
    // standings; it just does not earn anybody fantasy points.
    const countsForFanta = !THIRD_PLACE_PLAY_OFF.test(stage ?? '');

    record(fixture.id, home, away.score, mvpId, countsForFanta);
    record(fixture.id, away, home.score, mvpId, countsForFanta);

    results.push({
      home: home.name,
      away: away.name,
      score: `${home.score}-${away.score}`,
      stage,
    });
  }

  console.log(`  Processed ${results.length} matches (${skipped} not played yet)`);

  // Every team is given a column per round, so a team that went out early has a column for
  // each round it did not play. Regolamento rule 6: -2 per phase the team missed, once.
  const rounds = Math.max(0, ...[...teamFixtures.values()].map(fixtures => fixtures.length));

  // Regolamento: "Punteggi a fine torneo. Capocannoniere +5." Awarded only once every fixture
  // has been played, so the live table does not hand the prize to whoever is ahead today.
  const finished = results.length > 0 && skipped === 0;

  // The classifica should show what the players actually scored until it is possible to know
  // who is out. That is the first closed knockout fixture, not the last group-stage one.
  const knockoutsStarted = fixtureList.some(
    fixture => isRelevant(fixture) && isPlayed(fixture) && isKnockout(fixture, groupsByName)
  );
  const applyMalus = knockoutsStarted || finished;
  if (applyMalus) {
    console.log('  ⚖ Rule 6 malus is on: missed knockout rounds are charged.');
  } else {
    console.log('  ⏳ Girone in progress: scoring points only, malus held back.');
  }
  const mostGoals = Math.max(0, ...goalsScored.values());
  const topScorers = new Set(
    finished && mostGoals > 0
      ? [...goalsScored].filter(([, goals]) => goals === mostGoals).map(([player]) => player)
      : []
  );

  const punteggiRows = [];
  const eliminazioni = {};

  for (const [team, players] of rosters) {
    const fixtures = teamFixtures.get(team) ?? [];

    for (const playerId of players) {
      const row = { player: playerId };
      const missed = [];
      let total = 0;

      for (let i = 0; i < rounds; i++) {
        const column = `Match ${i + 1}`;
        if (i < fixtures.length) {
          // Left out of the squad for a match the team did play: no substitution is due,
          // because the player has not been eliminated from anything.
          const points = scored.get(`${fixtures[i]}::${team}`)?.get(playerId);
          row[column] = points ? points.total_points : POINTS_PER_MISSING_GAME;
        } else if (applyMalus) {
          row[column] = POINTS_PER_MISSING_GAME;
          missed.push(column);
        } else {
          // Still in the girone: a team on fewer matches than the leaders has not gone out,
          // it is simply due to play. Charging rule 6 now would put the whole table below
          // zero before anybody had missed a phase.
          row[column] = 0;
        }
        total += row[column];
      }

      row.Premi = topScorers.has(playerId) ? POINTS_TOP_SCORER : 0;
      row.Total = Math.round((total + row.Premi) * 10) / 10;
      punteggiRows.push(row);
      if (missed.length) eliminazioni[playerId] = missed;
    }
  }

  punteggiRows.sort((a, b) => b.Total - a.Total);

  writeJson(join(DATA_DIR, 'punteggi.json'), punteggiRows);
  writeJson(join(DATA_DIR, 'risultati.json'), results);

  // Which matches a player missed because their team was out, as opposed to any other reason
  // they scored the penalty. build-classifica.js needs the difference to know when the
  // regolamento lets a reserve come on.
  writeJson(join(DATA_DIR, 'eliminazioni.json'), eliminazioni);

  // Whether the malus is due yet. Rule 6 punishes a phase a team did not reach, which cannot be
  // told apart from a phase it has not reached so far until the knockouts begin. The classifica
  // reads this so it can show earned points only while the girone is still on.
  writeJson(join(DATA_DIR, 'stato.json'), {
    finished,
    knockouts_started: knockoutsStarted,
    apply_malus: applyMalus,
    rounds,
    matches_played: results.length,
    matches_remaining: skipped,
  });

  // Raw per-match ratings, used to rebuild history.json and to price the next edition. Only
  // matches that were actually played, so points-per-match means what it says.
  const rawRatings = {};
  for (const [team, players] of rosters) {
    for (const playerId of players) {
      rawRatings[playerId] = (teamFixtures.get(team) ?? [])
        .map(fixtureId => scored.get(`${fixtureId}::${team}`)?.get(playerId))
        .filter(Boolean);
    }
  }
  writeJson(join('assets', YEAR, 'punteggi.json'), rawRatings);

  if (topScorers.size) {
    console.log(`  🏆 Capocannoniere (${mostGoals} gol): ${[...topScorers].join(', ')}`);
  }
  console.log(`\n✅ Computed ${punteggiRows.length} player scores, ${results.length} match results\n`);
}

main();
