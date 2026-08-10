import { BUDGET, DEADLINE } from '../constants.js';
import { computeBudget, validate, submitTeam, isRegistrationOpen } from '../registration.js';

/**
 * Render the team registration form.
 *
 * @param {HTMLElement} container  - DOM element to render into
 * @param {Object[]}    giocatori - Player list with Quotazione, Ruolo, Squadra
 */
export function renderRegistrationForm(container, giocatori) {
  if (!isRegistrationOpen()) {
    container.innerHTML = `
      <div class="text-center py-6">
        <p class="text-gray-500 dark:text-gray-400">
          ⏰ Iscrizioni chiuse! Ci vediamo sul gonfiabile 🏊
        </p>
      </div>
    `;
    return;
  }

  const portieri = giocatori
    .filter(g => g.Ruolo === 'Portiere')
    .map(g => ({ label: `${g.Nominativo} | ${g.Squadra}`, cost: g.Quotazione }));

  const movimento = giocatori
    .filter(g => g.Ruolo === 'Movimento')
    .map(g => ({ label: `${g.Nominativo} | ${g.Squadra}`, cost: g.Quotazione }));

  const state = {
    coach: '',
    goalkeeper: '',
    starters: [],
    reserve: '',
    budget: BUDGET,
  };

  const deadlineStr = DEADLINE.toLocaleDateString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const options = players => players.map(p => `
    <option value="${escapeHtml(p.label)}">${p.label} (${p.cost} cr.)</option>
  `).join('');

  const SELECT_CLASS = `w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
    focus:ring-2 focus:ring-green-500 focus:border-transparent
    dark:bg-gray-700 dark:border-gray-600 dark:text-white`;

  // The form is built once. Typing or picking a player only updates the budget, the errors
  // and the submit button, so no field is ever replaced and focus stays where the user put it.
  container.innerHTML = `
    <div class="max-w-2xl mx-auto space-y-4">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Le iscrizioni chiuderanno il <strong>${deadlineStr}</strong>
      </p>

      <!-- Budget -->
      <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Budget rimanente</span>
        <span id="reg-budget" class="text-2xl font-bold text-green-600">${BUDGET}</span>
      </div>

      <!-- Coach name -->
      <div>
        <label for="reg-coach" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Nominativo (Fantallenatore)
        </label>
        <input type="text" id="reg-coach"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                 focus:ring-2 focus:ring-green-500 focus:border-transparent
                 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="Il tuo nome e cognome">
      </div>

      <!-- Goalkeeper -->
      <div>
        <label for="reg-goalkeeper" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Portiere (1)
        </label>
        <select id="reg-goalkeeper" class="${SELECT_CLASS}">
          <option value="">-- Scegli un portiere --</option>
          ${options(portieri)}
        </select>
      </div>

      <!-- Starters -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Titolari di movimento (3)
        </label>
        ${[0, 1, 2].map(i => `
          <select id="reg-starter-${i}" class="${SELECT_CLASS} mb-2">
            <option value="">-- Titolare ${i + 1} --</option>
            ${options(movimento)}
          </select>
        `).join('')}
      </div>

      <!-- Reserve -->
      <div>
        <label for="reg-reserve" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Riserva (1)
        </label>
        <select id="reg-reserve" class="${SELECT_CLASS}">
          <option value="">-- Scegli riserva --</option>
          ${options(movimento)}
        </select>
      </div>

      <div id="reg-errors" class="space-y-1"></div>

      <button id="reg-submit" disabled
        class="w-full py-3 px-4 rounded-lg font-medium text-white transition-colors">
        Iscrivi squadra ⚽
      </button>

      <div id="reg-message"></div>
    </div>
  `;

  const coachInput = container.querySelector('#reg-coach');
  const budgetEl = container.querySelector('#reg-budget');
  const errorsEl = container.querySelector('#reg-errors');
  const submitBtn = container.querySelector('#reg-submit');
  const messageEl = container.querySelector('#reg-message');

  let valid = false;
  let submitted = false;

  function update() {
    const allSelected = [state.goalkeeper, ...state.starters, state.reserve].filter(Boolean);
    state.budget = computeBudget(allSelected, giocatori);

    const result = validate(state.coach, state.goalkeeper, state.starters, state.reserve, state.budget);
    valid = result.valid;

    budgetEl.textContent = state.budget;
    budgetEl.className = `text-2xl font-bold ${state.budget < 0 ? 'text-red-500' : 'text-green-600'}`;

    errorsEl.innerHTML = result.errors.map(e => `
      <p class="text-sm text-red-500 flex items-center gap-1"><span>⚠️</span> ${e}</p>
    `).join('');

    submitBtn.disabled = !valid || submitted;
    submitBtn.className = `w-full py-3 px-4 rounded-lg font-medium text-white transition-colors
      ${valid && !submitted
        ? 'bg-green-600 hover:bg-green-700 cursor-pointer'
        : 'bg-gray-300 cursor-not-allowed dark:bg-gray-600'}`;
  }

  coachInput.addEventListener('input', e => { state.coach = e.target.value; update(); });

  container.querySelector('#reg-goalkeeper').addEventListener('change', e => {
    state.goalkeeper = e.target.value; update();
  });

  [0, 1, 2].forEach(i => {
    container.querySelector(`#reg-starter-${i}`).addEventListener('change', e => {
      state.starters[i] = e.target.value; update();
    });
  });

  container.querySelector('#reg-reserve').addEventListener('change', e => {
    state.reserve = e.target.value; update();
  });

  submitBtn.addEventListener('click', async () => {
    if (!valid || submitted) return;
    submitted = true;
    update();
    submitBtn.textContent = 'Invio in corso...';

    const result = await submitTeam(state);
    messageEl.innerHTML = `
      <p class="text-sm ${result.success ? 'text-green-600' : 'text-red-500'} mt-2">
        ${result.message}
      </p>
    `;

    if (result.success) {
      submitBtn.textContent = '✅ Iscritto!';
    } else {
      submitted = false;
      submitBtn.textContent = 'Iscrivi squadra ⚽';
      update();
    }
  });

  update();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
