import { REGISTRATION_ENDPOINT } from './constants.js';

const BASE_DATA_PATH = './data';

/**
 * Fetch JSON from a local path (data/ directory in the repo).
 */
async function fetchLocal(path) {
  const resp = await fetch(path);
  if (!resp.ok) return null;
  return resp.json();
}

// ===== PUBLIC DATA LOADERS =====

export async function loadEditions() {
  return fetchLocal(`${BASE_DATA_PATH}/editions.json`);
}

export async function loadGiocatori(edition) {
  return fetchLocal(`${BASE_DATA_PATH}/${edition}/giocatori.json`);
}

export async function loadSquadre(edition) {
  return fetchLocal(`${BASE_DATA_PATH}/${edition}/squadre.json`);
}

export async function loadPunteggi(edition) {
  return fetchLocal(`${BASE_DATA_PATH}/${edition}/punteggi.json`);
}

export async function loadClassifica(edition) {
  return fetchLocal(`${BASE_DATA_PATH}/${edition}/classifica.json`);
}

export async function loadRisultati(edition) {
  return fetchLocal(`${BASE_DATA_PATH}/${edition}/risultati.json`);
}

/**
 * Count the teams registered so far, asked straight to the registration backend.
 *
 * squadre.json is only written on tournament day, so while the iscrizioni are open the sheet
 * behind the Apps Script is the one place that knows the running total. The count=1 parameter
 * makes an up-to-date deployment answer with a bare number instead of every lineup; an older
 * deployment ignores it and returns the full list, which is counted here instead.
 *
 * @returns {Promise<number|null>} Teams registered, or null if the backend cannot be reached
 */
export async function loadRegistrationCount() {
  if (!REGISTRATION_ENDPOINT) return null;
  try {
    const resp = await fetch(`${REGISTRATION_ENDPOINT}?count=1`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (Array.isArray(data)) return data.length;
    return typeof data?.count === 'number' ? data.count : null;
  } catch {
    return null;
  }
}

/**
 * Load all data for a single edition.
 */
export async function loadEditionData(edition) {
  const [giocatori, squadre, punteggi, classifica, risultati] = await Promise.all([
    loadGiocatori(edition),
    loadSquadre(edition),
    loadPunteggi(edition),
    loadClassifica(edition),
    loadRisultati(edition),
  ]);
  return { giocatori, squadre, punteggi, classifica, risultati };
}
