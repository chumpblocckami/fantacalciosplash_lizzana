/**
 * Render edition tabs (2025, 2024, 2023, ...).
 *
 * @param {HTMLElement} container - DOM element for tab bar
 * @param {string[]}    editions  - Array of edition years
 * @param {string}      active    - Currently active edition
 * @param {Function}    onChange  - Called with new edition string
 */
export function renderTabs(container, editions, active, onChange) {
  container.innerHTML = `
    <div class="flex gap-1 border-b border-gray-200 dark:border-gray-700">
      ${editions.map(ed => `
        <button data-edition="${ed}"
          class="px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors
                 ${ed === active
                   ? 'bg-green-600 text-white border-b-2 border-green-600'
                   : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}">
          ${ed}
        </button>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('button[data-edition]').forEach(btn => {
    btn.addEventListener('click', () => onChange(btn.dataset.edition));
  });
}
