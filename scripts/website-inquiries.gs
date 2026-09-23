// Matthew Norton Photos — paste into Code.gs in the sheet's Apps Script editor.
// Run setup() once as Matthew, then deploy as a web app. See the setup guide.
const CONFIG = Object.freeze({
  sheetId: '12frp3haGH6rRc2f5Sle0Hrw03OT1XJa_FDR8aeruoRE',
  tab: 'Website Inquiries',
  recipient: 'matthewnortonphotos@gmail.com',
  maxDailySubmissions: 100,
  maxAttempts: 3
});
const HEADERS = ['Submission ID', 'Received at', 'Name', 'Email', 'Session type',
  'Message', 'Notification status', 'Attempts', 'Last attempt', 'Notification note', 'Original field data'];

function setup() {
  if (Session.getEffectiveUser().getEmail().toLowerCase() !== CONFIG.recipient) {
    throw new Error('Run setup while signed into Matthew’s Google account.');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const book = SpreadsheetApp.openById(CONFIG.sheetId);
    let sheet = book.getSheetByName(CONFIG.tab);
    if (!sheet) sheet = book.insertSheet(CONFIG.tab);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.setColumnWidths(1, HEADERS.length, 160);
      sheet.setColumnWidth(6, 360);
      sheet.hideColumns(11);
    }
    checkHeaders_(sheet);
    MailApp.getRemainingDailyQuota(); // Request send-mail authorization; no email is sent.
    if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'retryNotifications')) {
      ScriptApp.newTrigger('retryNotifications').timeBased().everyMinutes(10).create();
    }
  } finally { lock.releaseLock(); }
}

function doGet() {
  return json_({ok: true, service: 'Matthew Norton Photos inquiry receiver'});
}

function doPost(event) {
  let id;
  try {
    const data = parse_(event);
    id = data.submissionId;
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return json_({ok: false, error: 'BUSY'});
    try {
      const sheet = sheet_();
      const existing = findRow_(sheet, id);
      if (existing) {
        const values = JSON.parse(sheet.getRange(existing, 11).getValue());
        const incoming = [data.Name, data.Email, data.Type, data.Message];
        if (!values.every((value, i) => value === incoming[i])) {
          return json_({ok: false, error: 'ID_CONFLICT'});
        }
      } else {
        const now = new Date();
        const recent = sheet.getLastRow() > 1
          ? sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues()
            .filter(row => now.getTime() - new Date(row[0]).getTime() < 86400000).length : 0;
        if (recent >= CONFIG.maxDailySubmissions) return json_({ok: false, error: 'LIMIT_REACHED'});
        sheet.appendRow([id, now, literal_(data.Name), literal_(data.Email),
          literal_(data.Type), literal_(data.Message), 'Pending', 0, '', '',
          JSON.stringify([data.Name, data.Email, data.Type, data.Message])]);
        SpreadsheetApp.flush();
      }
    } finally { lock.releaseLock(); }
  } catch (error) {
    return json_({ok: false, error: error.message === 'INVALID_INPUT' ? 'INVALID_INPUT' : 'SAVE_FAILED'});
  }
  // A notification problem must not turn a saved inquiry into a failed submission.
  try { notify_(id); } catch (error) { console.error('Notification needs review; inquiry was saved.'); }
  return json_({ok: true, submissionId: id, saved: true});
}

function retryNotifications() {
  const sheet = sheet_();
  if (sheet.getLastRow() < 2) return;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
  rows.filter(row => ['Pending', 'Failed'].includes(row[6]) && Number(row[7]) < CONFIG.maxAttempts)
    .slice(0, 20).forEach(row => notify_(String(row[0])));
}

function notify_(id) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const sheet = sheet_();
    const row = findRow_(sheet, id);
    if (!row) return;
    const values = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
    if (!['Pending', 'Failed'].includes(values[6]) || Number(values[7]) >= CONFIG.maxAttempts) return;
    if (MailApp.getRemainingDailyQuota() < 1) {
      sheet.getRange(row, 10).setValue('Waiting for Google email quota to reset.');
      return;
    }
    const attempts = Number(values[7]) + 1;
    const when = new Date();
    sheet.getRange(row, 7, 1, 4).setValues([['Sending', attempts, when, '']]);
    SpreadsheetApp.flush();
    const [name, email, type, message] = JSON.parse(values[10]);
    const url = 'https://docs.google.com/spreadsheets/d/' + CONFIG.sheetId + '/edit#gid=' + sheet.getSheetId();
    const body = 'New website inquiry\n\nName: ' + name + '\nEmail: ' + email +
      '\nSession type: ' + type + '\n\nMessage:\n' + (message || '(No message provided)') +
      '\n\nView inquiries: ' + url + '\nReference: ' + id;
    const htmlBody = '<h2>New website inquiry</h2><p><b>Name:</b> ' + html_(name) +
      '<br><b>Email:</b> ' + html_(email) + '<br><b>Session type:</b> ' + html_(type) +
      '</p><p><b>Message</b><br>' + html_(message || '(No message provided)').replace(/\n/g, '<br>') +
      '</p><p><a href="' + url + '">View inquiries in Google Sheets</a></p><p>Reference: ' + id + '</p>';
    try {
      MailApp.sendEmail({to: CONFIG.recipient, replyTo: email,
        name: 'Matthew Norton Photos Website', subject: 'New photo inquiry — ' + type,
        body: body, htmlBody: htmlBody});
    } catch (error) {
      sheet.getRange(row, 7, 1, 4).setValues([[attempts >= CONFIG.maxAttempts ? 'Review needed' : 'Failed',
        attempts, when, 'Google reported a send failure. Check Apps Script executions and the inbox.']]);
      return;
    }
    // If this write fails, leave Sending for manual review instead of risking an automatic duplicate.
    sheet.getRange(row, 7, 1, 4).setValues([['Sent', attempts, when, 'Accepted by Google mail service; inbox receipt not verified.']]);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
}

function parse_(event) {
  if (!event || !event.postData || event.postData.length > 20000) throw new Error('INVALID_INPUT');
  const data = /^application\/json/i.test(event.postData.type || '')
    ? JSON.parse(event.postData.contents) : event.parameter;
  if (!data || typeof data !== 'object' || data.website) throw new Error('INVALID_INPUT');
  const limits = {Name: 120, Email: 254, Type: 120, Message: 5000, submissionId: 80};
  const result = {};
  Object.keys(limits).forEach(key => {
    const value = data[key] === undefined ? '' : data[key];
    if (typeof value !== 'string' || value.length > limits[key] || /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value)) {
      throw new Error('INVALID_INPUT');
    }
    result[key] = value.trim();
  });
  if (!result.Name || !result.Type || /[\r\n]/.test(result.Name + result.Type + result.Email) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.Email) ||
      !/^[a-zA-Z0-9_-]{20,80}$/.test(result.submissionId)) throw new Error('INVALID_INPUT');
  return result;
}

function sheet_() {
  const sheet = SpreadsheetApp.openById(CONFIG.sheetId).getSheetByName(CONFIG.tab);
  if (!sheet) throw new Error('Run setup first.');
  checkHeaders_(sheet);
  return sheet;
}
function checkHeaders_(sheet) {
  if (JSON.stringify(sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0]) !== JSON.stringify(HEADERS)) {
    throw new Error('Existing column headings differ. No data was overwritten.');
  }
}
function findRow_(sheet, id) {
  if (sheet.getLastRow() < 2) return 0;
  const match = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(id)
    .matchEntireCell(true).useRegularExpression(false).findNext();
  return match ? match.getRow() : 0;
}
// Prevent visitor input from becoming a spreadsheet formula, including on CSV export.
function literal_(value) { return /^[=+@\-']/.test(value) ? "'" + value : value; }
function html_(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
}
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
