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

  function render() {
    const allSelected = [state.goalkeeper, ...state.starters, state.reserve].filter(Boolean);
    state.budget = computeBudget(allSelected, giocatori);
    const { valid, errors } = validate(state.coach, state.goalkeeper, state.starters, state.reserve, state.budget);

    const deadlineStr = DEADLINE.toLocaleDateString('it-IT', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    container.innerHTML = `
      <div class="max-w-2xl mx-auto space-y-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Le iscrizioni chiuderanno il <strong>${deadlineStr}</strong>
        </p>

        <!-- Budget -->
        <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Budget rimanente</span>
          <span class="text-2xl font-bold ${state.budget < 0 ? 'text-red-500' : 'text-green-600'}">
            ${state.budget}
          </span>
        </div>

        <!-- Coach name -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nominativo (Fantallenatore)
          </label>
          <input type="text" id="reg-coach" value="${escapeHtml(state.coach)}"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                   focus:ring-2 focus:ring-green-500 focus:border-transparent
                   dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Il tuo nome e cognome">
        </div>

        <!-- Goalkeeper -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Portiere (1)
          </label>
          <select id="reg-goalkeeper"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                   focus:ring-2 focus:ring-green-500 focus:border-transparent
                   dark:bg-gray-700 dark:border-gray-600 dark:text-white">
            <option value="">-- Scegli un portiere --</option>
            ${portieri.map(p => `
              <option value="${escapeHtml(p.label)}" ${state.goalkeeper === p.label ? 'selected' : ''}>
                ${p.label} (${p.cost} cr.)
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Starters -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Titolari di movimento (3)
          </label>
          ${[0, 1, 2].map(i => `
            <select id="reg-starter-${i}" class="w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg text-sm
                     focus:ring-2 focus:ring-green-500 focus:border-transparent
                     dark:bg-gray-700 dark:border-gray-600 dark:text-white">
              <option value="">-- Titolare ${i + 1} --</option>
              ${movimento.map(p => `
                <option value="${escapeHtml(p.label)}" ${state.starters[i] === p.label ? 'selected' : ''}>
                  ${p.label} (${p.cost} cr.)
                </option>
              `).join('')}
            </select>
          `).join('')}
        </div>

        <!-- Reserve -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Riserva (1)
          </label>
          <select id="reg-reserve"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                   focus:ring-2 focus:ring-green-500 focus:border-transparent
                   dark:bg-gray-700 dark:border-gray-600 dark:text-white">
            <option value="">-- Scegli riserva --</option>
            ${movimento.map(p => `
              <option value="${escapeHtml(p.label)}" ${state.reserve === p.label ? 'selected' : ''}>
                ${p.label} (${p.cost} cr.)
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Errors -->
        ${errors.length > 0 ? `
          <div class="space-y-1">
            ${errors.map(e => `
              <p class="text-sm text-red-500 flex items-center gap-1">
                <span>⚠️</span> ${e}
              </p>
            `).join('')}
          </div>
        ` : ''}

        <!-- Submit -->
        <button id="reg-submit" ${valid ? '' : 'disabled'}
          class="w-full py-3 px-4 rounded-lg font-medium text-white transition-colors
                 ${valid
                   ? 'bg-green-600 hover:bg-green-700 cursor-pointer'
                   : 'bg-gray-300 cursor-not-allowed dark:bg-gray-600'}">
          Iscrivi squadra ⚽
        </button>

        <div id="reg-message"></div>
      </div>
    `;

    // Bind events
    const coachInput = container.querySelector('#reg-coach');
    coachInput.addEventListener('input', e => { state.coach = e.target.value; render(); });

    container.querySelector('#reg-goalkeeper').addEventListener('change', e => {
      state.goalkeeper = e.target.value; render();
    });

    [0, 1, 2].forEach(i => {
      container.querySelector(`#reg-starter-${i}`).addEventListener('change', e => {
        state.starters[i] = e.target.value; render();
      });
    });

    container.querySelector('#reg-reserve').addEventListener('change', e => {
      state.reserve = e.target.value; render();
    });

    const submitBtn = container.querySelector('#reg-submit');
    if (submitBtn && valid) {
      submitBtn.addEventListener('click', async () => {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Invio in corso...';
        const result = await submitTeam(state);
        const msgEl = container.querySelector('#reg-message');
        msgEl.innerHTML = `
          <p class="text-sm ${result.success ? 'text-green-600' : 'text-red-500'} mt-2">
            ${result.message}
          </p>
        `;
        if (result.success) {
          submitBtn.textContent = '✅ Iscritto!';
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Iscrivi squadra ⚽';
        }
      });
    }

    // Restore focus on coach input
    coachInput.setSelectionRange(state.coach.length, state.coach.length);
  }

  render();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
