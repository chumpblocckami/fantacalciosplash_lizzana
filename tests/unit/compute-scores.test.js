/**
 * scripts/compute-scores.js against a small tournament played to completion.
 *
 * Every expected number here was worked out by hand from the regolamento's point values, so a
 * failure means the scorer changed behaviour rather than that a snapshot drifted. The elimination
 * malus in particular has never run against real data: the committed 2026 snapshot is entirely
 * unplayed, and the only knockout group in it is the organisers' rehearsal group, which is
 * filtered out.
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { writeSnapshot, player, team } from '../helpers/api-fixture.js';
import { workspace, runScript, readOutput } from '../helpers/run-script.js';
import { SNAPSHOT, QUALIFIED, ELIMINATED, KNOCKOUT_ROUNDS } from '../fixtures/mini-tournament.js';
import {
  POINTS_TOP_SCORER,
  POINTS_BEST_PLAYER,
  POINTS_BEST_GOALKEEPER,
} from '../../js/constants.js';

const YEAR = '2099';

let punteggi;
let risultati;
let eliminazioni;
let stdout;

before(() => {
  const cwd = workspace('compute-scores');
  writeSnapshot(cwd, YEAR, SNAPSHOT);

  const run = runScript('compute-scores.js', cwd, { YEAR });
  assert.equal(run.status, 0, `compute-scores.js failed: ${run.stderr}`);
  stdout = run.stdout;

  punteggi = readOutput(cwd, 'data', YEAR, 'punteggi.json');
  risultati = readOutput(cwd, 'data', YEAR, 'risultati.json');
  eliminazioni = readOutput(cwd, 'data', YEAR, 'eliminazioni.json');
});

/** The punteggi row for one player. */
function row(player) {
  return punteggi.find(entry => entry.player === player);
}

/** The Match columns of a punteggi row, in order. */
function matchColumns(entry) {
  return Object.keys(entry)
    .filter(key => key.startsWith('Match '))
    .sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)));
}

/** A player's per-match scores, in order. */
function matches(player) {
  const entry = row(player);
  return matchColumns(entry).map(key => entry[key]);
}

describe('scripts/compute-scores.js', () => {
  describe('which fixtures count', () => {
    test('only the played men\'s fixtures are scored', () => {
      assert.equal(risultati.length, 4, 'four fixtures were played and are relevant');
      assert.match(stdout, /Processed 4 matches \(1 not played yet\)/);
    });

    test('the women\'s tournament and the rehearsal group are left out', () => {
      const teams = new Set(risultati.flatMap(match => [match.home, match.away]));
      assert.deepEqual([...teams].sort(), ['ALFA', 'BETA', 'DELTA', 'GAMMA']);
      assert.equal(row('Sara Rosa | OMEGA'), undefined, 'the women\'s tournament is not scored');
      assert.equal(row('Test Uno | PROVA'), undefined, 'the rehearsal group is not scored');
    });

    test('an unplayed fixture contributes nothing', () => {
      assert.ok(
        !risultati.some(match => match.stage === 'Maschile' && match.score === '0-0'),
        'the scheduled ALFA-GAMMA fixture is not in the results'
      );
    });
  });

  describe('the scoring rules', () => {
    test('a goal is worth 2, a yellow card -2, a red card -3', () => {
      // Luca Bianchi: two goals and a yellow in a win he was also named best player of.
      assert.equal(matches('Luca Bianchi | ALFA')[0], 2 * 2 - 2 + 2 + 3);
      // Gino Verdi: sent off in the same win.
      assert.equal(matches('Gino Verdi | ALFA')[0], -3 + 2);
    });

    test('a win is worth 2, a draw 1 and a defeat 0', () => {
      assert.equal(matches('Ada Neri | ALFA')[0], 2, 'on the bench for a win, nothing else');
      assert.equal(matches('Gigi Argento | DELTA')[0], 2 + 1, 'scored in a draw');
      assert.equal(matches('Carlo Blu | BETA')[0], 0, 'played a defeat, nothing else');
    });

    test('a goalkeeper gets 5 for a clean sheet and -0.5 per goal conceded', () => {
      assert.deepEqual(matches('Mario Rossi | ALFA').slice(0, 3), [
        5 + 2, // 3-0 win, clean sheet
        -0.5 + 2, // 2-1 win, one conceded
        5 + 2, // 1-0 win, clean sheet
      ]);
      assert.equal(matches('Bruno Gialli | BETA')[0], 3 * -0.5, 'three conceded in a defeat');
    });

    test('the match MVP is worth 3, and only to the named player', () => {
      const mvpMatch = matches('Luca Bianchi | ALFA')[0];
      const withoutBonus = 2 * 2 - 2 + 2;
      assert.equal(mvpMatch - withoutBonus, 3);
      assert.equal(matches('Mario Rossi | ALFA')[0], 7, 'a teammate gets no share of the bonus');
    });

    test('a player named twice in one fixture is scored once', () => {
      // Gino Verdi is listed as a starter and again as a substitute in fixture 1.
      assert.equal(matches('Gino Verdi | ALFA')[0], -1, 'the red card is not counted twice');
    });

    test('names are title-cased, however the API spelled them', () => {
      // The API sends "Gino " and "Verdi ", padded with spaces.
      assert.ok(row('Gino Verdi | ALFA'), 'padding is stripped and each word capitalised');
    });
  });

  describe('the elimination malus', () => {
    test('everybody gets one column per round of the tournament', () => {
      // ALFA and GAMMA played three matches each, which is the longest run, so that is how
      // many columns the table has. Nobody is padded beyond it.
      const columns = punteggi.map(entry => matches(entry.player).length);
      assert.deepEqual([...new Set(columns)], [3]);
    });

    test('a team knocked out at the group stage is charged once per missed round', () => {
      // Regolamento rule 6: "-2 per ogni fase non disputata dalla sua squadra". BETA and DELTA
      // played the group stage and missed both knockout rounds, so that is two penalties.
      for (const team of ELIMINATED) {
        for (const entry of punteggi.filter(p => p.player.endsWith(`| ${team}`))) {
          const penalties = matches(entry.player).filter(score => score === -2).length;
          assert.equal(penalties, KNOCKOUT_ROUNDS, `${entry.player} is charged ${penalties} times`);
        }
      }
    });

    test('a team that reached the knockout rounds is not padded', () => {
      for (const team of QUALIFIED) {
        const entry = punteggi.find(p => p.player.endsWith(`| ${team}`));
        assert.equal(matches(entry.player).length, 3, `${entry.player} played three matches`);
      }
      // The champion's keeper: 3-0, 2-1 and 1-0, and nothing after.
      assert.deepEqual(matches('Mario Rossi | ALFA'), [7, 1.5, 7]);
      assert.equal(row('Mario Rossi | ALFA').Total, 15.5);
    });

    test('the rounds a team missed are recorded, so a reserve can be brought on', () => {
      for (const team of ELIMINATED) {
        for (const entry of punteggi.filter(p => p.player.endsWith(`| ${team}`))) {
          assert.deepEqual(eliminazioni[entry.player], ['Match 2', 'Match 3']);
        }
      }
      for (const team of QUALIFIED) {
        for (const entry of punteggi.filter(p => p.player.endsWith(`| ${team}`))) {
          assert.equal(eliminazioni[entry.player], undefined, `${entry.player} was never out`);
        }
      }
    });

    test('being left out of a squad is not the same as being eliminated', () => {
      // Gino Verdi and Ada Neri appear only in ALFA's first fixture. They are charged for the
      // two matches they were not named for, because they earned nothing in them, but ALFA
      // went on to win the tournament, so no reserve is due to come on in their place.
      for (const player of ['Gino Verdi | ALFA', 'Ada Neri | ALFA']) {
        assert.equal(matches(player).filter(score => score === -2).length, 2);
        assert.equal(eliminazioni[player], undefined, `${player} was not eliminated`);
      }
      assert.equal(row('Ada Neri | ALFA').Total, 2 - 2 - 2);
    });
  });

  describe('the third-place play-off', () => {
    /**
     * A group match and a third-place play-off, the play-off named however the caller likes.
     *
     * Mario Rossi scores once in the group stage and five times in the play-off, so the two
     * halves of rule 8 are easy to tell apart: the play-off must not be worth fantasy points,
     * but its goals must still count towards the capocannoniere.
     */
    function playOff(name, directory) {
      const cwd = workspace(directory);
      writeSnapshot(cwd, YEAR, {
        groups: [
          { id: 1, name: 'Maschile', gender: 'male', kind: 'girone' },
          { id: 2, name, gender: 'male', kind: 'playoffs' },
        ],
        fixtures: [
          {
            id: 1,
            group_name: 'Maschile',
            gender: 'male',
            closed: true,
            home: team('ALFA', 1, [player(1, 'mario', 'rossi', { goals: 1 })]),
            away: team('BETA', 0, [player(2, 'luca', 'bianchi')]),
          },
          {
            id: 2,
            group_name: name,
            gender: 'male',
            closed: true,
            home: team('ALFA', 5, [player(1, 'mario', 'rossi', { goals: 5 })]),
            away: team('BETA', 0, [player(2, 'luca', 'bianchi')]),
          },
        ],
      });

      const run = runScript('compute-scores.js', cwd, { YEAR });
      assert.equal(run.status, 0, run.stderr);
      return {
        punteggi: readOutput(cwd, 'data', YEAR, 'punteggi.json'),
        risultati: readOutput(cwd, 'data', YEAR, 'risultati.json'),
      };
    }

    test('earns nobody any fantasy points', () => {
      // Rule 8: "La finale 3 / 4 posto non conta ai fini dei punteggi fanta."
      const { punteggi: scored } = playOff('Terzo/Quarto M', 'third-place');
      const mario = scored.find(entry => entry.player === 'Mario Rossi | ALFA');

      assert.equal(matchColumns(mario).length, 1, 'only the group match is scored');
      assert.equal(mario['Match 1'], 1 * 2 + 2, 'the group goal, and the win');
    });

    test('still appears on the scoreboard', () => {
      const { risultati: results } = playOff('Terzo/Quarto M', 'third-place-results');
      assert.ok(results.some(match => match.stage === 'Terzo/Quarto M'));
    });

    test('still counts towards the capocannoniere', () => {
      // The other half of rule 8: "contera invece per le classifiche capocannonieri." Six
      // goals in all, and the tournament is over, so the prize is awarded.
      const { punteggi: scored } = playOff('Terzo/Quarto M', 'third-place-capocannoniere');
      const mario = scored.find(entry => entry.player === 'Mario Rossi | ALFA');

      assert.equal(mario.Premi, POINTS_TOP_SCORER);
      assert.equal(mario.Total, 1 * 2 + 2 + POINTS_TOP_SCORER);
    });

    test('is recognised however the organisers spell the group', () => {
      for (const [name, directory] of [
        ['terzo quarto', 'spelling-space'],
        ['3/4 Maschile', 'spelling-digits'],
        ['Terzo / Quarto M', 'spelling-spaced-slash'],
      ]) {
        const { punteggi: scored } = playOff(name, directory);
        const mario = scored.find(entry => entry.player === 'Mario Rossi | ALFA');
        assert.equal(matchColumns(mario).length, 1, `"${name}" was not recognised`);
      }
    });
  });

  describe('the published table', () => {
    test('totals are the sum of the match columns', () => {
      for (const entry of punteggi) {
        const expected = Math.round(matches(entry.player).reduce((a, b) => a + b, 0) * 10) / 10;
        assert.equal(entry.Total, expected, `${entry.player} total does not match its columns`);
      }
    });

    test('rows are sorted by total, best first', () => {
      const totals = punteggi.map(entry => entry.Total);
      assert.deepEqual(totals, [...totals].sort((a, b) => b - a));
    });

    test('the tournament\'s best player tops the table', () => {
      assert.equal(punteggi[0].player, 'Luca Bianchi | ALFA');
      assert.equal(punteggi[0].Total, 7 + 6 + 4);
    });

    test('the end-of-tournament prize is withheld while a fixture is still to be played', () => {
      // One fixture in this snapshot is still scheduled, so the capocannoniere is not settled
      // and nobody is paid the prize yet.
      assert.match(stdout, /1 not played yet/);
      assert.ok(punteggi.every(entry => entry.Premi === 0));
    });

    test('only the Capocannoniere prize is automated', () => {
      // The regolamento also awards Miglior giocatore and Miglior portiere, but those are
      // staff decisions with nothing in the API to derive them from, so they stay manual.
      assert.equal(POINTS_BEST_PLAYER, 5);
      assert.equal(POINTS_BEST_GOALKEEPER, 5);
    });
  });
});
