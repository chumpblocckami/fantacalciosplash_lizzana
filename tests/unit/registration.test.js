/**
 * js/registration.js — the budget and the rules the iscrizione form enforces in the browser.
 *
 * This is the only validation a fantasy team goes through: the Apps Script behind the form
 * appends whatever it is sent, so anything missed here reaches the sheet.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { computeBudget, validate } from '../../js/registration.js';
import { BUDGET } from '../../js/constants.js';

const GIOCATORI = [
  { Nominativo: 'Mario Rossi', Squadra: 'ALFA', Quotazione: 50, Ruolo: 'Portiere' },
  { Nominativo: 'Luca Bianchi', Squadra: 'ALFA', Quotazione: 40, Ruolo: 'Movimento' },
  { Nominativo: 'Gino Verdi', Squadra: 'BETA', Quotazione: 30, Ruolo: 'Movimento' },
  { Nominativo: 'Ada Neri', Squadra: 'GAMMA', Quotazione: 20, Ruolo: 'Movimento' },
  { Nominativo: 'Ennio Grigi', Squadra: 'DELTA', Quotazione: 10, Ruolo: 'Movimento' },
];

const VALID = {
  coach: 'Matteo',
  goalkeeper: 'Mario Rossi | ALFA',
  starters: ['Luca Bianchi | ALFA', 'Gino Verdi | BETA', 'Ada Neri | GAMMA'],
  reserve: 'Ennio Grigi | DELTA',
};

/** Validate a lineup, filling in the budget from the same player list. */
function check(overrides = {}) {
  const lineup = { ...VALID, ...overrides };
  const selected = [lineup.goalkeeper, ...lineup.starters, lineup.reserve].filter(Boolean);
  return validate(
    lineup.coach,
    lineup.goalkeeper,
    lineup.starters,
    lineup.reserve,
    computeBudget(selected, GIOCATORI)
  );
}

describe('computeBudget', () => {
  test('subtracts the price of every selected player', () => {
    const selected = [VALID.goalkeeper, ...VALID.starters, VALID.reserve];
    assert.equal(computeBudget(selected, GIOCATORI), BUDGET - (50 + 40 + 30 + 20 + 10));
  });

  test('an empty lineup costs nothing', () => {
    assert.equal(computeBudget([], GIOCATORI), BUDGET);
  });

  test('an unknown player is free rather than an error', () => {
    assert.equal(computeBudget(['Nessuno | OMEGA'], GIOCATORI), BUDGET);
  });

  test('KNOWN BUG: two players with the same name are priced as one', () => {
    // The lookup matches on Nominativo alone and ignores the team, so the first entry wins
    // however expensive the player actually picked is. The Python had the same flaw.
    const namesakes = [
      { Nominativo: 'Marco Rossi', Squadra: 'ALFA', Quotazione: 10, Ruolo: 'Movimento' },
      { Nominativo: 'Marco Rossi', Squadra: 'BETA', Quotazione: 80, Ruolo: 'Movimento' },
    ];
    assert.equal(computeBudget(['Marco Rossi | BETA'], namesakes), BUDGET - 10);
  });
});

describe('validate', () => {
  test('accepts a complete, affordable lineup', () => {
    assert.deepEqual(check(), { valid: true, errors: [] });
  });

  test('requires a fantallenatore name', () => {
    assert.deepEqual(check({ coach: '   ' }).errors, ['Inserire il nome del fantallenatore!']);
  });

  test('requires a goalkeeper, three starters and a reserve', () => {
    assert.deepEqual(check({ goalkeeper: '' }).errors, ['Seleziona un portiere!']);
    assert.deepEqual(check({ starters: ['Luca Bianchi | ALFA'] }).errors, [
      'Seleziona esattamente 3 giocatori titolari!',
    ]);
    assert.deepEqual(check({ reserve: '' }).errors, ['Seleziona una riserva!']);
  });

  test('rejects two movement players from the same real team', () => {
    const result = check({ reserve: 'Luca Bianchi | ALFA' });
    assert.ok(result.errors.includes('Non puoi convocare due giocatori di movimento della stessa squadra!'));
  });

  test('rejects the same player as both starter and reserve', () => {
    const result = check({ reserve: 'Ada Neri | GAMMA' });
    assert.ok(result.errors.includes('Un giocatore non può essere sia titolare che riserva!'));
  });

  test('rejects an overspent budget', () => {
    assert.deepEqual(validate(VALID.coach, VALID.goalkeeper, VALID.starters, VALID.reserve, -1).errors, [
      'Il budget non può essere minore di zero!',
    ]);
  });

  test('survives a gap in the starters', () => {
    // The dropdowns can be filled in any order, so the third starter may be chosen before the
    // first. That used to leave holes in the array: [ , , 'x' ] still reports length 3, so the
    // count check passed and the same-team check then dereferenced a hole, throwing inside the
    // change listener and freezing the budget, the errors and the submit button.
    const sparse = [];
    sparse[2] = 'Ada Neri | GAMMA';

    const result = validate('Matteo', VALID.goalkeeper, sparse, VALID.reserve, 100);
    assert.deepEqual(result.errors, ['Seleziona esattamente 3 giocatori titolari!']);
  });

  test('reports what is still missing on a half-filled form', () => {
    assert.deepEqual(validate('', '', ['', '', ''], '', 200).errors, [
      'Inserire il nome del fantallenatore!',
      'Seleziona un portiere!',
      'Seleziona esattamente 3 giocatori titolari!',
      'Seleziona una riserva!',
    ]);
  });

  test('flags a same-team clash before the lineup is complete', () => {
    const partial = ['Luca Bianchi | ALFA', '', ''];
    const result = validate('Matteo', VALID.goalkeeper, partial, 'Gino Verdi | ALFA', 100);
    assert.ok(result.errors.includes('Non puoi convocare due giocatori di movimento della stessa squadra!'));
  });
});
