/**
 * Temporary keeper corrections until the Calciosplash API flags the right player.
 *
 * Keys are the "Name | TEAM" ids compute-scores.js writes. `true` makes that
 * player the goalkeeper on every fixture they appear in. Teammates the API
 * still marks as keeper lose the flag so a clean sheet is not paid twice.
 */

import { fullName } from './names.js';

export const GOALKEEPER_OVERRIDES = {
  // 2026: organisers tagged Thomas Maffei; Pietro kept. Remove once the API agrees.
  'Pietro Bernardelli | CLITORIDERS': true,
};

/**
 * Player id in the same form as punteggi.json.
 *
 * @param {{ name?: string, surname?: string }} player
 * @param {string} teamName
 * @returns {string}
 */
export function playerId(player, teamName) {
  return `${fullName(player)} | ${teamName}`;
}

/**
 * Whether a player is a goalkeeper after applying GOALKEEPER_OVERRIDES.
 *
 * Used when building giocatori.json, where only this player's ruolo changes.
 * Teammates keep the ruolo the API gave them.
 *
 * @param {{ name?: string, surname?: string, is_goalkeeper?: boolean }} player
 * @param {string} teamName
 * @returns {boolean}
 */
export function isGoalkeeper(player, teamName) {
  const id = playerId(player, teamName);
  if (Object.hasOwn(GOALKEEPER_OVERRIDES, id)) return GOALKEEPER_OVERRIDES[id];
  return Boolean(player.is_goalkeeper);
}

/**
 * Copy a fixture squad with keeper flags patched for scoring.
 *
 * @param {Object[]} players
 * @param {string}   teamName
 * @returns {Object[]}
 */
export function applyGoalkeeperOverrides(players, teamName) {
  const forced = players.filter(player => GOALKEEPER_OVERRIDES[playerId(player, teamName)] === true);
  return players.map(player => {
    const id = playerId(player, teamName);
    if (Object.hasOwn(GOALKEEPER_OVERRIDES, id)) {
      return { ...player, is_goalkeeper: GOALKEEPER_OVERRIDES[id] };
    }
    if (forced.length && player.is_goalkeeper) {
      return { ...player, is_goalkeeper: false };
    }
    return player;
  });
}
