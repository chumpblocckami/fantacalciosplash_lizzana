/**
 * Render an accordion (collapsible section).
 *
 * @param {HTMLElement} container - DOM element to render into
 * @param {Object}      config
 * @param {string}      config.title     - Section title
 * @param {boolean}     [config.expanded] - Initially expanded (default false)
 * @param {Function}    config.render    - Called with inner container when expanded
 * @param {string}      [config.id]      - Unique id
 */
export function renderAccordion(container, config) {
  const { title, expanded = false, render: renderContent, id = '' } = config;

  const wrapper = document.createElement('div');
  wrapper.className = 'border border-gray-200 dark:border-gray-700 rounded-lg mb-3 overflow-hidden';

  const header = document.createElement('button');
  header.className = `w-full flex items-center justify-between px-4 py-3
                      bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750
                      text-left text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors`;
  header.innerHTML = `
    <span>${title}</span>
    <svg class="w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}" id="chevron-${id}"
         fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
    </svg>
  `;

  const body = document.createElement('div');
  body.className = `px-4 py-4 ${expanded ? '' : 'hidden'}`;
  body.id = `accordion-body-${id}`;

  let loaded = false;

  header.addEventListener('click', () => {
    const isOpen = !body.classList.contains('hidden');
    body.classList.toggle('hidden');
    const chevron = wrapper.querySelector(`#chevron-${id}`);
    if (chevron) chevron.classList.toggle('rotate-180');

    if (!isOpen && !loaded) {
      loaded = true;
      renderContent(body);
    }
  });

  wrapper.appendChild(header);
  wrapper.appendChild(body);
  container.appendChild(wrapper);

  if (expanded) {
    loaded = true;
    renderContent(body);
  }
}
