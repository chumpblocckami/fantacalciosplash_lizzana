/**
 * scripts/build-classifica.js — turning player scores into the fantasy table.
 *
 * The reserve rule is the interesting part, and the regolamento is precise about it:
 *
 *   5) "La riserva entra in punteggio solamente nel momento in cui uno dei titolari viene
 *      eliminato dal torneo"
 *   6) "se si hanno a disposizione delle riserve che possono subentrare il malus non ci sara
 *      e fara fede il punteggio di quel giocatore"
 *
 * So the reserve replaces the eliminated starter rather than being added alongside, and who
 * counts as eliminated is read from eliminazioni.json rather than guessed from the score.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

import { workspace, runScript, readOutput } from '../helpers/run-script.js';
import { POINTS_PER_MISSING_GAME } from '../../js/constants.js';

const YEAR = '2099';
const OUT = -2; // A team that is out of the tournament scores this every remaining match.

assert.equal(POINTS_PER_MISSING_GAME, OUT, 'the fixtures below assume the standard penalty');

const GOALKEEPER = 'Mario Rossi | ALFA';
const STARTER_ONE = 'Luca Bianchi | BETA';
const STARTER_TWO = 'Gino Verdi | GAMMA';
const STARTER_THREE = 'Ada Neri | DELTA';
const RESERVE = 'Ennio Grigi | OMEGA';
const LINEUP = [GOALKEEPER, STARTER_ONE, STARTER_TWO, STARTER_THREE, RESERVE];

/**
 * Build a punteggi row.
 *
 * @param {string} player - "Name Surname | TEAM"
 * @param {number[]} matchScores - One score per match
 * @param {number} [premi] - End-of-tournament prize points
 */
function scores(player, matchScores, premi = 0) {
  const row = { player };
  matchScores.forEach((score, index) => { row[`Match ${index + 1}`] = score; });
  row.Premi = premi;
  row.Total = matchScores.reduce((a, b) => a + b, 0) + premi;
  return row;
}

/** Build a squadre row. */
function lineup(coach, [goalkeeper, one, two, three, reserve]) {
  return {
    Fantallenatore: coach,
    Portiere: goalkeeper,
    'Titolare 1': one,
    'Titolare 2': two,
    'Titolare 3': three,
    Riserva: reserve,
  };
}

/**
 * Run the ranker over the given tables and return the classifica it wrote.
 *
 * Passing eliminazioni as null leaves the file out altogether, which is how an edition
 * scored before compute-scores.js started writing it looks.
 */
function rank(name, punteggi, squadre, eliminazioni = {}, stato = null) {
  const cwd = workspace(`classifica-${name}`);
  const dataDir = join(cwd, 'data', YEAR);
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, 'punteggi.json'), JSON.stringify(punteggi));
  writeFileSync(join(dataDir, 'squadre.json'), JSON.stringify(squadre));
  if (eliminazioni !== null) {
    writeFileSync(join(dataDir, 'eliminazioni.json'), JSON.stringify(eliminazioni));
  }
  if (stato !== null) {
    writeFileSync(join(dataDir, 'stato.json'), JSON.stringify(stato));
  }

  const run = runScript('build-classifica.js', cwd, { YEAR });
  assert.equal(run.status, 0, `build-classifica.js failed: ${run.stderr}`);
  return readOutput(cwd, 'data', YEAR, 'classifica.json') ?? [];
}

/** Look up one coach's score. */
function scoreOf(classifica, coach) {
  return classifica.find(row => row.Allenatore === coach)?.Punteggio;
}

describe('scripts/build-classifica.js', () => {
  describe('the ordinary case', () => {
    const punteggi = [
      scores(GOALKEEPER, [5, 5]),
      scores(STARTER_ONE, [4, 4]),
      scores(STARTER_TWO, [3, 3]),
      scores(STARTER_THREE, [2, 2]),
      scores(RESERVE, [1, 1]),
    ];
    const squadre = [lineup('Matteo', LINEUP)];

    test('counts the four starters and leaves the reserve on the bench', () => {
      // (5 + 4 + 3 + 2) twice. The reserve's 1 + 1 is not counted.
      assert.equal(scoreOf(rank('ordinary', punteggi, squadre), 'Matteo'), 28);
    });

    test('ranks coaches best first', () => {
      const two = [...squadre, lineup('Giulia', [...LINEUP].reverse())];
      const table = rank('order', punteggi, two);
      assert.deepEqual(table.map(row => row.Allenatore), ['Matteo', 'Giulia']);
    });

    test('matches a player whose name is spelled differently in the two files', () => {
      // The sheet holds a typed apostrophe, the scorer a straight one, and the case differs.
      const table = rank(
        'fuzzy',
        [scores("Rita Levi's | ALFA", [10]), scores(STARTER_ONE, [1]), scores(STARTER_TWO, [1]),
         scores(STARTER_THREE, [1]), scores(RESERVE, [1])],
        [lineup('Matteo', ['rita levi’s | alfa', STARTER_ONE, STARTER_TWO, STARTER_THREE, RESERVE])]
      );
      assert.equal(scoreOf(table, 'Matteo'), 13);
    });
  });

  describe('the reserve rule', () => {
    const squadre = [lineup('Matteo', LINEUP)];
    const out = (...players) =>
      Object.fromEntries(players.map(player => [player, ['Match 1']]));

    test('the reserve replaces an eliminated starter rather than joining them', () => {
      // BETA is out, so Luca Bianchi's -2 gives way to the reserve's 6: 5 + 6 + 3 + 2.
      const punteggi = [
        scores(GOALKEEPER, [5]),
        scores(STARTER_ONE, [OUT]),
        scores(STARTER_TWO, [3]),
        scores(STARTER_THREE, [2]),
        scores(RESERVE, [6]),
      ];
      const table = rank('substitution', punteggi, squadre, out(STARTER_ONE));
      assert.equal(scoreOf(table, 'Matteo'), 5 + 6 + 3 + 2);
    });

    test('a reserve who is also out leaves the slot charged once, not twice', () => {
      const punteggi = [
        scores(GOALKEEPER, [5]),
        scores(STARTER_ONE, [OUT]),
        scores(STARTER_TWO, [3]),
        scores(STARTER_THREE, [2]),
        scores(RESERVE, [OUT]),
      ];
      const table = rank('dead-reserve', punteggi, squadre, out(STARTER_ONE, RESERVE));
      assert.equal(scoreOf(table, 'Matteo'), 5 + OUT + 3 + 2);
    });

    test('one reserve covers one starter, so a second casualty keeps the penalty', () => {
      const punteggi = [
        scores(GOALKEEPER, [5]),
        scores(STARTER_ONE, [OUT]),
        scores(STARTER_TWO, [OUT]),
        scores(STARTER_THREE, [2]),
        scores(RESERVE, [6]),
      ];
      const table = rank('two-out', punteggi, squadre, out(STARTER_ONE, STARTER_TWO));
      assert.equal(scoreOf(table, 'Matteo'), 5 + 6 + OUT + 2);
    });

    test('a starter who merely scored -2 does not trigger a substitution', () => {
      // A defeat with a yellow card is 0 team points and -2 for the card, so a player who
      // very much did play scores exactly the missing-game penalty. Nobody is eliminated
      // here, so the reserve stays on the bench however well they did.
      const punteggi = [
        scores(GOALKEEPER, [5]),
        scores(STARTER_ONE, [OUT]),
        scores(STARTER_TWO, [3]),
        scores(STARTER_THREE, [2]),
        scores(RESERVE, [9]),
      ];
      const table = rank('booked-not-out', punteggi, squadre, {});
      assert.equal(scoreOf(table, 'Matteo'), 5 + OUT + 3 + 2);
    });

    test('a bonus can only ever help', () => {
      // Adding points to a player used to be able to lower their coach's score, because
      // lifting a genuine -2 to +1 made the starter read as available and dropped a reserve
      // who was covering. Elimination no longer depends on the score, so it cannot.
      const base = [
        scores(GOALKEEPER, [5]),
        scores(STARTER_ONE, [OUT]),
        scores(STARTER_TWO, [3]),
        scores(STARTER_THREE, [2]),
        scores(RESERVE, [20]),
      ];
      const withMvp = base.map(row =>
        row.player === STARTER_ONE ? scores(row.player, [OUT + 3]) : row
      );

      const before = scoreOf(rank('monotonic-before', base, squadre, {}), 'Matteo');
      const after = scoreOf(rank('monotonic-after', withMvp, squadre, {}), 'Matteo');

      assert.equal(before, 5 + OUT + 3 + 2);
      assert.equal(after, before + 3);
    });

    test('a player the sheet names who never took the field counts as unavailable', () => {
      const punteggi = [
        scores(GOALKEEPER, [5]),
        scores(STARTER_TWO, [3]),
        scores(STARTER_THREE, [2]),
        scores(RESERVE, [6]),
      ];
      const table = rank('unknown-starter', punteggi, squadre, {});
      assert.equal(scoreOf(table, 'Matteo'), 5 + 6 + 3 + 2);
    });
  });

  describe('the malus during the girone', () => {
    test('is not charged for a starter whose team has not played yet', () => {
      // Four starters, one of them still waiting for their first group match. Treating that
      // as an elimination would spend the reserve and put -2 on the table.
      const punteggi = [
        scores(GOALKEEPER, [5]),
        scores(STARTER_TWO, [3]),
        scores(STARTER_THREE, [2]),
        scores(RESERVE, [9]),
      ];
      const table = rank(
        'girone-waiting',
        punteggi,
        [lineup('Matteo', LINEUP)],
        {},
        { apply_malus: false, knockouts_started: false, finished: false }
      );
      assert.equal(scoreOf(table, 'Matteo'), 5 + 0 + 3 + 2);
    });
  });

  describe('editions scored before eliminazioni.json existed', () => {
    test('fall back to inferring who is out from the score, and say so', () => {
      const punteggi = [
        scores(GOALKEEPER, [5]),
        scores(STARTER_ONE, [OUT]),
        scores(STARTER_TWO, [3]),
        scores(STARTER_THREE, [2]),
        scores(RESERVE, [6]),
      ];
      const cwd = workspace('classifica-legacy');
      const dataDir = join(cwd, 'data', YEAR);
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(join(dataDir, 'punteggi.json'), JSON.stringify(punteggi));
      writeFileSync(join(dataDir, 'squadre.json'), JSON.stringify([lineup('Matteo', LINEUP)]));

      const run = runScript('build-classifica.js', cwd, { YEAR });
      assert.equal(run.status, 0, run.stderr);
      assert.match(run.stdout, /No eliminazioni\.json/);

      const table = readOutput(cwd, 'data', YEAR, 'classifica.json');
      assert.equal(scoreOf(table, 'Matteo'), 5 + 6 + 3 + 2, 'the substitution still happens');
    });
  });

  describe('the Premi column', () => {
    test('prize points count for the four starters', () => {
      const punteggi = [
        scores(GOALKEEPER, [0], 1),
        scores(STARTER_ONE, [0], 2),
        scores(STARTER_TWO, [0], 4),
        scores(STARTER_THREE, [0], 8),
        scores(RESERVE, [0], 16),
      ];
      const table = rank('premi', punteggi, [lineup('Matteo', LINEUP)], {});
      assert.equal(scoreOf(table, 'Matteo'), 1 + 2 + 4 + 8);
    });

    test('and for the reserve too, once they have come on', () => {
      // A prize follows the player, so it counts for whoever fielded them, on the same terms
      // as their match scores: the reserve has to have been in punteggio at some point.
      const punteggi = [
        scores(GOALKEEPER, [0], 1),
        scores(STARTER_ONE, [OUT], 2),
        scores(STARTER_TWO, [0], 4),
        scores(STARTER_THREE, [0], 8),
        scores(RESERVE, [0], 16),
      ];
      const table = rank('premi-reserve', punteggi, [lineup('Matteo', LINEUP)], out(STARTER_ONE));
      assert.equal(scoreOf(table, 'Matteo'), 1 + 2 + 4 + 8 + 16);
    });

    const out = (...players) => Object.fromEntries(players.map(p => [p, ['Match 1']]));
  });

  describe('duplicate registrations', () => {
    test('a coach who registers twice is ranked once', () => {
      // Regolamento rule 1: one team per participant. The Apps Script keeps only the last
      // entry per coach, and the sheet can still hold a repeat from a manual edit.
      const punteggi = LINEUP.map(player => scores(player, [1]));
      const entry = lineup('Matteo', LINEUP);
      const table = rank('duplicates', punteggi, [entry, { ...entry }]);

      assert.deepEqual(table.map(row => row.Allenatore), ['Matteo']);
    });

    test('the most recent lineup is the one that counts', () => {
      const punteggi = [
        scores(GOALKEEPER, [5]), scores(STARTER_ONE, [4]), scores(STARTER_TWO, [3]),
        scores(STARTER_THREE, [2]), scores(RESERVE, [1]), scores('Zeno Ultimo | OMEGA', [100]),
      ];
      const first = lineup('Matteo', LINEUP);
      const second = lineup('Matteo ', [GOALKEEPER, 'Zeno Ultimo | OMEGA', STARTER_TWO, STARTER_THREE, RESERVE]);

      const table = rank('duplicates-latest', punteggi, [first, second]);
      assert.equal(table.length, 1);
      assert.equal(scoreOf(table, 'Matteo '), 5 + 100 + 3 + 2);
    });
  });

  describe('nothing to rank', () => {
    test('an empty punteggi table produces no classifica', () => {
      const cwd = workspace('classifica-empty');
      mkdirSync(join(cwd, 'data', YEAR), { recursive: true });
      writeFileSync(join(cwd, 'data', YEAR, 'punteggi.json'), '[]');
      writeFileSync(join(cwd, 'data', YEAR, 'squadre.json'), '[]');

      const run = runScript('build-classifica.js', cwd, { YEAR });
      assert.equal(run.status, 0);
      assert.match(run.stdout, /No punteggi or squadre yet/);
      assert.equal(readOutput(cwd, 'data', YEAR, 'classifica.json'), null);
    });
  });
});
