import { escapeHtml } from '../html.js';
import { renderSquadSheet } from './squad-sheet.js';
import { renderPremi } from './premi.js';
import { parseTeamHash, formatTeamHash, storageKey } from '../team-hash.js';

/**
 * Searchable ranked list. Tapping a coach expands their squad sheet in place.
 *
 * @param {HTMLElement} container
 * @param {Object}      config
 * @param {string}      config.edition
 * @param {Object[]}    config.dettaglio - data/YEAR/dettaglio.json
 * @param {Object|null} [config.premi] - data/YEAR/premi.json
 */
export function renderClassifica(container, { edition, dettaglio, premi }) {
  const teams = dettaglio ?? [];
  const open = new Set();
  const loaded = new Set();

  container.innerHTML = `
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Classifica</h2>
    <div class="mb-3">
      <input type="search" id="classifica-search-${edition}" placeholder="Trova la tua squadra…"
        autocomplete="off"
        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
               focus:ring-2 focus:ring-green-500 focus:border-transparent
               dark:bg-gray-700 dark:border-gray-600 dark:text-white">
    </div>
    <div id="classifica-list-${edition}" class="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
      ${teams.map(team => renderRow(edition, team)).join('')}
    </div>
    <p class="text-xs text-gray-400 mt-2">${teams.length} squadre</p>
    <div id="premi-panel-${edition}" class="mt-4"></div>
  `;

  renderPremi(container.querySelector(`#premi-panel-${edition}`), premi);

  for (const team of teams) {
    const toggle = container.querySelector(`#coach-toggle-${edition}-${team.rank}`);
    toggle.addEventListener('click', () => {
      const willOpen = !open.has(team.rank);
      closeAll();
      if (willOpen) openSheet(team);
    });
  }

  const search = container.querySelector(`#classifica-search-${edition}`);
  search.addEventListener('input', (event) => {
    const query = String(event.target.value || '').toLowerCase().trim();
    for (const team of teams) {
      const wrap = container.querySelector(`#coach-wrap-${edition}-${team.rank}`);
      const hit = !query || team.Allenatore.toLowerCase().includes(query);
      wrap.classList.toggle('hidden', !hit);
    }
  });

  const initial = resolveInitial(edition, teams);
  if (initial) openSheet(initial);

  function closeAll() {
    for (const rank of [...open]) {
      const sheet = container.querySelector(`#coach-sheet-${edition}-${rank}`);
      sheet.classList.add('hidden');
      open.delete(rank);
    }
  }

  function openSheet(team) {
    const sheet = container.querySelector(`#coach-sheet-${edition}-${team.rank}`);
    sheet.classList.remove('hidden');
    if (!loaded.has(team.rank)) {
      renderSquadSheet(sheet, team);
      loaded.add(team.rank);
    }
    open.add(team.rank);
    remember(edition, team.Allenatore);
    writeHash(edition, team.Allenatore);
  }
}

function renderRow(edition, team) {
  return `
    <div id="coach-wrap-${edition}-${team.rank}" class="bg-white dark:bg-gray-800">
      <button type="button" id="coach-toggle-${edition}-${team.rank}"
        class="w-full flex items-center gap-3 px-4 py-3 text-left
               hover:bg-green-50 dark:hover:bg-gray-700 transition-colors">
        <span class="w-8 text-sm text-gray-400 tabular-nums">${team.rank}</span>
        <span class="flex-1 font-medium text-gray-900 dark:text-white truncate">${escapeHtml(team.Allenatore)}</span>
        <span class="text-lg font-semibold tabular-nums ${pointsClass(team.Punteggio)}">${formatPoints(team.Punteggio)}</span>
      </button>
      <div id="coach-sheet-${edition}-${team.rank}"
           class="hidden border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40"></div>
    </div>
  `;
}

function resolveInitial(edition, teams) {
  const fromHash = parseTeamHash(currentHash());
  if (fromHash?.edition === edition && fromHash.coach) {
    const match = findCoach(teams, fromHash.coach);
    if (match) return match;
  }
  const stored = readMemory(edition);
  return stored ? findCoach(teams, stored) : null;
}

function findCoach(teams, name) {
  const needle = String(name).toLowerCase().trim();
  return teams.find(team => team.Allenatore.toLowerCase().trim() === needle) ?? null;
}

function currentHash() {
  try { return globalThis.location?.hash ?? ''; } catch { return ''; }
}

function writeHash(edition, coach) {
  const hash = formatTeamHash(edition, coach);
  try {
    if (globalThis.history?.replaceState) {
      globalThis.history.replaceState(null, '', hash);
    } else if (globalThis.location) {
      globalThis.location.hash = hash.slice(1);
    }
  } catch { /* node tests, or a file:// page without a history */ }
}

function remember(edition, coach) {
  try { globalThis.localStorage?.setItem(storageKey(edition), coach); } catch { /* private mode */ }
}

function readMemory(edition) {
  try { return globalThis.localStorage?.getItem(storageKey(edition)); } catch { return null; }
}

function formatPoints(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function pointsClass(value) {
  if (value > 0) return 'text-green-600 dark:text-green-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-gray-500';
}
