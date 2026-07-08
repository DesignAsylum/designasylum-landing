/**
 * Design Asylum — Lead receiver + spam gatekeeper (full Code.gs)
 *
 * This is the COMPLETE, deployable form-handler script. Paste it into the Apps
 * Script project whose /exec URL is in index.html (the one with doPost),
 * replacing everything, then redeploy.
 *
 * The /exec URL is public (it's visible in the page source), so bots can POST
 * to it directly without ever loading the page. The gate that stops them is
 * Cloudflare Turnstile: a valid token can only be minted by a visitor who
 * actually loaded the page and passed the challenge, and each token is
 * single-use and verified here against Cloudflare's siteverify API.
 *
 * ONE-TIME SETUP (required — Turnstile stays dormant until done):
 *   1. Cloudflare dashboard > Turnstile > your widget > copy the SECRET key
 *      (the site key is already in index.html; the secret must NEVER go in
 *      this file or the repo).
 *   2. Apps Script editor > Project Settings > Script Properties >
 *      Add property: name TURNSTILE_SECRET, value = that secret key.
 *   3. Deploy > Manage deployments > pencil > Version "New version" > Deploy
 *      (keeps the same /exec URL, so the site form keeps working).
 *
 * With the secret set, doPost() FAILS CLOSED on the bot path: a submission
 * with a missing or rejected Turnstile token is hard-blocked (recorded in the
 * "Blocked Log" tab, never in the leads sheet, no email). A genuine
 * siteverify outage (retried once) still fails open with a flag so a real
 * lead isn't lost to a Cloudflare incident — bots can't trigger that path.
 * A global rate limit (MAX_PER_WINDOW below) backstops everything else.
 * Without the secret, behavior is the old fail-open mode: everything
 * suspicious is flagged but still saved.
 *
 * Every block and flag is written to a "Blocked Log" tab in the same
 * spreadsheet, so you always see what was filtered and why.
 */

// ---- Your existing config ----
const SHEET_ID = '1wszIABbrK8j106vuEUtfyfBDTq0HsU_sMf96PNHe2gE';
const TO_EMAIL = 'accounts@designasylum.in';

// ---- Spam-hardening config ----
// Turnstile secret lives in Script Properties (see setup above), never in code.
var TURNSTILE_SECRET    = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET') || '';
var MIN_FILL_MS         = 1200;            // advisory flag only (was a 3000ms hard block)
var DEDUPE_WINDOW_MS    = 2 * 60 * 1000;   // collapse accidental double-submits (2 min)
var RATE_WINDOW_SECS    = 10 * 60;         // rate-limit window (seconds)
var MAX_PER_WINDOW      = 15;              // max submissions per window, across ALL visitors
var BLOCK_LOG_SHEET     = 'Blocked Log';
var DISPOSABLE_DOMAINS  = [
  'mailinator.com', 'tempmail.com', 'guerrillamail.com', '10minutemail.com',
  'yopmail.com', 'sharklasers.com', 'trashmail.com', 'getnada.com',
  'maildrop.cc', 'dispostable.com', 'temp-mail.org', 'fakeinbox.com'
];

// ---- Entry point ----
function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ok(); // not from our form
  }

  // CAPTCHA verdict: 'pass' | 'fail' | 'missing' | 'unknown'
  var ts = turnstileResult(data.cf_turnstile_token);

  // HARD BLOCKS — signals that are ~never a real customer
  if (data._h) return hardBlock('honeypot filled', data);
  if (!isValidEmail(data.email)) return hardBlock('malformed/disposable email', data);
  if (ts === 'fail') return hardBlock('Turnstile challenge failed', data);
  if (ts === 'missing') return hardBlock('Turnstile token missing (direct POST?)', data);
  if (isRateLimited()) return hardBlock('rate limit exceeded (>' + MAX_PER_WINDOW + ' in ' + (RATE_WINDOW_SECS / 60) + ' min)', data);
  if (isRecentDuplicate(data)) return hardBlock('duplicate re-submit within 2 min', data);

  // SOFT FLAGS — suspicious, but we STILL SAVE the lead
  var flags = [];
  if (isTooFast(data))             flags.push('submitted fast (<' + MIN_FILL_MS + 'ms)');
  if (!isValidPhone(data.phone))   flags.push('phone looks off');
  if (looksSpammy(data.full_name)) flags.push('name looks off');
  if (ts === 'unknown')            flags.push('Turnstile not verified (secret unset / siteverify unreachable)');
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

// Cloudflare Turnstile verdict: 'pass' | 'fail' | 'missing' | 'unknown'.
//   pass    = valid token, real human
//   fail    = token present but rejected (failed challenge / bot / replay) -> hard block
//   missing = secret configured but no token sent (direct POST to /exec)   -> hard block
//   unknown = secret not configured, or siteverify down after a retry      -> flag, fail open
function turnstileResult(token) {
  if (!TURNSTILE_SECRET) return 'unknown'; // dormant until the Script Property is set
  if (!token) return 'missing';            // page mints a token on load — its absence means the page was never loaded
  for (var attempt = 0; attempt < 2; attempt++) {
    try {
      var res = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'post',
        payload: { secret: TURNSTILE_SECRET, response: token }
      });
      var r = JSON.parse(res.getContentText());
      Logger.log('Turnstile success: ' + r.success + ' codes: ' + JSON.stringify(r['error-codes'] || []));
      return r.success === true ? 'pass' : 'fail';
    } catch (err) {
      Logger.log('Turnstile verify error (attempt ' + (attempt + 1) + '): ' + err.message);
    }
  }
  return 'unknown'; // siteverify unreachable twice — fail open so a Cloudflare outage can't cost a real lead
}

// Global rate limit via CacheService: counts ALL submissions (Apps Script
// never sees client IPs, so a total cap is the only limit possible here).
// Real landing-page traffic stays far under it; a bot flood does not.
// Fails open if the cache misbehaves — Turnstile remains the primary gate.
function isRateLimited() {
  try {
    var cache = CacheService.getScriptCache();
    var key = 'rate_' + Math.floor(nowMs() / (RATE_WINDOW_SECS * 1000));
    var count = Number(cache.get(key) || 0) + 1;
    cache.put(key, String(count), RATE_WINDOW_SECS);
    return count > MAX_PER_WINDOW;
  } catch (err) {
    Logger.log('isRateLimited failed (allowing through): ' + err.message);
    return false;
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
