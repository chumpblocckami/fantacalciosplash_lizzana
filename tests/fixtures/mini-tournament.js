/**
 * A four-team tournament, played to completion, small enough to score by hand.
 *
 * The committed 2026 snapshot has not been played yet, so nothing in scripts/compute-scores.js
 * beyond "there is nothing to do" has ever run against real data. This stands in for it: a
 * group stage, two knockout rounds, two teams that go out at the group stage, and one of every
 * scoring event, so each rule can be checked against a number worked out on paper.
 *
 * Deliberate awkwardness, all of it copied from the real API:
 *  - "Gino " and "Verdi " arrive padded with spaces;
 *  - one player is listed both as a starter and as a substitute in the same fixture;
 *  - two players only ever appear in the first fixture;
 *  - the women's tournament, the organisers' rehearsal group and an unplayed fixture are all
 *    present and must all be ignored.
 */

import { player, team } from '../helpers/api-fixture.js';

export const GROUPS = [
  { id: 1, name: 'Maschile', gender: 'male', kind: 'girone' },
  { id: 2, name: 'Semifinali M', gender: 'male', kind: 'playoffs' },
  { id: 3, name: 'Finale M', gender: 'male', kind: 'playoffs' },
  { id: 4, name: 'Femminile', gender: 'female', kind: 'girone' },
  { id: 5, name: 'Test grafico', gender: 'male', kind: 'playoffs' },
];

// ALFA
const alfaKeeper = stats => player(1, 'mario', 'rossi', { is_goalkeeper: true, ...stats });
const alfaStriker = stats => player(2, 'luca', 'bianchi', stats);
const alfaSentOff = player(3, 'gino ', 'verdi ', { red_cards: 1 });
const alfaBench = player(4, 'ada', 'neri');

// BETA, knocked out at the group stage
const betaKeeper = player(5, 'bruno', 'gialli', { is_goalkeeper: true });
const betaPlayer = player(6, 'carlo', 'blu');

// GAMMA, runner-up
const gammaKeeper = stats => player(7, 'dario', 'viola', { is_goalkeeper: true, ...stats });
const gammaStriker = stats => player(8, 'ennio', 'grigi', stats);

// DELTA, knocked out at the group stage
const deltaKeeper = player(9, 'fabio', 'oro', { is_goalkeeper: true });
const deltaStriker = player(10, 'gigi', 'argento', { goals: 1 });

export const FIXTURES = [
  {
    id: 1,
    group_name: 'Maschile',
    gender: 'male',
    closed: true,
    // Gino Verdi is listed twice, as a starter and again on the bench, and must count once.
    home: team('ALFA', 3, [alfaKeeper(), alfaStriker({ goals: 2, yellow_cards: 1 }), alfaSentOff], [alfaSentOff, alfaBench]),
    away: team('BETA', 0, [betaKeeper, betaPlayer]),
    best_player: { id: 2 },
  },
  {
    id: 2,
    group_name: 'Maschile',
    gender: 'male',
    closed: true,
    home: team('GAMMA', 1, [gammaKeeper(), gammaStriker({ goals: 1 })]),
    away: team('DELTA', 1, [deltaKeeper, deltaStriker]),
  },
  {
    id: 3,
    group_name: 'Semifinali M',
    gender: 'male',
    closed: true,
    home: team('ALFA', 2, [alfaKeeper(), alfaStriker({ goals: 2 })]),
    away: team('GAMMA', 1, [gammaKeeper(), gammaStriker({ goals: 1 })]),
  },
  {
    id: 4,
    group_name: 'Finale M',
    gender: 'male',
    closed: true,
    home: team('ALFA', 1, [alfaKeeper(), alfaStriker({ goals: 1 })]),
    away: team('GAMMA', 0, [gammaKeeper(), gammaStriker()]),
  },
  {
    id: 5,
    group_name: 'Femminile',
    gender: 'female',
    closed: true,
    home: team('OMEGA', 4, [player(11, 'sara', 'rosa', { goals: 4 })]),
    away: team('SIGMA', 0, [player(12, 'nina', 'lilla')]),
  },
  {
    id: 6,
    group_name: 'Test grafico',
    gender: 'male',
    closed: true,
    home: team('PROVA', 9, [player(13, 'test', 'uno', { goals: 9 })]),
    away: team('PROVA DUE', 0, [player(14, 'test', 'due')]),
  },
  {
    id: 7,
    group_name: 'Maschile',
    gender: 'male',
    closed: false,
    home: team('ALFA', 0, [alfaKeeper(), alfaStriker()]),
    away: team('GAMMA', 0, [gammaKeeper(), gammaStriker()]),
  },
];

export const SNAPSHOT = { groups: GROUPS, fixtures: FIXTURES };

/** Teams that reached the knockout rounds, and those that did not. */
export const QUALIFIED = ['ALFA', 'GAMMA'];
export const ELIMINATED = ['BETA', 'DELTA'];

/** How many knockout rounds were played. */
export const KNOCKOUT_ROUNDS = 2;
