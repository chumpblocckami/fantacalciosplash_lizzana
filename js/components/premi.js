import { escapeHtml } from '../html.js';
import { AWARDS, awardLabel, splitPlayerId } from '../awards.js';

/**
 * End-of-tournament prizes for the edition.
 *
 * @param {HTMLElement} container
 * @param {Record<string, string[]>|null|undefined} winners - data/YEAR/premi.json
 */
export function renderPremi(container, winners) {
  container.innerHTML = `
    <div class="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">Premi di fine torneo</h3>
      <ul class="space-y-2">
        ${AWARDS.map(award => renderRow(award, winners?.[award.id] ?? [])).join('')}
      </ul>
    </div>
  `;
}

function renderRow(award, winnerIds) {
  const label = awardLabel(award);
  const winners = winnerIds.map(id => {
    const { name, team } = splitPlayerId(id);
    return team ? `${name} (${team})` : name;
  });

  return `
    <li class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
      <span class="min-w-[7rem] font-medium text-gray-700 dark:text-gray-300">${escapeHtml(label)}</span>
      <span class="flex-1 text-gray-900 dark:text-white">
        ${winners.length
    ? winners.map(name => escapeHtml(name)).join(', ')
    : '<span class="text-gray-400 italic">—</span>'}
      </span>
      <span class="tabular-nums font-semibold text-amber-700 dark:text-amber-300">+${award.points}</span>
    </li>
  `;
}
