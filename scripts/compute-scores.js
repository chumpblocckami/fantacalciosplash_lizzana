/**
 * Compute fantasy scores from scraped API data.
 * Reads local JSON files from assets/YEAR/api/ and outputs to data/YEAR/.
 *
 * Usage: node scripts/compute-scores.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fullName } from './names.js';
import { applyGoalkeeperOverrides } from './goalkeeper-overrides.js';
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

// Ottavi / quarti / semi / finale / sedicesimi. The access play-off is not in this list:
// rule 7 treats it as an extra match some teams play, not as a phase everybody must reach.
const BRACKET_NAME = /(ottavi|quarti|semifinali?|finale|sedicesimi)/i;
const PLAY_IN_NAME = /playoffs?/i;

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJson(path, data) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
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
 * The play-in for the ottavi ("Playoffs Maschile"). Rule 7: it counts like any other
 * match, and teams that skip it are not charged the rule 6 malus for that extra game.
 *
 * `kind === 'playoffs'` is the usual signal; the name is the fallback. Bracket rounds
 * sometimes reuse kind=playoffs (Semifinali / Finale), so a bracket name wins.
 */
function isPlayIn(fixture, groupsByName) {
  const name = fixture.group_name ?? '';
  if (THIRD_PLACE_PLAY_OFF.test(name) || BRACKET_NAME.test(name)) return false;
  const kind = groupsByName.get(name)?.kind;
  if (kind && kind.toLowerCase() === 'playoffs') return true;
  return PLAY_IN_NAME.test(name);
}

/**
 * Ottavi / quarti / semi / finale (and the 3rd/4th-place match). Missing one of these
 * is what rule 6 charges. The access play-off is not a required phase.
 */
function isBracket(fixture, groupsByName) {
  const name = fixture.group_name ?? '';
  if (THIRD_PLACE_PLAY_OFF.test(name) || BRACKET_NAME.test(name)) return true;
  if (isPlayIn(fixture, groupsByName)) return false;
  const kind = groupsByName.get(name)?.kind;
  return Boolean(kind && kind.toLowerCase() === 'bracket');
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
    const players = applyGoalkeeperOverrides(squad(team), team.name);
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

    // The 3rd/4th-place play-off is still shown on the scoreboard and still feeds the
    // capocannoniere; it just does not earn anybody fantasy points (rule 8).
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

  const fixtureById = new Map(fixtureList.map(fixture => [fixture.id, fixture]));
  const playInId = id => {
    const fixture = fixtureById.get(id);
    return fixture ? isPlayIn(fixture, groupsByName) : false;
  };
  // Rule 7: the access play-off is an extra match, not a phase everybody must reach.
  // Padding and the rule 6 malus are counted on girone + bracket rounds only.
  const requiredCount = fixtures => fixtures.filter(id => !playInId(id)).length;
  const rounds = Math.max(0, ...[...teamFixtures.values()].map(requiredCount));

  // Regolamento: "Punteggi a fine torneo. Capocannoniere +5." Awarded only once every fixture
  // has been played, so the live table does not hand the prize to whoever is ahead today.
  const finished = results.length > 0 && skipped === 0;

  const playInStarted = fixtureList.some(
    fixture => isRelevant(fixture) && isPlayed(fixture) && isPlayIn(fixture, groupsByName)
  );
  const bracketStarted = fixtureList.some(
    fixture => isRelevant(fixture) && isPlayed(fixture) && isBracket(fixture, groupsByName)
  );
  const knockoutsStarted = playInStarted || bracketStarted;
  // The malus is for a bracket phase a team did not reach. A closed play-in is not that:
  // teams that skipped it just never had the extra match.
  const applyMalus = bracketStarted || finished;
  if (applyMalus) {
    console.log('  ⚖ Rule 6 malus is on: missed bracket rounds are charged (not the access play-off).');
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
      let columnIndex = 0;
      let required = 0;

      for (const fixtureId of fixtures) {
        columnIndex += 1;
        const column = `Match ${columnIndex}`;
        // Left out of the squad for a match the team did play: no substitution is due,
        // because the player has not been eliminated from anything.
        const points = scored.get(`${fixtureId}::${team}`)?.get(playerId);
        row[column] = points ? points.total_points : POINTS_PER_MISSING_GAME;
        total += row[column];
        if (!playInId(fixtureId)) required += 1;
      }

      while (required < rounds) {
        columnIndex += 1;
        const column = `Match ${columnIndex}`;
        if (applyMalus) {
          row[column] = POINTS_PER_MISSING_GAME;
          missed.push(column);
        } else {
          row[column] = 0;
        }
        total += row[column];
        required += 1;
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

  // Whether the malus is due yet. Rule 6 punishes a bracket phase a team did not reach,
  // which cannot be told apart from a phase it has not reached so far until the ottavi
  // begin. The classifica reads this so it can show earned points only while the girone
  // (and the access play-off) are still on.
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
