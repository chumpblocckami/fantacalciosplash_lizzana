/**
 * #YEAR/Coach fragments used to open a squad sheet from a shared link.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseTeamHash, formatTeamHash, storageKey } from '../../js/team-hash.js';

describe('parseTeamHash', () => {
  test('reads an edition and a coach', () => {
    assert.deepEqual(parseTeamHash('#2026/Valentina%20Perghem'), {
      edition: '2026',
      coach: 'Valentina Perghem',
    });
  });

  test('accepts an edition with no coach', () => {
    assert.deepEqual(parseTeamHash('#2026'), { edition: '2026', coach: null });
  });

  test('rejects junk', () => {
    assert.equal(parseTeamHash(''), null);
    assert.equal(parseTeamHash('#nope'), null);
    assert.equal(parseTeamHash('#2026/'), null);
  });
});

describe('formatTeamHash', () => {
  test('round-trips a name with spaces', () => {
    const hash = formatTeamHash('2026', 'Valentina Perghem');
    assert.equal(hash, '#2026/Valentina%20Perghem');
    assert.deepEqual(parseTeamHash(hash), { edition: '2026', coach: 'Valentina Perghem' });
  });

  test('names the edition when no sheet is open', () => {
    assert.equal(formatTeamHash('2025'), '#2025');
  });
});

describe('storageKey', () => {
  test('is scoped to the edition', () => {
    assert.equal(storageKey('2026'), 'fantacalcio-squad:2026');
  });
});
