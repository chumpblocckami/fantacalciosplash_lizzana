import { BUDGET, REGISTRATION_ENDPOINT, DEADLINE } from './constants.js';

/**
 * Check if registrations are currently open.
 */
export function isRegistrationOpen() {
  const now = new Date();
  return now < DEADLINE;
}

/**
 * Compute remaining budget after selecting players.
 *
 * @param {string[]} selectedPlayers - Array of "Name | Team" strings
 * @param {Object[]} giocatori      - Full player list with Quotazione
 * @returns {number} Remaining budget
 */
export function computeBudget(selectedPlayers, giocatori) {
  let spent = 0;
  for (const selected of selectedPlayers) {
    const playerName = selected.split('|')[0].trim();
    const entry = giocatori.find(
      g => g.Nominativo.toLowerCase().trim() === playerName.toLowerCase().trim()
    );
    if (entry) spent += parseFloat(entry.Quotazione) || 0;
  }
  return BUDGET - spent;
}

/**
 * Validate a fantasy team submission.
 *
 * @param {string} coach      - Coach name
 * @param {string} goalkeeper - "Name | Team"
 * @param {string[]} starters - Array of 3 "Name | Team"
 * @param {string} reserve    - "Name | Team"
 * @param {number} budget     - Remaining budget
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validate(coach, goalkeeper, starters, reserve, budget) {
  const errors = [];

  // A half-filled form is the normal state while someone is still choosing, and the third
  // dropdown can be picked before the first, so the starters may arrive with gaps in them.
  const chosen = (starters ?? []).filter(Boolean);

  if (!coach || !coach.trim()) {
    errors.push('Inserire il nome del fantallenatore!');
  }

  if (!goalkeeper) {
    errors.push('Seleziona un portiere!');
  }

  if (chosen.length !== 3) {
    errors.push('Seleziona esattamente 3 giocatori titolari!');
  }

  if (!reserve) {
    errors.push('Seleziona una riserva!');
  }

  // No two movement players from the same real team. The goalkeeper is exempt: the
  // regolamento allows a keeper and a movement player from the same side.
  const movement = [...chosen, reserve].filter(Boolean);
  const teams = movement.map(p => p.split('|')[1]?.trim().toUpperCase());
  if (new Set(teams).size < teams.length) {
    errors.push('Non puoi convocare due giocatori di movimento della stessa squadra!');
  }

  if (reserve && chosen.includes(reserve)) {
    errors.push('Un giocatore non può essere sia titolare che riserva!');
  }

  if (budget < 0) {
    errors.push('Il budget non può essere minore di zero!');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Submit a team registration to Google Sheets via Apps Script.
 *
 * @param {Object} teamData - { coach, goalkeeper, starters, reserve }
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function submitTeam(teamData) {
  if (!REGISTRATION_ENDPOINT) {
    return {
      success: false,
      message: 'Endpoint di registrazione non configurato. Contatta gli organizzatori.',
    };
  }

  try {
    // Sent as text/plain on purpose: an application/json body would trigger a CORS
    // preflight, and Google Apps Script web apps cannot answer OPTIONS requests.
    const resp = await fetch(REGISTRATION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        coach: teamData.coach,
        goalkeeper: teamData.goalkeeper,
        starters: teamData.starters,
        reserve: teamData.reserve,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return { success: true, message: 'Fantasquadra iscritta! 🎉' };
  } catch (err) {
    return { success: false, message: `Errore durante l'iscrizione: ${err.message}` };
  }
}
