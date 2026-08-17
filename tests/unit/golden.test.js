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
import { cpSync, existsSync, mkdirSync, readFileSync } from 'fs';
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
  const premiPath = join(ROOT, 'data', YEAR, 'premi.json');
  if (existsSync(premiPath)) {
    cpSync(premiPath, join(cwd, 'data', YEAR, 'premi.json'));
  }

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

  test('every closed fixture in the snapshot is scored', () => {
    // /api/fixtures removes a fixture the moment it is closed, so the snapshot is the union the
    // scraper keeps rather than the list the API hands back. When that union broke, every match
    // was invisible the instant it became countable and the scorer reported nothing for a
    // tournament that was well under way. Counting the snapshot here is what catches that.
    const snapshot = JSON.parse(
      readFileSync(join(ROOT, 'assets', YEAR, 'api', 'fixtures.json'), 'utf-8')
    ).data;
    const scorable = snapshot.filter(
      fixture => fixture.closed === true && fixture.gender === 'male'
    );

    assert.match(compute.stdout, new RegExp(`Processed ${scorable.length} matches`));
    assert.equal(committed(YEAR, 'risultati.json').length, scorable.length);
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

describe('the classifica from committed scores', () => {
  test('reproduces classifica.json and dettaglio.json', () => {
    const dir = workspace('golden-2026-classifica');
    mkdirSync(join(dir, 'data', YEAR), { recursive: true });
    mkdirSync(join(dir, 'assets', YEAR), { recursive: true });
    for (const file of ['punteggi.json', 'squadre.json', 'eliminazioni.json', 'stato.json', 'fasi.json', 'premi.json']) {
      cpSync(join(ROOT, 'data', YEAR, file), join(dir, 'data', YEAR, file));
    }
    cpSync(join(ROOT, 'assets', YEAR, 'punteggi.json'), join(dir, 'assets', YEAR, 'punteggi.json'));

    const run = runScript('build-classifica.js', dir, { YEAR });
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(readOutput(dir, 'data', YEAR, 'classifica.json'), committed(YEAR, 'classifica.json'));
    assert.deepEqual(readOutput(dir, 'data', YEAR, 'dettaglio.json'), committed(YEAR, 'dettaglio.json'));
  });
});
