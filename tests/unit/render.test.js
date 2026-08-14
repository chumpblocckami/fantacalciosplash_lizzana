/**
 * What the render components put into the page, and whether it can be trusted.
 *
 * Every string these components display comes from somewhere outside the repository: team and
 * player names from the Calciosplash API, and fantallenatore names typed into the public
 * iscrizione form, which reach data/2026/squadre.json by way of the Apps Script and are then
 * shown to every visitor. None of it is escaped on the way in, so whether it is escaped on
 * the way out is the whole question.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { element, installDocument } from '../helpers/dom.js';
import { renderTable } from '../../js/components/table.js';
import { renderScoreboard } from '../../js/components/scoreboard.js';
import { renderPopularPlayersChart } from '../../js/components/chart.js';
import { renderAccordion } from '../../js/components/accordion.js';
import { renderTabs } from '../../js/components/tabs.js';
import { renderSquadSheet } from '../../js/components/squad-sheet.js';
import { renderClassifica } from '../../js/components/classifica.js';
import { storageKey } from '../../js/team-hash.js';

const INJECTION = '<img src=x onerror="alert(1)">';

describe('renderTable', () => {
  test('renders a row per record, plus a running count', () => {
    const container = element();
    renderTable(container, {
      id: 't',
      columns: ['Nominativo', 'Quotazione'],
      rows: [['Mario Rossi', 50], ['Luca Bianchi', 40]],
    });

    const body = container.querySelector('#body-t').innerHTML;
    assert.match(body, /Mario Rossi/);
    assert.match(body, /Luca Bianchi/);
    assert.equal(container.querySelector('#count-t').textContent, '2 righe');
  });

  test('says so when there is nothing to show', () => {
    const container = element();
    renderTable(container, { id: 'empty', columns: ['A'], rows: [] });
    assert.match(container.querySelector('#body-empty').innerHTML, /Nessun dato disponibile/);
  });

  test('shows a dash rather than a blank for a missing value', () => {
    const container = element();
    renderTable(container, { id: 'gaps', columns: ['A'], rows: [[null]] });
    assert.match(container.querySelector('#body-gaps').innerHTML, /—/);
  });

  test('renders the search box only when asked', () => {
    const plain = element();
    renderTable(plain, { id: 'p', columns: ['A'], rows: [['x']] });
    assert.doesNotMatch(plain.innerHTML, /id="search-p"/);

    const searchable = element();
    renderTable(searchable, { id: 's', columns: ['A'], rows: [['x']], searchable: true });
    assert.match(searchable.innerHTML, /id="search-s"/);
  });

  test('filtering redraws the rows without replacing the search box', () => {
    // The input keeps its focus and caret only because the component never rewrites the
    // container it lives in, so this is worth pinning down.
    const container = element();
    renderTable(container, {
      id: 'f',
      columns: ['Nominativo'],
      rows: [['Mario Rossi'], ['Luca Bianchi']],
      searchable: true,
    });
    const beforeHtml = container.innerHTML;

    container.querySelector('#search-f').dispatch('input', { target: { value: 'bianchi' } });

    assert.equal(container.innerHTML, beforeHtml, 'the container itself is untouched');
    assert.match(container.querySelector('#body-f').innerHTML, /Luca Bianchi/);
    assert.doesNotMatch(container.querySelector('#body-f').innerHTML, /Mario Rossi/);
    assert.equal(container.querySelector('#count-f').textContent, '1 righe (filtrate)');
  });

  test('escapes a fantallenatore name', () => {
    // A coach registers as <img src=x onerror="alert(1)">, the name is stored in the sheet,
    // fetch-registrations.js copies it into squadre.json, and the Squadre iscritte table
    // renders it for every visitor.
    const container = element();
    renderTable(container, {
      id: 'xss',
      columns: ['Fantallenatore'],
      rows: [[INJECTION]],
    });

    const body = container.querySelector('#body-xss').innerHTML;
    assert.ok(!body.includes(INJECTION), 'no raw markup reaches the page');
    assert.match(body, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  });

  test('escapes a column heading', () => {
    // Column names come from the keys of squadre.json, which the Apps Script derives from the
    // sheet, so they are attacker-influenced too.
    const container = element();
    renderTable(container, { id: 'head', columns: [INJECTION], rows: [['x']] });
    assert.ok(!container.querySelector('#head-head').innerHTML.includes(INJECTION));
  });
});

describe('renderScoreboard', () => {
  test('groups matches by stage and marks the winner', () => {
    const container = element();
    renderScoreboard(container, [
      { home: 'ALFA', away: 'BETA', score: '3-0', stage: 'Maschile', closed: true },
      { home: 'GAMMA', away: 'DELTA', score: '1-1', stage: 'Finale M', closed: true },
    ]);

    assert.match(container.innerHTML, /Maschile/);
    assert.match(container.innerHTML, /Finale M/);
    assert.match(container.innerHTML, /FT/, 'a closed match is marked full time');
  });

  test('marks a live match', () => {
    const container = element();
    renderScoreboard(container, [{ home: 'ALFA', away: 'BETA', score: '0-0', live: true }]);
    assert.match(container.innerHTML, /LIVE/);
  });

  test('says so when there are no results', () => {
    const container = element();
    renderScoreboard(container, []);
    assert.match(container.innerHTML, /Nessun risultato disponibile/);
  });

  test('escapes team names and the stage heading', () => {
    const container = element();
    renderScoreboard(container, [{ home: INJECTION, away: 'BETA', score: '1-0', stage: INJECTION }]);
    assert.ok(!container.innerHTML.includes(INJECTION));
    assert.match(container.innerHTML, /&lt;img/);
  });
});

describe('renderPopularPlayersChart', () => {
  const squadre = count =>
    Array.from({ length: count }, (_, i) => ({
      Fantallenatore: `Coach ${i}`,
      Portiere: 'Mario Rossi | ALFA',
      'Titolare 1': 'Luca Bianchi | BETA',
      'Titolare 2': 'Gino Verdi | GAMMA',
      'Titolare 3': 'Ada Neri | DELTA',
      Riserva: 'Ennio Grigi | OMEGA',
    }));

  test('counts how often each player was bought', () => {
    const container = element();
    renderPopularPlayersChart(container, squadre(6));
    assert.match(container.innerHTML, /Mario Rossi/);
    assert.match(container.innerHTML, />6</, 'six teams picked him');
  });

  test('stays hidden until there are enough teams to be interesting', () => {
    const container = element();
    renderPopularPlayersChart(container, squadre(3));
    assert.equal(container.innerHTML, '');
  });

  test('escapes a player name, in the label and in the title attribute', () => {
    const container = element();
    const teams = squadre(6).map(team => ({ ...team, Portiere: `${INJECTION} | ALFA` }));
    renderPopularPlayersChart(container, teams);

    assert.ok(!container.innerHTML.includes(INJECTION));
    assert.doesNotMatch(container.innerHTML, /title="<img/, 'the attribute is not broken out of');
    assert.match(container.innerHTML, /title="&lt;img/);
  });
});

describe('renderAccordion', () => {
  /** Render an accordion into a stub container and hand back its parts. */
  function open(config) {
    const container = element();
    let renders = 0;
    renderAccordion(container, { id: 'a', render: () => { renders += 1; }, ...config });

    const [wrapper] = container.children;
    const [header, body] = wrapper.children;
    return { header, body, renders: () => renders };
  }

  test('starts collapsed and does not render its body', () => {
    const restore = installDocument();
    try {
      const { body, renders } = open({ title: 'Squadre' });
      assert.ok(body.classList.contains('hidden'));
      assert.equal(renders(), 0, 'a collapsed section costs nothing to load');
    } finally {
      restore();
    }
  });

  test('renders its body the first time it is opened, and only once', () => {
    const restore = installDocument();
    try {
      const { header, body, renders } = open({ title: 'Squadre' });

      header.dispatch('click');
      assert.ok(!body.classList.contains('hidden'));
      assert.equal(renders(), 1);

      header.dispatch('click');
      header.dispatch('click');
      assert.equal(renders(), 1, 'reopening reuses what was already built');
    } finally {
      restore();
    }
  });

  test('renders immediately when it starts expanded', () => {
    const restore = installDocument();
    try {
      const { body, renders } = open({ title: 'Classifica', expanded: true });
      assert.ok(!body.classList.contains('hidden'));
      assert.equal(renders(), 1);
    } finally {
      restore();
    }
  });

  test('escapes a section title', () => {
    const restore = installDocument();
    try {
      const { header } = open({ title: INJECTION });
      assert.ok(!header.innerHTML.includes(INJECTION));
      assert.match(header.innerHTML, /&lt;img/);
    } finally {
      restore();
    }
  });
});

describe('renderTabs', () => {
  test('marks the active edition', () => {
    const container = element();
    renderTabs(container, ['2026', '2025'], '2026', () => {});

    assert.match(container.innerHTML, /data-edition="2026"/);
    assert.match(container.innerHTML, /data-edition="2025"/);
    const active = container.innerHTML.split('data-edition="2025"')[0];
    assert.match(active, /bg-green-600 text-white/, 'the current edition is highlighted');
  });
});

const SAMPLE_TEAM = {
  Allenatore: 'Matteo',
  Punteggio: 6,
  rank: 1,
  players: [{
    slot: 'Titolare 1',
    player: 'Andrea Anzelini | GREP',
    name: 'Andrea Anzelini',
    team: 'GREP',
    counted_total: 6,
    premi: 0,
    matches: [{
      column: 'Match 1',
      status: 'in_campo',
      counted: true,
      total: 6,
      chips: [
        { kind: 'goals', label: '2 gol', points: 4 },
        { kind: 'win', label: 'vittoria', points: 2 },
      ],
    }],
  }],
};

describe('renderSquadSheet', () => {
  test('shows the player, the points that count, and why', () => {
    const container = element();
    renderSquadSheet(container, SAMPLE_TEAM);
    assert.match(container.innerHTML, /Andrea Anzelini/);
    assert.match(container.innerHTML, /GREP/);
    assert.match(container.innerHTML, /2 gol/);
    assert.match(container.innerHTML, /vittoria/);
  });

  test('escapes a player name', () => {
    const container = element();
    renderSquadSheet(container, {
      ...SAMPLE_TEAM,
      players: [{ ...SAMPLE_TEAM.players[0], name: INJECTION, team: INJECTION }],
    });
    assert.ok(!container.innerHTML.includes(INJECTION));
    assert.match(container.innerHTML, /&lt;img/);
  });
});

describe('renderClassifica', () => {
  const teams = [
    SAMPLE_TEAM,
    {
      Allenatore: 'Giulia',
      Punteggio: 2,
      rank: 2,
      players: [{
        slot: 'Portiere',
        name: 'Ada Neri',
        team: 'DELTA',
        counted_total: 2,
        premi: 0,
        matches: [],
      }],
    },
  ];

  function installPage({ hash = '', storage = {} } = {}) {
    const previous = {
      location: globalThis.location,
      localStorage: globalThis.localStorage,
      history: globalThis.history,
    };
    globalThis.location = { hash };
    globalThis.localStorage = {
      getItem: key => storage[key] ?? null,
      setItem: (key, value) => { storage[key] = String(value); },
    };
    globalThis.history = { replaceState(_s, _t, url) { globalThis.location.hash = String(url); } };
    return () => {
      globalThis.location = previous.location;
      globalThis.localStorage = previous.localStorage;
      globalThis.history = previous.history;
    };
  }

  test('escapes a fantallenatore name', () => {
    const restore = installPage();
    try {
      const container = element();
      renderClassifica(container, {
        edition: '2026',
        dettaglio: [{ ...SAMPLE_TEAM, Allenatore: INJECTION }],
      });
      assert.ok(!container.innerHTML.includes(INJECTION));
      assert.match(container.innerHTML, /&lt;img/);
    } finally {
      restore();
    }
  });

  test('search hides coaches who do not match', () => {
    const restore = installPage();
    try {
      const container = element();
      renderClassifica(container, { edition: '2026', dettaglio: teams });
      container.querySelector('#classifica-search-2026').dispatch('input', { target: { value: 'giulia' } });

      assert.equal(
        container.querySelector('#coach-wrap-2026-1').classList.contains('hidden'),
        true,
      );
      assert.equal(
        container.querySelector('#coach-wrap-2026-2').classList.contains('hidden'),
        false,
      );
    } finally {
      restore();
    }
  });

  test('a hash opens the matching coach', () => {
    const restore = installPage({ hash: '#2026/Matteo' });
    try {
      const container = element();
      renderClassifica(container, { edition: '2026', dettaglio: teams });
      const sheet = container.querySelector('#coach-sheet-2026-1');
      assert.ok(!sheet.classList.contains('hidden'));
      assert.match(sheet.innerHTML, /Andrea Anzelini/);
      assert.match(sheet.innerHTML, /2 gol/);
    } finally {
      restore();
    }
  });

  test('remembers the last opened coach', () => {
    const storage = { [storageKey('2026')]: 'Giulia' };
    const restore = installPage({ storage });
    try {
      const container = element();
      renderClassifica(container, { edition: '2026', dettaglio: teams });
      const sheet = container.querySelector('#coach-sheet-2026-2');
      assert.ok(!sheet.classList.contains('hidden'));
      assert.match(sheet.innerHTML, /Ada Neri/);
    } finally {
      restore();
    }
  });
});

