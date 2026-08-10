/**
 * Render a horizontal bar chart showing most-bought players.
 *
 * @param {HTMLElement} container - DOM element to render into
 * @param {Object[]}    squadre   - Array of team objects with player columns
 */
export function renderPopularPlayersChart(container, squadre) {
  if (!squadre || squadre.length < 5) {
    container.innerHTML = '';
    return;
  }

  // Count player purchases across all teams
  const counts = {};
  for (const team of squadre) {
    const players = [
      team['Titolare 1'] || team['titolare 1'],
      team['Titolare 2'] || team['titolare 2'],
      team['Titolare 3'] || team['titolare 3'],
      team.Riserva || team.riserva,
      team.Portiere || team.portiere,
    ].filter(Boolean);

    for (const p of players) {
      const name = p.split('|')[0].trim();
      counts[name] = (counts[name] || 0) + 1;
    }
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  if (sorted.length === 0) {
    container.innerHTML = '';
    return;
  }

  const maxCount = sorted[0][1];

  container.innerHTML = `
    <div class="space-y-2">
      ${sorted.map(([name, count]) => {
        const pct = (count / maxCount) * 100;
        return `
          <div class="flex items-center gap-3">
            <span class="text-xs text-gray-600 dark:text-gray-300 w-40 truncate text-right" title="${name}">
              ${name}
            </span>
            <div class="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-5 overflow-hidden">
              <div class="bg-green-500 h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                   style="width: ${Math.max(pct, 8)}%">
                <span class="text-xs text-white font-medium">${count}</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
