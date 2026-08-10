/**
 * Escaping for the strings the site renders.
 *
 * Every name shown on the page comes from outside the repository: team and player names from
 * the Calciosplash API, and fantallenatore names typed into the public iscrizione form, which
 * reach data/YEAR/squadre.json by way of the Apps Script. The components build their markup by
 * interpolating into template strings, so anything not escaped here is parsed as HTML.
 */

const REPLACEMENTS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape a value for interpolation into markup, including inside an attribute.
 *
 * @param {unknown} value - Anything renderable; null and undefined become an empty string
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, character => REPLACEMENTS[character]);
}
