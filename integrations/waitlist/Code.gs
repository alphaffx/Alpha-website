/** Google Apps Script receiver for FormSubmit's waitlist webhook.
 * Set SPREADSHEET_ID in Script Properties; keep the spreadsheet private.
 * Import/create the Subscribers sheet with the exact header row below first.
 * This endpoint accepts signups only. It never reads subscriber data to callers.
 */
const WAITLIST_HEADERS = ['Email', 'Signed up (UTC)', 'Language', 'Consent', 'Consent recorded (UTC)', 'Status', 'Notes'];
const WAITLIST_CONSENT = 'Requested class launch emails; may opt out by replying.';

function doGet() {
  return waitlistResponse_(false); // No subscriber listing or email lookup endpoint.
}

function doPost(event) {
  let lock;
  try {
    const raw = event && event.postData && event.postData.contents;
    if (!raw || raw.length > 16000) return waitlistResponse_(false);
    const envelope = JSON.parse(raw);
    const data = envelope.form_data;
    if (!data || typeof data.email !== 'string' || data.consent !== WAITLIST_CONSENT ||
        data.interest !== 'Learn with ALPHA — recorded classes') return waitlistResponse_(false);
    const email = data.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return waitlistResponse_(false);
    const languages = ['en', 'fr', 'pt', 'es', 'id', 'th', 'vi', 'ar'];
    const language = languages.includes(data.page_language) ? data.page_language : 'en';
    const consentTime = typeof data.consent_at === 'string' ? new Date(data.consent_at) : new Date(NaN);
    if (!Number.isFinite(consentTime.getTime())) return waitlistResponse_(false);
    const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!id) throw new Error('Missing spreadsheet configuration');
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const sheet = SpreadsheetApp.openById(id).getSheetByName('Subscribers');
    if (!sheet) throw new Error('Missing Subscribers sheet');
    const headers = sheet.getRange(1, 1, 1, WAITLIST_HEADERS.length).getValues()[0];
    if (!WAITLIST_HEADERS.every((header, index) => headers[index] === header)) throw new Error('Unexpected sheet columns');
    const count = sheet.getLastRow();
    const emails = count > 1 ? sheet.getRange(2, 1, count - 1, 1).getValues() : [];
    // Never overwrite status/notes, including manual opt-outs, on repeat requests.
    if (!emails.some(row => String(row[0]).replace(/^'/, '').trim().toLowerCase() === email)) {
      // Escape formula prefixes before writing user-supplied text to a spreadsheet.
      const safeEmail = /^[=+\-@]/.test(email) ? "'" + email : email;
      sheet.getRange(count + 1, 1, 1, WAITLIST_HEADERS.length).setValues([[
        safeEmail, new Date().toISOString(), language, WAITLIST_CONSENT,
        consentTime.toISOString(), 'Active', ''
      ]]);
      SpreadsheetApp.flush();
    }
    return waitlistResponse_(true); // Same response for new and existing emails.
  } catch (error) {
    // Avoid logging request bodies, email addresses, or other subscriber information.
    console.error('Waitlist write failed. Check configuration and Apps Script quotas.');
    return waitlistResponse_(false);
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function waitlistResponse_(success) {
  return ContentService.createTextOutput(JSON.stringify({ success: success })).setMimeType(ContentService.MimeType.JSON);
}
