/**
 * scripts/names.js — the one place a player's display name is decided.
 *
 * Names reach the API as free text typed by whoever registered the team, so the same
 * tournament mixes "Andrea Conzatti" with "ANDREA CONZATTI" and pads fields with stray
 * spaces. Everything written to data/ goes through fullName(), and the files stay joinable by
 * name only for as long as that normalisation holds.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { titleCase, fullName } from '../../scripts/names.js';

describe('titleCase', () => {
  test('capitalises each word of a shouted name', () => {
    assert.equal(titleCase('GIACOMO DE ZAMBOTTI'), 'Giacomo De Zambotti');
    assert.equal(titleCase('luis eduardo grazioli'), 'Luis Eduardo Grazioli');
  });

  test('capitalises after an apostrophe or a hyphen', () => {
    assert.equal(titleCase("D'ANGELO"), "D'Angelo");
    assert.equal(titleCase('RITA LEVI’S'), 'Rita Levi’S');
    assert.equal(titleCase('jean-luc'), 'Jean-Luc');
  });

  test('leaves a well-formed name alone', () => {
    assert.equal(titleCase('Andrea Conzatti'), 'Andrea Conzatti');
  });

  test('handles an empty string', () => {
    assert.equal(titleCase(''), '');
  });
});

describe('fullName', () => {
  test('joins name and surname', () => {
    assert.equal(fullName({ name: 'ANDREA', surname: 'CONZATTI' }), 'Andrea Conzatti');
  });

  test('strips the padding the API sends', () => {
    // The 2025 snapshot really does contain "Alessandro " and "Ruele ". The legacy Python
    // stripped each field before joining; anything that does not ends up with a double space
    // and stops matching the roster.
    assert.equal(fullName({ name: 'Alessandro ', surname: 'Ruele ' }), 'Alessandro Ruele');
    assert.equal(fullName({ name: 'Samuele ', surname: ' Maffei' }), 'Samuele Maffei');
  });

  test('copes with a missing surname', () => {
    assert.equal(fullName({ name: 'ada' }), 'Ada');
    assert.equal(fullName({}), '');
  });
});
