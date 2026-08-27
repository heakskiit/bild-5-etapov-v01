/**
 * Google Apps Script Web App — atomic key warehouse.
 *
 * Deploy: Extensions > Apps Script > Deploy > New deployment > Web app
 *   Execute as: Me     Who has access: Anyone
 * Sheet layout (tab "KEYS"):
 *   A: SKU | B: CODE | C: STATUS (AVAILABLE|SOLD) | D: ORDER_ID | E: SOLD_AT
 *
 * Admin workflow: paste new rows with STATUS = AVAILABLE. Nothing else.
 */

var SHEET_NAME = 'KEYS';
var COL = { SKU: 1, CODE: 2, STATUS: 3, ORDER: 4, SOLD_AT: 5 };

function doPost(e) {
  var body = JSON.parse(e.postData.contents);

  if (body.secret !== PropertiesService.getScriptProperties().getProperty('SHARED_SECRET')) {
    return json({ ok: false, error: 'unauthorized' });
  }

  if (body.action === 'stock') return json({ ok: true, remaining: countAvailable(body.sku) });
  if (body.action === 'reserve') return json(reserveKey(body.sku, body.orderId));
  return json({ ok: false, error: 'unknown action' });
}

/**
 * Race-condition safe reservation.
 * LockService serialises every caller, so two simultaneous purchases can never
 * be handed the same row.
 */
function reserveKey(sku, orderId) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'lock timeout' };

  try {
    var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    var values = sheet.getDataRange().getValues();

    for (var row = 1; row < values.length; row++) {
      var isMatch = String(values[row][COL.SKU - 1]).trim() === String(sku).trim();
      var isFree = String(values[row][COL.STATUS - 1]).trim().toUpperCase() === 'AVAILABLE';
      if (!isMatch || !isFree) continue;

      var code = String(values[row][COL.CODE - 1]).trim();
      var sheetRow = row + 1;
      sheet.getRange(sheetRow, COL.STATUS).setValue('SOLD');
      sheet.getRange(sheetRow, COL.ORDER).setValue(orderId);
      sheet.getRange(sheetRow, COL.SOLD_AT).setValue(new Date());
      SpreadsheetApp.flush(); // commit before releasing the lock

      return { ok: true, code: code, remaining: countAvailable(sku) };
    }
    return { ok: false, error: 'out_of_stock' };
  } finally {
    lock.releaseLock();
  }
}

function countAvailable(sku) {
  var values = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME).getDataRange().getValues();
  var n = 0;
  for (var row = 1; row < values.length; row++) {
    if (
      String(values[row][COL.SKU - 1]).trim() === String(sku).trim() &&
      String(values[row][COL.STATUS - 1]).trim().toUpperCase() === 'AVAILABLE'
    ) n++;
  }
  return n;
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
