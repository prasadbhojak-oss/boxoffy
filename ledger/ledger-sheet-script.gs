// Boxoffy Ledger - receives new ledger rows from the PC (ledger\ledger_push.py).
// Paste into the "Boxoffy Ledger" Google Sheet: Extensions > Apps Script, replace everything, Save.
// Project Settings (gear) > Script Properties > Add: LEDGER_TOKEN = your passphrase.
// Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone > Deploy > copy the URL.
function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var want = PropertiesService.getScriptProperties().getProperty('LEDGER_TOKEN');
  if (!want || body.token !== want) return out_({ ok: false, error: 'not allowed' });
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Ledger') ||
           SpreadsheetApp.getActiveSpreadsheet().insertSheet('Ledger');
  var cols = body.cols, rows = body.rows || [];
  if (sh.getLastRow() === 0) { sh.appendRow(cols); sh.setFrozenRows(1); }
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, cols.length).setValues(rows);
  return out_({ ok: true, added: rows.length, total: sh.getLastRow() - 1 });
}
function doGet() { return out_({ ok: true, ledger: 'Boxoffy' }); }
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
