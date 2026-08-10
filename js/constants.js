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
export const MAX_STARTERS = 3;
export const MAX_RESERVES = 1;
export const MAX_GOALKEEPERS = 1;

// ===== TOURNAMENT CONFIG =====
export const CURRENT_YEAR = '2026';
export const DEADLINE = new Date('2026-08-13T16:00:00+02:00');
export const GSP_API_URL = 'https://api.gsplizzana.it/api';
export const LIVE_REFRESH_INTERVAL_MS = 30_000;

// Google Apps Script endpoint for registration (set after deploying)
export const REGISTRATION_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbwguh4mbtJ8VSQYXszAeNcVV6jiWB0RS-ckQGb91G1IoF677cgwJRtJYxjGvTlJcLKf/exec';
