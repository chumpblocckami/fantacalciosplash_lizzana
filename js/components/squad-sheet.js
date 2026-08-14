import { escapeHtml } from '../html.js';

const STATUS_LABELS = {
  in_campo: 'in campo',
  panchina: 'panchina',
  non_giocato: 'non giocato',
  eliminato: 'eliminato',
  subentrato: 'subentrato',
};

const CHIP_CLASSES = {
  goals: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  win: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  mvp: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  cleansheet: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  draw: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  conceded: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  malus: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

/**
 * Render one coach's five players, with per-match points and why they scored.
 *
 * @param {HTMLElement} container
 * @param {Object}      team - One entry from dettaglio.json
 */
export function renderSquadSheet(container, team) {
  if (!team?.players?.length) {
    container.innerHTML = '<p class="text-sm text-gray-400 px-3 py-4">Nessun giocatore in rosa.</p>';
    return;
  }

  container.innerHTML = `
    <div class="divide-y divide-gray-100 dark:divide-gray-700">
      ${team.players.map(player => renderPlayer(player)).join('')}
    </div>
  `;
}

function renderPlayer(player) {
  const muted = player.matches?.every(match => match.status === 'panchina');
  const status = summaryStatus(player);
  return `
    <div class="px-3 py-3 ${muted ? 'opacity-60' : ''}">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs uppercase tracking-wide text-gray-400">${escapeHtml(player.slot)}</p>
          <p class="font-medium text-gray-900 dark:text-white truncate">${escapeHtml(player.name)}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(player.team)}</p>
        </div>
        <div class="text-right shrink-0">
          <p class="text-lg font-semibold tabular-nums ${pointsClass(player.counted_total, muted)}">
            ${formatPoints(player.counted_total)}
          </p>
          ${statusBadge(status)}
        </div>
      </div>
      ${player.premi ? `<p class="mt-1 text-xs text-amber-700 dark:text-amber-300">Premi +${formatPoints(player.premi)}</p>` : ''}
      <div class="mt-2 space-y-2">
        ${(player.matches ?? []).map(match => renderMatch(match)).join('')}
      </div>
    </div>
  `;
}

function renderMatch(match) {
  const muted = !match.counted || match.status === 'panchina' || match.status === 'non_giocato';
  return `
    <div class="flex flex-wrap items-center gap-2 text-sm">
      <span class="text-xs text-gray-400 w-16 shrink-0">${escapeHtml(match.column)}</span>
      <span class="tabular-nums font-medium ${pointsClass(match.total, muted)}">${formatPoints(match.total)}</span>
      ${statusBadge(match.status)}
      ${(match.chips ?? []).map(chip => `
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                     ${CHIP_CLASSES[chip.kind] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}">
          ${escapeHtml(chip.label)}
        </span>
      `).join('')}
    </div>
  `;
}

function summaryStatus(player) {
  const statuses = (player.matches ?? []).map(match => match.status);
  if (statuses.includes('subentrato')) return 'subentrato';
  if (statuses.every(status => status === 'panchina')) return 'panchina';
  if (statuses.every(status => status === 'non_giocato')) return 'non_giocato';
  if (statuses.includes('eliminato') && !statuses.includes('in_campo')) return 'eliminato';
  if (statuses.includes('in_campo')) return 'in_campo';
  return statuses[0] || 'in_campo';
}

function statusBadge(status) {
  const label = STATUS_LABELS[status];
  if (!label) return '';
  const tone = status === 'in_campo' || status === 'subentrato'
    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
    : status === 'eliminato'
      ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tone}">${label}</span>`;
}

function formatPoints(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function pointsClass(value, muted) {
  if (muted) return 'text-gray-400 dark:text-gray-500';
  if (value > 0) return 'text-green-600 dark:text-green-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-gray-500';
}
