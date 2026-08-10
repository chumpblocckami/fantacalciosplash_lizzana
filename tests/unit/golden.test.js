/**
 * The committed data/ files must be reproducible from the committed assets/ snapshot.
 *
 * The pipeline runs unattended every five minutes on tournament day and commits whatever it
 * produces, so a change in behaviour reaches the published site without anyone reading it
 * first. Re-running it here over the snapshot in the repository and comparing against what is
 * checked in is the guard against that.
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { ROOT } from '../helpers/paths.js';
import { workspace, runScript, readOutput } from '../helpers/run-script.js';

const YEAR = '2026';

let cwd;
let compute;

before(() => {
  cwd = workspace('golden-2026');
  mkdirSync(join(cwd, 'assets'), { recursive: true });
  cpSync(join(ROOT, 'assets', YEAR), join(cwd, 'assets', YEAR), { recursive: true });
  mkdirSync(join(cwd, 'data', YEAR), { recursive: true });

  compute = runScript('compute-scores.js', cwd, { YEAR });
  assert.equal(compute.status, 0, `compute-scores.js failed: ${compute.stderr}`);
});

/** Read a committed data file. */
function committed(...segments) {
  return JSON.parse(readFileSync(join(ROOT, 'data', ...segments), 'utf-8'));
}

describe('the 2026 pipeline reproduces what is committed', () => {
  test('punteggi.json is unchanged', () => {
    assert.deepEqual(readOutput(cwd, 'data', YEAR, 'punteggi.json'), committed(YEAR, 'punteggi.json'));
  });

  test('risultati.json is unchanged', () => {
    assert.deepEqual(readOutput(cwd, 'data', YEAR, 'risultati.json'), committed(YEAR, 'risultati.json'));
  });

  test('eliminazioni.json is unchanged', () => {
    assert.deepEqual(
      readOutput(cwd, 'data', YEAR, 'eliminazioni.json'),
      committed(YEAR, 'eliminazioni.json')
    );
  });

  test('the 2026 tournament has not been played, so there is nothing to score', () => {
    // Every fixture in the snapshot is still scheduled. This is the reason the knockout and
    // elimination paths are exercised against the synthetic tournament instead.
    assert.match(compute.stdout, /Processed 0 matches \(45 not played yet\)/);
    assert.deepEqual(committed(YEAR, 'punteggi.json'), []);
  });

  test('the classifica step waits for the registrations', () => {
    const run = runScript('build-classifica.js', cwd, { YEAR });
    assert.equal(run.status, 0, 'a missing squadre.json is not an error before tournament day');
    assert.match(run.stdout, /No punteggi or squadre yet/);
  });
});

describe('the published data files hang together', () => {
  test('every edition in editions.json has a giocatori list', () => {
    for (const edition of committed('editions.json')) {
      const giocatori = committed(edition, 'giocatori.json');
      assert.ok(Array.isArray(giocatori) && giocatori.length > 0, `${edition} has no players`);
    }
  });

  test('every 2026 player has a price, a role and a team', () => {
    for (const player of committed(YEAR, 'giocatori.json')) {
      assert.ok(player.Nominativo, 'a player without a name cannot be picked');
      assert.ok(player.Squadra, `${player.Nominativo} has no team`);
      assert.ok(['Portiere', 'Movimento'].includes(player.Ruolo), `${player.Nominativo} has no role`);
      assert.equal(typeof player.Quotazione, 'number', `${player.Nominativo} has no price`);
    }
  });

  test('a valid 2026 lineup is affordable', () => {
    // Five players have to fit inside the budget, or nobody can register at all.
    const giocatori = committed(YEAR, 'giocatori.json');
    const cheapest = role =>
      Math.min(...giocatori.filter(p => p.Ruolo === role).map(p => p.Quotazione));

    const floor = cheapest('Portiere') + 4 * cheapest('Movimento');
    assert.ok(floor <= 200, `the cheapest possible team costs ${floor}`);
  });

  test('the roles are spread widely enough to field a team', () => {
    const giocatori = committed(YEAR, 'giocatori.json');
    const teams = new Set(giocatori.filter(p => p.Ruolo === 'Movimento').map(p => p.Squadra));

    assert.ok(giocatori.some(p => p.Ruolo === 'Portiere'), 'there must be goalkeepers to pick');
    // Three starters and a reserve must come from four different teams.
    assert.ok(teams.size >= 4, `only ${teams.size} teams have movement players`);
  });
});
