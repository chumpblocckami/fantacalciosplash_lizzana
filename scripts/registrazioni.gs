/**
 * Registration backend for Fantacalciosplash Lizzana.
 *
 * This file is not run by the repo: it is the source of a Google Apps Script web app
 * that stores registrations in a Google Sheet.
 *
 * Setup:
 *   1. Create a Google Sheet, then Extensions > Apps Script.
 *   2. Paste this file over the default Code.gs and save.
 *   3. Deploy > New deployment > Web app.
 *        Execute as:       Me
 *        Who has access:   Anyone
 *   4. Copy the /exec URL into REGISTRATION_ENDPOINT in js/constants.js.
 *
 * The web app answers POST by appending a registration, and GET by returning every
 * registration as JSON, which scripts/fetch-registrations.js writes to squadre.json.
 */

const SHEET_NAME = 'Iscrizioni';
const HEADERS = [
  'Timestamp',
  'Fantallenatore',
  'Portiere',
  'Titolare 1',
  'Titolare 2',
  'Titolare 3',
  'Riserva',
];

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (!data.coach || !String(data.coach).trim()) {
      return jsonResponse({ success: false, message: 'Nome del fantallenatore mancante.' });
    }

    const starters = data.starters || [];
    getSheet().appendRow([
      data.timestamp || new Date().toISOString(),
      String(data.coach).trim(),
      data.goalkeeper || '',
      starters[0] || '',
      starters[1] || '',
      starters[2] || '',
      data.reserve || '',
    ]);

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, message: String(err) });
  }
}

function doGet() {
  const rows = getSheet().getDataRange().getValues();
  rows.shift();

  // A coach who registers twice is correcting an earlier entry, so the last one wins.
  const byCoach = {};
  rows
    .filter(row => String(row[1]).trim())
    .forEach(row => {
      byCoach[String(row[1]).trim().toLowerCase()] = {
        Fantallenatore: String(row[1]).trim(),
        Portiere: row[2],
        'Titolare 1': row[3],
        'Titolare 2': row[4],
        'Titolare 3': row[5],
        Riserva: row[6],
      };
    });

  return jsonResponse(Object.values(byCoach));
}
