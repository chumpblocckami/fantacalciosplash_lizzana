import {
  POINTS_PER_GOAL,
  POINTS_PER_YELLOW_CARD,
  POINTS_PER_RED_CARD,
  POINTS_PER_VICTORY,
  POINTS_PER_DRAW,
  POINTS_PER_DEFEAT,
  POINTS_PER_CLEANSHEET,
  POINTS_PER_CONCEDED_GOAL,
  POINTS_MVP,
} from './constants.js';

/**
 * Compute fantasy points for a single player in a single match.
 *
 * @param {Object} player       - Player data from API {goals, yellow_cards, red_cards, id, name, surname}
 * @param {Object} team         - Team data {score, name}
 * @param {number} concededGoals - Goals conceded by the player's team (i.e. opponent's score)
 * @param {boolean} isGoalkeeper - Whether this player is a goalkeeper
 * @param {boolean} isMvp        - Whether this player was the match MVP
 * @returns {Object} Breakdown of points
 */
export function computeMatchPoints(player, team, concededGoals, isGoalkeeper, isMvp) {
  const goalPoints = player.goals * POINTS_PER_GOAL;
  const yellowCardPoints = player.yellow_cards * POINTS_PER_YELLOW_CARD;
  const redCardPoints = player.red_cards * POINTS_PER_RED_CARD;

  const teamPoints =
    team.score > concededGoals ? POINTS_PER_VICTORY
    : team.score < concededGoals ? POINTS_PER_DEFEAT
    : POINTS_PER_DRAW;

  const goalkeeperPoints = !isGoalkeeper ? 0
    : concededGoals === 0 ? POINTS_PER_CLEANSHEET
    : concededGoals * POINTS_PER_CONCEDED_GOAL;

  const mvpPoints = isMvp ? POINTS_MVP : 0;

  return {
    goals: goalPoints,
    yellowCards: yellowCardPoints,
    redCards: redCardPoints,
    teamPoints,
    goalkeeperPoints,
    mvpPoints,
    total: goalPoints + yellowCardPoints + redCardPoints + teamPoints + goalkeeperPoints + mvpPoints,
  };
}

/**
 * Process all fixtures from local API JSON data and compute ratings for every player.
 *
 * @param {Object[]} groups       - Array of group data objects (from groups/*.json)
 * @param {Object[]} fixtures     - Array of fixture pages (from groups/N/fixture/*.json)
 * @param {string[]} goalkeepers  - List of goalkeeper identifiers ("Name Surname | TEAM")
 * @returns {{ ratings: Object, results: Object[] }}
 */
export function processAllMatches(groups, fixtures, goalkeepers) {
  const ratings = {};
  const results = [];

  for (const { group, fixturePages } of fixtures) {
    const label = group.data?.name ?? '';

    // Skip non-male and 3rd/4th place matches
    if (!label.toLowerCase().endsWith('m') && !label.toLowerCase().includes('maschile')) continue;
    if (label.toLowerCase() === 'terzo/quarto m') continue;

    for (const page of fixturePages) {
      if (!page.data) continue;

      for (const match of page.data) {
        if (!match.home_team || !match.away_team) continue;

        const home = match.home_team;
        const away = match.away_team;

        // Determine match MVP
        const matchMvp = match.best_player;
        const mvpId = matchMvp?.id ?? null;

        processTeamRatings(home, away.score, ratings, goalkeepers, mvpId);
        processTeamRatings(away, home.score, ratings, goalkeepers, mvpId);

        results.push({
          home: home.name,
          away: away.name,
          score: `${home.score}-${away.score}`,
          stage: label,
          live: match.live,
          closed: match.closed,
        });
      }
    }
  }

  return { ratings, results };
}

/**
 * Process a single team's players for a match and accumulate into ratings.
 */
function processTeamRatings(team, concededGoals, ratings, goalkeepers, mvpId) {
  if (!ratings[team.name]) {
    ratings[team.name] = {};
  }

  const allPlayers = [...(team.players || []), ...(team.substitutes || [])];
  // Deduplicate by id
  const seen = new Set();
  const players = [];
  for (const p of allPlayers) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      players.push(p);
    }
  }

  for (const player of players) {
    const playerId = `${capitalize(player.name)} ${capitalize(player.surname)} | ${team.name}`;

    if (!ratings[team.name][playerId]) {
      ratings[team.name][playerId] = [];
    }

    const isGoalkeeper = goalkeepers.some(gk => {
      const gkName = gk.split('|')[0].trim().toLowerCase();
      const playerName = `${player.name} ${player.surname}`.toLowerCase().trim();
      return gkName === playerName || gk.toLowerCase().includes(playerName);
    });

    const isMvp = mvpId !== null && player.id === mvpId;

    ratings[team.name][playerId].push(
      computeMatchPoints(player, team, concededGoals, isGoalkeeper, isMvp)
    );
  }
}

/**
 * Convert ratings object to a sorted array suitable for display.
 *
 * @param {Object} ratings - { teamName: { playerId: [MatchPoints, ...] } }
 * @returns {Object[]} Array of player score rows sorted by total descending
 */
export function ratingsToTable(ratings) {
  const rows = [];
  let maxMatches = 0;

  for (const [teamName, teamData] of Object.entries(ratings)) {
    for (const [playerId, matchList] of Object.entries(teamData)) {
      maxMatches = Math.max(maxMatches, matchList.length);

      const matchScores = matchList.map(m => m.total);
      const total = matchScores.reduce((a, b) => a + b, 0);

      rows.push({
        player: playerId,
        team: teamName,
        matches: matchScores,
        total,
      });
    }
  }

  rows.sort((a, b) => b.total - a.total);
  return { rows, maxMatches };
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase().trim();
}
