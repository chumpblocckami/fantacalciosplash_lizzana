/**
 * Player name formatting, shared by every script that writes a player name to data/.
 *
 * Names reach the API as free text typed by whoever registered the team, so the same tournament
 * mixes "Andrea Conzatti" with "ANDREA CONZATTI". Everything written to disk goes through
 * fullName() so the site shows one consistent style and the files stay joinable by name.
 */

/**
 * Capitalise each word of a name, e.g. "GIACOMO DE ZAMBOTTI" -> "Giacomo De Zambotti".
 *
 * Words are also split on apostrophes and hyphens so "D'ANGELO" becomes "D'Angelo" rather than
 * "D'angelo". Already well-formed names come out unchanged.
 *
 * @param {string} name
 * @returns {string}
 */
export function titleCase(name) {
  return name
    .toLowerCase()
    .replace(/(^|[\s'’\-])(\p{L})/gu, (_, separator, letter) => separator + letter.toUpperCase());
}

/**
 * Build a player's display name from an API record.
 *
 * @param {{ name?: string, surname?: string }} player
 * @returns {string}
 */
export function fullName(player) {
  return titleCase(`${player.name ?? ''} ${player.surname ?? ''}`.replace(/\s+/g, ' ').trim());
}
