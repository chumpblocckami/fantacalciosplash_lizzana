// ===== SCORING CONSTANTS =====

// Individual player points
export const POINTS_PER_GOAL = 2;
export const POINTS_PER_YELLOW_CARD = -2;
export const POINTS_PER_RED_CARD = -3;

// Team result points
export const POINTS_PER_VICTORY = 2;
export const POINTS_PER_DRAW = 1;
export const POINTS_PER_DEFEAT = 0;
export const POINTS_PER_MISSING_GAME = -2;

// Goalkeeper-specific points
export const POINTS_PER_CLEANSHEET = 5;
export const POINTS_PER_CONCEDED_GOAL = -0.5;

// Match MVP bonus
export const POINTS_MVP = 3;

// End-of-tournament prizes
export const POINTS_TOP_SCORER = 5;
export const POINTS_BEST_PLAYER = 5;
export const POINTS_BEST_GOALKEEPER = 5;

// ===== REGISTRATION CONSTANTS =====
export const BUDGET = 200;
export const ISCRIZIONE_FEE_EUR = 5;
export const MAX_STARTERS = 3;
export const MAX_RESERVES = 1;
export const MAX_GOALKEEPERS = 1;

// ===== TOURNAMENT CONFIG =====
export const CURRENT_YEAR = '2026';

// Regolamento rule 4: "La squadra va inserita entro e non oltre mercoledi 13 agosto alle
// ore 23.59."
export const DEADLINE = new Date('2026-08-13T23:59:00+02:00');

// Where scripts/scrape.js pulls the live data from, overridable with the GSP_API_URL
// environment variable.
export const GSP_API_URL = 'https://api.cs.xana2.media/api';

// Google Apps Script endpoint for registration (set after deploying)
export const REGISTRATION_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbwguh4mbtJ8VSQYXszAeNcVV6jiWB0RS-ckQGb91G1IoF677cgwJRtJYxjGvTlJcLKf/exec';

// PayPal.Me handle collecting the iscrizione, i.e. the last part of
// https://www.paypal.com/paypalme/ciotolaaaa. While this is empty no payment button is shown,
// so the form still works without it.
export const PAYPAL_ME_USER = 'ciotolaaaa';
