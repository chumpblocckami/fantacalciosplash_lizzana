/**
 * Canonical tournament phases for the men's fantacalcio table.
 *
 * Eight match columns at most: Girone 1–3, Playoff, Ottavi, Quarti, Semifinale, Finale.
 * The Finale column covers both the title match and the 3rd/4th-place play-off (rule 8:
 * the latter earns no fanta points but still satisfies the final round). Optional Playoff
 * shows a non_disputato badge when skipped.
 */

/** @typedef {{ key: string, label: string, required: boolean, countsForFanta: boolean, bracket: boolean }} Phase */

/** @type {Phase[]} */
export const PHASES = [
  { key: 'girone_1', label: 'Girone 1', required: true, countsForFanta: true, bracket: false },
  { key: 'girone_2', label: 'Girone 2', required: true, countsForFanta: true, bracket: false },
  { key: 'girone_3', label: 'Girone 3', required: true, countsForFanta: true, bracket: false },
  { key: 'playoff', label: 'Playoff', required: false, countsForFanta: true, bracket: false },
  { key: 'ottavi', label: 'Ottavi', required: true, countsForFanta: true, bracket: true },
  { key: 'quarti', label: 'Quarti', required: true, countsForFanta: true, bracket: true },
  { key: 'semifinale', label: 'Semifinale', required: true, countsForFanta: true, bracket: true },
  { key: 'finale', label: 'Finale', required: true, countsForFanta: true, bracket: true },
];

/** Labels in display order (also used as punteggi.json column keys). */
export const PHASE_LABELS = PHASES.map(phase => phase.label);

/** @type {Map<string, Phase>} */
const BY_KEY = new Map(PHASES.map(phase => [phase.key, phase]));

/** @type {Map<string, Phase>} */
const BY_LABEL = new Map(PHASES.map(phase => [phase.label, phase]));

/** Bracket phases that can trigger the rule-6 malus when missed. */
export const BRACKET_PHASE_KEYS = PHASES.filter(phase => phase.bracket && phase.required)
  .map(phase => phase.key);

// Same patterns as compute-scores.js — keep in sync.
// Regolamento rule 8 + API spellings ("Terzo/Quarto M", "3°/4° Posto Maschile", …).
const THIRD_PLACE_PLAY_OFF = /(terzo\s*°?\s*[/ ]\s*°?\s*quarto|3\s*°?\s*\/\s*°?\s*4)/i;
const BRACKET_NAME = /(ottavi|quarti|semifinali?|finale|sedicesimi)/i;
const PLAY_IN_NAME = /playoffs?/i;

/**
 * Whether a fixture is the men's access play-off (Playoffs Maschile).
 *
 * @param {{ group_name?: string }} fixture
 * @param {Map<string, { kind?: string }>} groupsByName
 * @returns {boolean}
 */
export function isPlayIn(fixture, groupsByName) {
  const name = fixture.group_name ?? '';
  if (THIRD_PLACE_PLAY_OFF.test(name) || BRACKET_NAME.test(name)) return false;
  const kind = groupsByName.get(name)?.kind;
  if (kind && kind.toLowerCase() === 'playoffs') return true;
  return PLAY_IN_NAME.test(name);
}

/**
 * Map one men's fixture to a canonical phase key, or null when it should not be scored.
 *
 * @param {{ group_name?: string, gender?: string }} fixture
 * @param {Map<string, { kind?: string }>} groupsByName
 * @param {number} gironeRound - 1, 2 or 3 for Maschile group matches of this team
 * @returns {string|null}
 */
export function phaseKeyForFixture(fixture, groupsByName, gironeRound) {
  const name = fixture.group_name ?? '';
  if (fixture.gender !== 'male') return null;
  if (THIRD_PLACE_PLAY_OFF.test(name)) return 'finale';
  if (/^maschile$/i.test(name) || groupsByName.get(name)?.kind === 'girone') {
    return gironeRound >= 1 && gironeRound <= 3 ? `girone_${gironeRound}` : null;
  }
  if (isPlayIn(fixture, groupsByName)) return 'playoff';
  if (/ottavi/i.test(name)) return 'ottavi';
  if (/quarti/i.test(name)) return 'quarti';
  if (/semi/i.test(name)) return 'semifinale';
  if (/finale/i.test(name)) return 'finale';
  return null;
}

/**
 * Human label for a phase key or legacy Match column.
 *
 * @param {string} key
 * @returns {string}
 */
export function labelForPhase(key) {
  if (BY_KEY.has(key)) return BY_KEY.get(key).label;
  if (BY_LABEL.has(key)) return key;
  const legacy = /^Match (\d+)$/.exec(key);
  if (legacy) return key;
  return key;
}

/**
 * Whether a punteggi column holds per-match fantasy points.
 *
 * @param {string} key
 * @returns {boolean}
 */
export function isMatchColumn(key) {
  if (BY_LABEL.has(key) || BY_KEY.has(key)) return true;
  const kl = key.toLowerCase();
  return kl.startsWith('match')
    || kl.startsWith('ottavi')
    || kl.startsWith('quarti')
    || kl.startsWith('semifinal')
    || kl.startsWith('final')
    || kl.startsWith('sedicesimi')
    || kl.startsWith('bonus')
    || kl.startsWith('girone')
    || kl.startsWith('playoff');
}

/**
 * Ordered phase labels present in a punteggi row (legacy Match N or new labels).
 *
 * @param {Object} row
 * @returns {string[]}
 */
export function phaseLabelsInRow(row) {
  const keys = Object.keys(row).filter(isMatchColumn);
  const labels = keys.map(key => labelForPhase(key));
  return PHASE_LABELS.filter(label => labels.includes(label));
}

/**
 * @param {string} label
 * @returns {Phase|undefined}
 */
export function phaseByLabel(label) {
  return BY_LABEL.get(label);
}

/**
 * @param {string} key
 * @returns {Phase|undefined}
 */
export function phaseByKey(key) {
  return BY_KEY.get(key);
}
