import { REGISTRATION_ENDPOINT } from './constants.js';

const BASE_DATA_PATH = './data';

/**
 * Fetch JSON from a local path (data/ directory in the repo).
 *
 * GitHub Pages serves these with max-age=600, which on tournament day leaves a visitor looking
 * at a classifica up to ten minutes old and makes a refresh appear to do nothing. 'no-cache'
 * revalidates instead of skipping the cache: the ETag means an unchanged file still costs a 304,
 * and the Pages CDN is purged on every deploy, so what comes back is what was last published.
 */
async function fetchLocal(path) {
  const resp = await fetch(path, { cache: 'no-cache' });
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

export async function loadDettaglio(edition) {
  return fetchLocal(`${BASE_DATA_PATH}/${edition}/dettaglio.json`);
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
      // ponytail: GAS cold starts plus the script.google.com redirect chain can exceed 10s;
      // fetch-registrations.js already waits 30s for the same endpoint.
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (Array.isArray(data)) return data.length;
    if (typeof data?.count === 'number') return data.count;
    const parsed = Number.parseInt(String(data?.count ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function loadPremi(edition) {
  return fetchLocal(`${BASE_DATA_PATH}/${edition}/premi.json`);
}

/**
 * Load all data for a single edition.
 */
export async function loadEditionData(edition) {
  const [giocatori, squadre, punteggi, classifica, dettaglio, risultati, premi] = await Promise.all([
    loadGiocatori(edition),
    loadSquadre(edition),
    loadPunteggi(edition),
    loadClassifica(edition),
    loadDettaglio(edition),
    loadRisultati(edition),
    loadPremi(edition),
  ]);
  return { giocatori, squadre, punteggi, classifica, dettaglio, risultati, premi };
}
