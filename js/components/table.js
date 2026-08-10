/**
 * Render a sortable, filterable data table.
 *
 * @param {HTMLElement} container - DOM element to render into
 * @param {Object} config
 * @param {string[]} config.columns    - Column headers
 * @param {Array[]}  config.rows       - Array of row arrays
 * @param {string}   [config.id]       - Table ID for state isolation
 * @param {boolean}  [config.sortable] - Enable column sorting (default true)
 * @param {boolean}  [config.searchable] - Enable search bar (default false)
 * @param {string}   [config.emptyMessage] - Message when no data
 */
export function renderTable(container, config) {
  const {
    columns,
    rows,
    id = 'table',
    sortable = true,
    searchable = false,
    emptyMessage = 'Nessun dato disponibile',
  } = config;

  let sortCol = null;
  let sortAsc = true;
  let filterText = '';

  function render() {
    let filtered = rows;
    if (filterText) {
      const q = filterText.toLowerCase();
      filtered = rows.filter(row =>
        row.some(cell => String(cell).toLowerCase().includes(q))
      );
    }

    if (sortCol !== null) {
      filtered = [...filtered].sort((a, b) => {
        const va = a[sortCol];
        const vb = b[sortCol];
        const na = parseFloat(va);
        const nb = parseFloat(vb);
        if (!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na;
        return sortAsc
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va));
      });
    }

    const searchHtml = searchable ? `
      <div class="mb-3">
        <input type="text" id="search-${id}" placeholder="🔍 Cerca..."
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                 focus:ring-2 focus:ring-green-500 focus:border-transparent
                 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          value="${filterText}">
      </div>
    ` : '';

    container.innerHTML = `
      ${searchHtml}
      <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full text-sm">
          <thead class="bg-green-600 text-white">
            <tr>
              <th class="px-3 py-2 text-left font-semibold text-xs">#</th>
              ${columns.map((col, i) => `
                <th class="px-3 py-2 text-left font-semibold text-xs ${sortable ? 'cursor-pointer hover:bg-green-700' : ''}"
                    data-col="${i}">
                  ${col}
                  ${sortCol === i ? (sortAsc ? ' ▲' : ' ▼') : ''}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            ${filtered.length === 0 ? `
              <tr><td colspan="${columns.length + 1}" class="px-3 py-8 text-center text-gray-400">${emptyMessage}</td></tr>
            ` : filtered.map((row, ri) => `
              <tr class="${ri % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}
                         hover:bg-green-50 dark:hover:bg-gray-700 transition-colors">
                <td class="px-3 py-2 text-gray-400 text-xs">${ri + 1}</td>
                ${row.map((cell, ci) => `
                  <td class="px-3 py-2 ${ci === 0 ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}
                             ${typeof cell === 'number' ? 'text-right tabular-nums' : ''}">
                    ${formatCell(cell)}
                  </td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p class="text-xs text-gray-400 mt-2">${filtered.length} righe${filterText ? ' (filtrate)' : ''}</p>
    `;

    // Bind events
    if (sortable) {
      container.querySelectorAll('th[data-col]').forEach(th => {
        th.addEventListener('click', () => {
          const col = parseInt(th.dataset.col);
          if (sortCol === col) { sortAsc = !sortAsc; }
          else { sortCol = col; sortAsc = true; }
          render();
        });
      });
    }

    if (searchable) {
      const searchInput = container.querySelector(`#search-${id}`);
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          filterText = e.target.value;
          render();
          // Restore cursor position
          searchInput.focus();
        });
      }
    }
  }

  render();
}

function formatCell(value) {
  if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) {
    return '<span class="text-gray-300">—</span>';
  }
  if (typeof value === 'number') {
    return value % 1 === 0 ? value.toString() : value.toFixed(1);
  }
  return String(value);
}
