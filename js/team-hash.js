/**
 * Shareable #YEAR/Coach links for a squad sheet.
 *
 * The name is URI-encoded so a space or an accent in a fantallenatore does not break the
 * fragment. A hash with only the year still names the edition, which the year tabs already
 * know, and is what we write when no sheet is open.
 */

/**
 * Parse a location.hash value into an edition and optional coach.
 *
 * @param {string} [hash]
 * @returns {{ edition: string, coach: string|null }|null}
 */
export function parseTeamHash(hash) {
  if (!hash) return null;
  const trimmed = String(hash).replace(/^#/, '');
  if (!trimmed) return null;
  const slash = trimmed.indexOf('/');
  if (slash === -1) {
    return /^\d{4}$/.test(trimmed) ? { edition: trimmed, coach: null } : null;
  }
  const edition = trimmed.slice(0, slash);
  let coach = '';
  try {
    coach = decodeURIComponent(trimmed.slice(slash + 1));
  } catch {
    return null;
  }
  if (!/^\d{4}$/.test(edition) || !coach) return null;
  return { edition, coach };
}

/**
 * Build a hash for an edition, and a coach when a sheet is open.
 *
 * @param {string} edition
 * @param {string} [coach]
 * @returns {string}
 */
export function formatTeamHash(edition, coach) {
  return coach ? `#${edition}/${encodeURIComponent(coach)}` : `#${edition}`;
}

/** localStorage key for the last coach opened on an edition. */
export function storageKey(edition) {
  return `fantacalcio-squad:${edition}`;
}
