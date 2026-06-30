/**
 * Design Asylum — Lead receiver + FAIL-OPEN spam gatekeeper (full Code.gs)
 *
 * This is the COMPLETE, deployable form-handler script. Paste it into the Apps
 * Script project whose /exec URL is in index.html (the one with doPost),
 * replacing everything, then redeploy.
 *
 * doPost() screens each submission but NEVER silently drops a real lead:
 * only a filled honeypot, a malformed/disposable email, or an exact duplicate
 * re-submitted within 2 minutes are blocked. Everything else that looks "off"
 * (fast fill, odd phone, odd name, weak/absent reCAPTCHA) is recorded as an
 * advisory FLAG, but the lead STILL reaches your sheet.
 *
 * Every block and flag is written to a "Blocked Log" tab in the same
 * spreadsheet, so you always see what was filtered and why.
 *
 * reCAPTCHA stays OFF until you set RECAPTCHA_SECRET (leave PASTE_ as-is).
 * After pasting, redeploy:
 *   Deploy > Manage deployments > pencil > Version "New version" > Deploy
 * (keeps the same /exec URL, so the site form keeps working).
 */

// ---- Your existing config ----
const SHEET_ID = '1wszIABbrK8j106vuEUtfyfBDTq0HsU_sMf96PNHe2gE';
const TO_EMAIL = 'accounts@designasylum.in';

// ---- Spam-hardening config ----
var RECAPTCHA_SECRET    = 'PASTE_RECAPTCHA_SECRET_KEY'; // leave as-is to keep reCAPTCHA off
var RECAPTCHA_MIN_SCORE = 0.5;
var MIN_FILL_MS         = 1200;            // advisory flag only (was a 3000ms hard block)
var DEDUPE_WINDOW_MS    = 2 * 60 * 1000;   // collapse accidental double-submits (2 min)
var BLOCK_LOG_SHEET     = 'Blocked Log';
var DISPOSABLE_DOMAINS  = [
  'mailinator.com', 'tempmail.com', 'guerrillamail.com', '10minutemail.com',
  'yopmail.com', 'sharklasers.com', 'trashmail.com', 'getnada.com',
  'maildrop.cc', 'dispostable.com', 'temp-mail.org', 'fakeinbox.com'
];

// ---- Entry point: fail open — never silently drop a real lead ----
function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ok(); // not from our form
  }

  // HARD BLOCKS — signals that are ~never a real customer
  if (data._h) return hardBlock('honeypot filled', data);
  if (!isValidEmail(data.email)) return hardBlock('malformed/disposable email', data);
  if (isRecentDuplicate(data)) return hardBlock('duplicate re-submit within 2 min', data);

  // SOFT FLAGS — suspicious, but we STILL SAVE the lead
  var flags = [];
  if (isTooFast(data))                        flags.push('submitted fast (<' + MIN_FILL_MS + 'ms)');
  if (!isValidPhone(data.phone))              flags.push('phone looks off');
  if (looksSpammy(data.full_name))            flags.push('name looks off');
  if (!verifyRecaptcha(data.recaptcha_token)) flags.push('low/absent reCAPTCHA');
  if (flags.length) logRow('FLAGGED', flags.join('; '), data);

  rememberSubmission(data);
  return doPostOriginal(e);
}

function ok() { return ContentService.createTextOutput('ok'); }

function hardBlock(reason, data) {
  logRow('BLOCKED', reason, data);
  return ok();
}

// Best-effort log to the "Blocked Log" tab. Wrapped so it can NEVER throw and
// take a real lead down with it.
function logRow(decision, reason, data) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sh = ss.getSheetByName(BLOCK_LOG_SHEET);
    if (!sh) {
      sh = ss.insertSheet(BLOCK_LOG_SHEET);
      sh.appendRow(['Timestamp', 'Decision', 'Reason', 'Name', 'Email', 'Phone', 'Source', 'Elapsed (ms)']);
    }
    sh.appendRow([
      new Date(), decision, reason,
      (data && data.full_name) || '', (data && data.email) || '',
      (data && data.phone) || '',     (data && data.source) || '',
      (data && (data._elapsed === 0 || data._elapsed) ? data._elapsed : '')
    ]);
  } catch (err) {
    Logger.log('logRow failed (' + err + ') — ' + decision + ' / ' + reason);
  }
}

// ---- Validation helpers ----
function isTooFast(data) {
  if (data._elapsed === null || data._elapsed === undefined || data._elapsed === '') return false;
  var ms = Number(data._elapsed);
  return isFinite(ms) && ms >= 0 && ms < MIN_FILL_MS;
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  email = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  var domain = email.split('@')[1];
  for (var i = 0; i < DISPOSABLE_DOMAINS.length; i++) {
    if (domain === DISPOSABLE_DOMAINS[i] || domain.indexOf('.' + DISPOSABLE_DOMAINS[i]) !== -1) {
      return false;
    }
  }
  return true;
}

// Advisory only — real numbers vary, so we flag rather than block.
function isValidPhone(phone) {
  if (!phone) return false;
  var digits = String(phone).replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

// Advisory only. Allows Unicode letters so names in any script pass.
function looksSpammy(name) {
  if (!name || typeof name !== 'string') return true;
  var n = name.trim();
  if (n.length === 0 || n.length > 80) return true;
  if (/https?:\/\/|www\.|<a\s|\[url|\bhref\b/i.test(n)) return true;
  var letters;
  try {
    letters = (n.match(/\p{L}/gu) || []).length;
  } catch (e) {
    letters = (n.match(/[A-Za-zÀ-ɏ]/g) || []).length;
  }
  if (letters / n.length < 0.4) return true;
  return false;
}

// ---- Dedup (Script Properties; short window just collapses double-clicks) ----
function dedupeKey(data) {
  var email = String(data.email || '').trim().toLowerCase();
  var phone = String(data.phone || '').replace(/\D/g, '');
  return 'd_' + Utilities.base64EncodeWebSafe(email + '|' + phone);
}

function isRecentDuplicate(data) {
  var props = PropertiesService.getScriptProperties();
  pruneDedupe(props);
  var prev = props.getProperty(dedupeKey(data));
  if (prev === null) return false;
  var ts = Number(prev);
  return isFinite(ts) && (nowMs() - ts) < DEDUPE_WINDOW_MS;
}

function rememberSubmission(data) {
  PropertiesService.getScriptProperties().setProperty(dedupeKey(data), String(nowMs()));
}

function pruneDedupe(props) {
  var all = props.getProperties();
  var cutoff = nowMs() - DEDUPE_WINDOW_MS;
  for (var key in all) {
    if (key.indexOf('d_') === 0) {
      var ts = Number(all[key]);
      if (!isFinite(ts) || ts < cutoff) props.deleteProperty(key);
    }
  }
}

function nowMs() { return new Date().getTime(); }

// Advisory only: returns true (fine) unless a real secret is set AND the token
// is missing or scores low. Dormant until you paste a secret key.
function verifyRecaptcha(token) {
  if (RECAPTCHA_SECRET.indexOf('PASTE_') === 0) return true;
  if (!token) return false;
  try {
    var res = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'post',
      payload: { secret: RECAPTCHA_SECRET, response: token }
    });
    var r = JSON.parse(res.getContentText());
    Logger.log('reCAPTCHA score: ' + r.score + ' success: ' + r.success);
    return r.success === true && (r.score === undefined || r.score >= RECAPTCHA_MIN_SCORE);
  } catch (err) {
    Logger.log('reCAPTCHA verify error (allowing through): ' + err.message);
    return true;
  }
}

// ---- Your original handler: writes the sheet row + emails you (unchanged) ----
function doPostOriginal(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data._h) return json({ ok: false });
    SpreadsheetApp.openById(SHEET_ID).getActiveSheet()
      .appendRow([new Date(), data.full_name, data.email, data.phone, data.offer, data.source]);
    MailApp.sendEmail({
      to: TO_EMAIL,
      subject: '📩 Lead: ' + data.full_name + ' — Offer ' + data.offer,
      body: 'Name:  '   + data.full_name + '\nEmail: ' + data.email
          + '\nPhone: ' + data.phone + '\nOffer: ' + data.offer
          + '\nSource: ' + data.source + '\nTime: ' + new Date()
    });
    return json({ ok: true });
  } catch(err) { return json({ ok: false }); }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
