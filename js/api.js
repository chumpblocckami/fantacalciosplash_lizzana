import {
  GSP_API_URL,
  LIVE_REFRESH_INTERVAL_MS,
  CURRENT_YEAR,
  REGISTRATION_ENDPOINT,
} from './constants.js';

const BASE_DATA_PATH = './data';

/**
 * Fetch JSON from a local path (data/ directory in the repo).
 */
async function fetchLocal(path) {
  const resp = await fetch(path);
  if (!resp.ok) return null;
  return resp.json();
}

/**
 * Fetch JSON from the live GSP API. Falls back to null on CORS/network errors.
 */
async function fetchApi(path) {
  try {
    const resp = await fetch(`${GSP_API_URL}${path}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
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

export async function loadHistory() {
  return fetchLocal(`${BASE_DATA_PATH}/history.json`);
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

// ===== LIVE API =====

/**
 * Fetch live match data from the GSP API for a specific group.
 */
export async function fetchLiveGroup(groupId) {
  return fetchApi(`/groups/${groupId}`);
}

/**
 * Fetch live fixtures for a group.
 */
export async function fetchLiveFixtures(groupId, page = 1) {
  return fetchApi(`/groups/${groupId}/fixtures?page=${page}`);
}

/**
 * Fetch live rankings for a group.
 */
export async function fetchLiveRankings(groupId) {
  return fetchApi(`/groups/${groupId}/rankings`);
}

/**
 * Start polling live data at regular intervals.
 * @param {Function} callback - Called with fresh data on each tick
 * @returns {Function} stop - Call to stop polling
 */
export function startLivePolling(callback) {
  let active = true;

  async function poll() {
    if (!active) return;
    try {
      const liveData = await fetchLiveMatches();
      if (liveData) callback(liveData);
    } catch {
      // Silently ignore polling errors
    }
    if (active) setTimeout(poll, LIVE_REFRESH_INTERVAL_MS);
  }

  poll();
  return () => { active = false; };
}

/**
 * Fetch all live matches across groups (tries groups 1-20).
 */
async function fetchLiveMatches() {
  const allMatches = [];

  for (let i = 1; i <= 20; i++) {
    const group = await fetchApi(`/groups/${i}`);
    if (!group) break;

    const label = group.data?.name ?? '';
    const fixtures = await fetchApi(`/groups/${i}/fixtures?page=1`);

    if (fixtures?.data) {
      for (const match of fixtures.data) {
        allMatches.push({
          ...match,
          stage: label,
        });
      }
    }
  }

  return allMatches.length > 0 ? allMatches : null;
}
