import { escapeHtml } from '../html.js';

/**
 * Render match results as a scoreboard grid.
 *
 * @param {HTMLElement} container - DOM element to render into
 * @param {Object[]}    matches   - Array of {home, away, score, stage, live?, closed?}
 */
export function renderScoreboard(container, matches) {
  if (!matches || matches.length === 0) {
    container.innerHTML = `
      <p class="text-gray-400 text-center py-8">Nessun risultato disponibile</p>
    `;
    return;
  }

  // Group by stage
  const stages = {};
  for (const match of matches) {
    const stage = match.stage || 'Girone';
    if (!stages[stage]) stages[stage] = [];
    stages[stage].push(match);
  }

  container.innerHTML = Object.entries(stages).map(([stage, stageMatches]) => `
    <div class="mb-6">
      <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        ${escapeHtml(stage)}
      </h4>
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        ${stageMatches.map(m => renderMatchCard(m)).join('')}
      </div>
    </div>
  `).join('');
}

function renderMatchCard(match) {
  const [homeScore, awayScore] = (match.score || '0-0').split('-').map(Number);
  const isLive = match.live === true;
  const isClosed = match.closed === true;

  const statusBadge = isLive
    ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 animate-pulse">● LIVE</span>'
    : isClosed
      ? '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">FT</span>'
      : '';

  const homeWin = homeScore > awayScore;
  const awayWin = awayScore > homeScore;

  return `
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700
                p-3 hover:shadow-md transition-shadow ${isLive ? 'ring-2 ring-red-400' : ''}">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-gray-400">${escapeHtml(match.stage || '')}</span>
        ${statusBadge}
      </div>
      <div class="flex items-center justify-between gap-2">
        <div class="flex-1 text-right">
          <span class="text-sm ${homeWin ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}">
            ${escapeHtml(match.home)}
          </span>
        </div>
        <div class="flex-shrink-0 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded font-mono font-bold text-lg">
          <span class="${homeWin ? 'text-green-600' : 'text-gray-700 dark:text-gray-300'}">${homeScore}</span>
          <span class="text-gray-400 mx-1">-</span>
          <span class="${awayWin ? 'text-green-600' : 'text-gray-700 dark:text-gray-300'}">${awayScore}</span>
        </div>
        <div class="flex-1 text-left">
          <span class="text-sm ${awayWin ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}">
            ${escapeHtml(match.away)}
          </span>
        </div>
      </div>
    </div>
  `;
}
