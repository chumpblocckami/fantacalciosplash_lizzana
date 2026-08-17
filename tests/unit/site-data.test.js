/**
 * Checks on the things the site assumes about the repository around it.
 *
 * The frontend has no build step and no server: it fetches files out of data/ and links
 * straight into assets/. Anything it assumes to be there is only true because it happens to
 * be true, so the assumptions are written down here.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

import { ROOT } from '../helpers/paths.js';
import { CURRENT_YEAR, DEADLINE, GSP_API_URL } from '../../js/constants.js';

const editions = JSON.parse(readFileSync(join(ROOT, 'data', 'editions.json'), 'utf-8'));

/** Read a file from the repository. */
function read(...segments) {
  return readFileSync(join(ROOT, ...segments), 'utf-8');
}

describe('editions', () => {
  test('editions.json lists every edition in data/, newest first', () => {
    const onDisk = readdirSync(join(ROOT, 'data'), { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^\d{4}$/.test(entry.name))
      .map(entry => entry.name);

    assert.deepEqual([...editions].sort().reverse(), editions, 'newest edition first');
    assert.deepEqual([...editions].sort(), [...onDisk].sort());
  });

  test('the current edition is the newest one', () => {
    assert.equal(editions[0], CURRENT_YEAR);
  });
});

describe('the iscrizione deadline', () => {
  test('falls inside the current edition', () => {
    assert.equal(String(DEADLINE.getFullYear()), CURRENT_YEAR);
  });

  test('closes five minutes before the men\'s kick-off', () => {
    // js/constants.js: iscrizioni chiuse alle 15:59 ora di Roma, 13 agosto 2026.
    assert.equal(DEADLINE.toISOString(), new Date('2026-08-13T15:59:00+02:00').toISOString());
  });
});

describe('the regolamento link', () => {
  test('at least one edition has no PDF, so the link cannot be unconditional', () => {
    const missing = editions.filter(
      edition => !existsSync(join(ROOT, 'assets', edition, 'regolamento.pdf'))
    );
    assert.deepEqual(missing, ['2023']);
  });

  test('the button is withdrawn when the PDF is not there', () => {
    // There is no manifest of which editions have one, so js/app.js asks for the file and
    // removes the button if the answer is not a 200.
    const app = read('js', 'app.js');
    assert.match(app, /fetch\(href, \{ method: 'HEAD' \}\)/);
    assert.match(app, /btn\.remove\(\)/);
  });
});

describe('the API base URL', () => {
  test('the scraper takes its default from js/constants.js', () => {
    const scrape = read('scripts', 'scrape.js');

    assert.match(scrape, /from '\.\.\/js\/constants\.js'/);
    assert.match(scrape, /process\.env\.GSP_API_URL \|\| GSP_API_URL/);
    assert.match(GSP_API_URL, /^https:\/\//);
  });
});

describe('the history file', () => {
  test('assets/history.json is an exact duplicate of data/history.json', () => {
    // Only data/history.json is read, by scripts/assign_quotazioni.py. The copy under assets/
    // is where the retired Python history builder wrote it. They are identical today, so
    // nothing is at risk yet, but two copies of a file only one of which is maintained is a
    // drift waiting to happen.
    assert.ok(existsSync(join(ROOT, 'assets', 'history.json')));
    assert.equal(read('assets', 'history.json'), read('data', 'history.json'));
  });
});

describe('the scoring data the site reads', () => {
  const SCORING_FILES = ['punteggi.json', 'classifica.json', 'squadre.json'];
  const FRONTEND_LOADERS = [
    'giocatori.json',
    'squadre.json',
    'punteggi.json',
    'classifica.json',
    'dettaglio.json',
    'risultati.json',
  ];

  test('loadEditionData only reads from ./data/', () => {
    const api = read('js', 'api.js');

    assert.match(api, /const BASE_DATA_PATH = '\.\/data'/);
    for (const file of FRONTEND_LOADERS) {
      assert.match(
        api,
        new RegExp(`\\$\\{BASE_DATA_PATH\\}/\\$\\{edition\\}/${file.replace('.', '\\.')}`),
        file
      );
    }
  });

  test('every edition has the scoring tables the frontend needs', () => {
    for (const edition of editions) {
      for (const file of SCORING_FILES) {
        const path = join(ROOT, 'data', edition, file);
        assert.ok(existsSync(path), `${edition}/${file}`);
        const rows = JSON.parse(readFileSync(path, 'utf-8'));
        assert.ok(Array.isArray(rows) && rows.length > 0, `${edition}/${file} is non-empty`);
      }
    }
  });

  test('the current edition ships a baked dettaglio for the squad sheet', () => {
    const path = join(ROOT, 'data', CURRENT_YEAR, 'dettaglio.json');
    assert.ok(existsSync(path), 'dettaglio.json');
    const rows = JSON.parse(readFileSync(path, 'utf-8'));
    assert.ok(Array.isArray(rows) && rows.length > 0);
    assert.ok('players' in rows[0], 'dettaglio rows carry per-slot match breakdown');
  });

  test('the build inputs that produced the current scores are in the repo', () => {
    const apiDir = join(ROOT, 'assets', CURRENT_YEAR, 'api');
    assert.ok(existsSync(join(apiDir, 'fixtures.json')), 'scraped fixtures');
    assert.ok(existsSync(join(ROOT, 'assets', CURRENT_YEAR, 'punteggi.json')), 'raw ratings');
    for (const file of ['eliminazioni.json', 'stato.json']) {
      assert.ok(existsSync(join(ROOT, 'data', CURRENT_YEAR, file)), file);
    }
  });

  test('classifica rendering never calls an external API', () => {
    const sources = [
      read('js', 'api.js'),
      read('js', 'app.js'),
      read('js', 'components', 'classifica.js'),
      read('js', 'components', 'squad-sheet.js'),
    ].join('\n');

    assert.doesNotMatch(sources, /fetch\([^)]*https?:\/\/[^)]*(classifica|punteggi|dettaglio)/i);
  });
});

describe('the scoring constants', () => {
  test('every script reads them from js/constants.js', () => {
    // They used to be redeclared in compute-scores.js under a comment saying the two copies
    // must match, with nothing to make them.
    for (const script of ['compute-scores.js', 'build-classifica.js', 'fetch-registrations.js']) {
      assert.match(read('scripts', script), /from '\.\.\/js\/constants\.js'/, `${script}`);
    }
  });

  test('no script keeps a private copy of a point value', () => {
    for (const script of ['compute-scores.js', 'build-classifica.js']) {
      const source = read('scripts', script);
      assert.doesNotMatch(source, /must match js\/constants\.js/, script);
      assert.doesNotMatch(source, /^const POINTS(_MISSING)? = /m, script);
    }
  });
});

describe('the Python is gone', () => {
  test('only the two by-hand scripts are left', () => {
    // app.py, src/ and the Streamlit frontend have been replaced by index.html plus js/ and
    // scripts/. What survives is the pair of jobs that run by hand between editions and
    // never on the site: pricing the new player list, and lifting the old spreadsheets out
    // to Google Sheets. Both want pandas, so both stay Python.
    const python = execSync('git ls-files "*.py"', { cwd: ROOT, encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean)
      .sort();

    assert.deepEqual(python, [
      'scripts/assign_quotazioni.py',
      'scripts/export_legacy_data.py',
    ]);
  });

  test('nothing imports a module that was deleted with it', () => {
    const sources = [
      ...readdirSync(join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => join('js', f)),
      ...readdirSync(join(ROOT, 'js', 'components')).map(f => join('js', 'components', f)),
      ...readdirSync(join(ROOT, 'scripts')).filter(f => f.endsWith('.js')).map(f => join('scripts', f)),
      'index.html',
    ];

    for (const module of ['scoring.js', 'ranking.js']) {
      assert.ok(!existsSync(join(ROOT, 'js', module)), `js/${module} should be gone`);
      const importers = sources.filter(source => read(source).includes(`/${module}`));
      assert.deepEqual(importers, [], `${module} is still referenced`);
    }
  });
});
