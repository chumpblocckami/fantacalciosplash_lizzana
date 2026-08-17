/**
 * End-of-tournament prizes (regolamento: +5 each).
 *
 * Labels left empty are shown as a blank slot until you fill them in here.
 * Winners live in data/YEAR/premi.json — capocannoniere is written by compute-scores.js,
 * the other two are edited by hand.
 */

import {
  POINTS_TOP_SCORER,
  POINTS_BEST_PLAYER,
  POINTS_BEST_GOALKEEPER,
} from './constants.js';

/** @typedef {{ id: string, label: string, points: number, auto: boolean }} AwardDef */

/** @type {AwardDef[]} */
export const AWARDS = [
  { id: 'capocannoniere', label: 'Capocannoniere', points: POINTS_TOP_SCORER, auto: true },
  { id: 'miglior_giocatore', label: 'Miglior giocatore', points: POINTS_BEST_PLAYER, auto: false },
  { id: 'miglior_portiere', label: 'Miglior portiere', points: POINTS_BEST_GOALKEEPER, auto: false },
];

/** Label shown in the UI; blank definitions render as an em dash. */
export function awardLabel(award) {
  return award.label?.trim() || '\u2014';
}

/** @param {string} playerId - "Name | TEAM" */
export function splitPlayerId(playerId) {
  if (!playerId?.includes('|')) return { name: (playerId || '').trim(), team: '' };
  const [name, team] = playerId.split('|');
  return { name: name.trim(), team: team.trim() };
}

/**
 * Sum of prize points a player earned.
 *
 * @param {string} playerId
 * @param {Record<string, string[]>|null|undefined} premi
 * @returns {number}
 */
export function prizePointsForPlayer(playerId, premi) {
  if (!premi) return 0;
  let total = 0;
  for (const award of AWARDS) {
    if ((premi[award.id] ?? []).includes(playerId)) total += award.points;
  }
  return total;
}

/**
 * Awards won by one player.
 *
 * @param {string} playerId
 * @param {Record<string, string[]>|null|undefined} premi
 * @returns {{ id: string, label: string, points: number }[]}
 */
export function awardsForPlayer(playerId, premi) {
  if (!premi) return [];
  return AWARDS.filter(award => (premi[award.id] ?? []).includes(playerId))
    .map(award => ({ id: award.id, label: award.label, points: award.points }));
}
