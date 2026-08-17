/**
 * Temporary keeper patches: Pietro Bernardelli is treated as CLITORIDERS' goalkeeper
 * until the Calciosplash API flags him that way.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { player, team, writeSnapshot } from '../helpers/api-fixture.js';
import { workspace, runScript, readOutput } from '../helpers/run-script.js';
import {
  applyGoalkeeperOverrides,
  isGoalkeeper,
  GOALKEEPER_OVERRIDES,
} from '../../scripts/goalkeeper-overrides.js';

const pietro = {
  name: 'Pietro',
  surname: 'Bernardelli',
  is_goalkeeper: false,
};
const maffei = {
  name: 'Thomas',
  surname: 'Maffei',
  is_goalkeeper: true,
};

describe('GOALKEEPER_OVERRIDES', () => {
  test('patches Pietro Bernardelli as CLITORIDERS keeper', () => {
    assert.equal(GOALKEEPER_OVERRIDES['Pietro Bernardelli | CLITORIDERS'], true);
    assert.equal(isGoalkeeper(pietro, 'CLITORIDERS'), true);
    assert.equal(isGoalkeeper(pietro, 'AVANZI'), false, 'the patch is team-scoped');
  });

  test('leaves the API flag alone for everyone else', () => {
    assert.equal(isGoalkeeper(maffei, 'CLITORIDERS'), true);
    assert.equal(isGoalkeeper({ name: 'Luca', surname: 'Frasca' }, 'CLITORIDERS'), false);
  });

  test('makes Pietro the only keeper on a CLITORIDERS fixture squad', () => {
    const patched = applyGoalkeeperOverrides([pietro, maffei], 'CLITORIDERS');
    assert.equal(patched[0].is_goalkeeper, true);
    assert.equal(patched[1].is_goalkeeper, false, 'Maffei is not paid a second clean sheet');
  });

  test('does not touch another team that happens to list the same names', () => {
    const patched = applyGoalkeeperOverrides([pietro, maffei], 'AVANZI');
    assert.equal(patched[0].is_goalkeeper, false);
    assert.equal(patched[1].is_goalkeeper, true);
  });
});

describe('compute-scores.js applies the Pietro patch', () => {
  test('he gets the clean sheet, and the API keeper does not', () => {
    const cwd = workspace('pietro-keeper-patch');
    writeSnapshot(cwd, '2099', {
      groups: [{ id: 1, name: 'Maschile', gender: 'male', kind: 'girone' }],
      fixtures: [
        {
          id: 1,
          group_name: 'Maschile',
          gender: 'male',
          closed: true,
          home: team('CLITORIDERS', 8, [
            player(718, 'Pietro', 'Bernardelli'),
            player(720, 'Thomas', 'Maffei', { is_goalkeeper: true, goals: 1 }),
          ]),
          away: team('AVANZI', 0, [player(1, 'Omar', 'Russo', { is_goalkeeper: true })]),
        },
      ],
    });

    const run = runScript('compute-scores.js', cwd, { YEAR: '2099' });
    assert.equal(run.status, 0, run.stderr);

    const punteggi = readOutput(cwd, 'data', '2099', 'punteggi.json');
    const row = name => punteggi.find(entry => entry.player === name);

    assert.equal(row('Pietro Bernardelli | CLITORIDERS')['Girone 1'], 5 + 2);
    assert.equal(
      row('Thomas Maffei | CLITORIDERS')['Girone 1'],
      2 + 2,
      'goal and win only, no second clean sheet'
    );
  });
});
