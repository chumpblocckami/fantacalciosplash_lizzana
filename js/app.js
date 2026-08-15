import { CURRENT_YEAR } from './constants.js';
import { loadEditions, loadEditionData, loadRegistrationCount } from './api.js';
import { renderTabs } from './components/tabs.js';
import { renderTable } from './components/table.js';
import { renderAccordion } from './components/accordion.js';
import { renderScoreboard } from './components/scoreboard.js';
import { renderPopularPlayersChart } from './components/chart.js';
import { renderRegistrationForm } from './components/registration-form.js';
import { renderClassifica } from './components/classifica.js';
import { parseTeamHash, formatTeamHash } from './team-hash.js';

const cache = {};

async function main() {
  const editions = await loadEditions() || [CURRENT_YEAR];
  const hashed = parseTeamHash(typeof location !== 'undefined' ? location.hash : '');
  let activeEdition = hashed && editions.includes(hashed.edition) ? hashed.edition : editions[0];

  const tabsContainer = document.getElementById('tabs');
  const contentContainer = document.getElementById('content');

  function renderEditionTabs() {
    renderTabs(tabsContainer, editions, activeEdition, async (edition) => {
      activeEdition = edition;
      writeEditionHash(edition);
      renderEditionTabs();
      await renderEditionContent(edition);
    });
  }

  async function renderEditionContent(edition) {
    contentContainer.innerHTML = `
      <div class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span class="ml-3 text-gray-500">Caricamento...</span>
      </div>
    `;

    if (!cache[edition]) {
      cache[edition] = await loadEditionData(edition);
    }
    const data = cache[edition];

    contentContainer.innerHTML = '';

    renderRegolamentoButton(contentContainer, edition);

    const isCurrentEdition = edition === CURRENT_YEAR;
    const hasSheet = Array.isArray(data.dettaglio) && data.dettaglio.length > 0;

    if (hasSheet) {
      const classificaDiv = document.createElement('div');
      classificaDiv.className = 'mb-6';
      contentContainer.appendChild(classificaDiv);
      renderClassifica(classificaDiv, { edition, dettaglio: data.dettaglio });
    }

    const extras = [];
    collectLegacySections(extras, edition, data, isCurrentEdition, hasSheet);
    if (isCurrentEdition && !data.squadre?.length) {
      renderRegistrationCount(contentContainer);
    }
    if (extras.length) {
      if (hasSheet) {
        const divider = document.createElement('hr');
        divider.className = 'border-0 border-t border-gray-200 dark:border-gray-700 mt-8 mb-6';
        contentContainer.appendChild(divider);
      }
      extras.forEach(section => renderAccordion(contentContainer, section));
    }
  }

  renderEditionTabs();
  await renderEditionContent(activeEdition);

  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', async () => {
      const next = parseTeamHash(location.hash);
      if (!next || !editions.includes(next.edition)) return;
      if (next.edition !== activeEdition) {
        activeEdition = next.edition;
        renderEditionTabs();
      }
      await renderEditionContent(next.edition);
    });
  }
}

/**
 * The tables that used to be the whole page: registration, prices, lineups, results,
 * player points, and the two-column classifica for editions that have no squad sheet.
 */
function collectLegacySections(extras, edition, data, isCurrentEdition, hasSheet) {
  if (isCurrentEdition && data.giocatori?.length) {
    extras.push({
      title: 'Iscrivi una squadra 🤼‍♂️',
      id: `reg-${edition}`,
      expanded: false,
      render: (body) => renderRegistrationForm(body, data.giocatori),
    });
  }

  if (data.giocatori?.length) {
    extras.push({
      title: 'Quotazione giocatori 💰',
      id: `giocatori-${edition}`,
      expanded: false,
      render: (body) => {
        renderDownloadButton(body, data.giocatori, `${edition}_giocatori.csv`, 'Scarica CSV ⏬');
        const tableDiv = document.createElement('div');
        tableDiv.className = 'mt-3';
        body.appendChild(tableDiv);
        renderTable(tableDiv, {
          id: `giocatori-table-${edition}`,
          columns: ['Nominativo', 'Squadra', 'Soprannome', 'Quotazione', 'Ruolo'],
          rows: data.giocatori.map(g => [g.Nominativo, g.Squadra, g.Soprannome, g.Quotazione, g.Ruolo]),
          searchable: true,
        });
      },
    });
  }

  if (data.squadre?.length) {
    extras.push({
      title: `Squadre iscritte 👯‍♀️ (${data.squadre.length})`,
      id: `squadre-${edition}`,
      expanded: false,
      render: (body) => {
        const cols = Object.keys(data.squadre[0] || {});
        renderTable(body, {
          id: `squadre-table-${edition}`,
          columns: cols,
          rows: data.squadre.map(s => cols.map(c => s[c])),
          searchable: true,
        });

        if (data.squadre.length > 5) {
          const chartDiv = document.createElement('div');
          chartDiv.className = 'mt-6';
          const chartTitle = document.createElement('h4');
          chartTitle.className = 'text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3';
          chartTitle.textContent = 'Giocatori più acquistati 📊';
          body.appendChild(chartTitle);
          body.appendChild(chartDiv);
          renderPopularPlayersChart(chartDiv, data.squadre);
        }
      },
    });
  }

  if (data.risultati?.length) {
    extras.push({
      title: `Risultati ⚽ (${data.risultati.length} partite)`,
      id: `risultati-${edition}`,
      expanded: isCurrentEdition,
      render: (body) => renderScoreboard(body, data.risultati),
    });
  }

  if (data.punteggi?.length) {
    extras.push({
      title: 'Punteggi giocatore 🍿',
      id: `punteggi-${edition}`,
      expanded: false,
      render: (body) => {
        renderDownloadButton(body, data.punteggi, `${edition}_punteggi.csv`, 'Scarica CSV ⏬');
        const tableDiv = document.createElement('div');
        tableDiv.className = 'mt-3';
        body.appendChild(tableDiv);
        const cols = Object.keys(data.punteggi[0]);
        renderTable(tableDiv, {
          id: `punteggi-table-${edition}`,
          columns: cols,
          rows: data.punteggi.map(p => cols.map(c => p[c])),
          searchable: true,
        });
      },
    });
  }

  if (!hasSheet && data.classifica?.length) {
    extras.push({
      title: 'Classifica 🏆',
      id: `classifica-${edition}`,
      expanded: !isCurrentEdition,
      render: (body) => {
        const cols = getClassificaColumns(data.classifica[0]);
        renderTable(body, {
          id: `classifica-table-${edition}`,
          columns: cols,
          rows: data.classifica.map(c => cols.map(col => c[col])),
          searchable: true,
        });
      },
    });
  }
}

function writeEditionHash(edition) {
  try {
    const hash = formatTeamHash(edition);
    if (globalThis.history?.replaceState) globalThis.history.replaceState(null, '', hash);
  } catch { /* ignore */ }
}

// ===== HELPERS =====

/**
 * Show a running count of registered teams, styled like a collapsed accordion header.
 *
 * The count is fetched rather than read from data/, so the box is appended immediately to keep
 * the section order and filled in when the answer arrives. If the backend is unreachable a short
 * notice is shown instead of a zero that would read as "nobody signed up".
 */
function renderRegistrationCount(container) {
  const box = document.createElement('div');
  box.className = `border border-gray-200 dark:border-gray-700 rounded-lg mb-3
                   bg-gray-50 dark:bg-gray-800 px-4 py-3
                   text-sm font-medium text-gray-700 dark:text-gray-200`;
  box.textContent = 'Fantasquadre iscritte: ...';
  container.appendChild(box);

  loadRegistrationCount().then((count) => {
    if (count === null) {
      box.textContent = 'Fantasquadre iscritte: non disponibile';
      box.classList.add('text-gray-500', 'dark:text-gray-400');
      return;
    }
    box.textContent = `Fantasquadre iscritte: ${count}`;
  });
}

/**
 * Offer the regolamento, but only for editions that actually have one.
 *
 * assets/2023/ has no regolamento.pdf, and there is no manifest to consult, so the file is
 * asked for and the button dropped if it is not there. Appending first and removing later
 * keeps the section order stable while the request is in flight.
 */
function renderRegolamentoButton(container, edition) {
  const href = `./assets/${edition}/regolamento.pdf`;

  const btn = document.createElement('a');
  btn.href = href;
  btn.download = `${edition}_regolamento.pdf`;
  btn.className = `inline-flex items-center gap-2 px-4 py-2 mb-4 text-sm font-medium
                    text-green-700 bg-green-50 border border-green-200 rounded-lg
                    hover:bg-green-100 transition-colors
                    dark:text-green-400 dark:bg-green-900/20 dark:border-green-800`;
  btn.innerHTML = `📋 Regolamento ${edition}`;
  container.appendChild(btn);

  fetch(href, { method: 'HEAD' })
    .then(resp => { if (!resp.ok) btn.remove(); })
    .catch(() => btn.remove());
}

function renderDownloadButton(container, data, filename, label) {
  const btn = document.createElement('button');
  btn.className = `inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium
                    text-gray-600 bg-gray-100 border border-gray-200 rounded-lg
                    hover:bg-gray-200 transition-colors
                    dark:text-gray-300 dark:bg-gray-700 dark:border-gray-600`;
  btn.textContent = label;
  btn.addEventListener('click', () => downloadCsv(data, filename));
  container.appendChild(btn);
}

function downloadCsv(data, filename) {
  if (!data || data.length === 0) return;
  const keys = Object.keys(data[0]);
  const csv = [
    keys.join(','),
    ...data.map(row => keys.map(k => {
      const v = row[k];
      if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v ?? '';
    }).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getClassificaColumns(row) {
  if (!row) return [];
  return Object.keys(row).filter(k => k !== 'Unnamed: 0');
}

// Boot
document.addEventListener('DOMContentLoaded', main);
