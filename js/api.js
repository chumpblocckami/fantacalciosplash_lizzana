import { GSP_API_URL, LIVE_REFRESH_INTERVAL_MS, CURRENT_YEAR } from './constants.js';

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
