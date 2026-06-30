// ─────────────────────────────────────────────────────────────────────────────
// Design Asylum — Lead Gatekeeper for the form-to-sheet Apps Script
//
// FAIL-OPEN BY DESIGN: a real lead is NEVER silently dropped. Only signals with
// essentially zero false positives hard-block (honeypot, malformed/disposable
// email, an exact duplicate re-submitted within 2 minutes). Everything else
// that looks "off" (too-fast fill, odd phone, odd name, weak/absent reCAPTCHA)
// is recorded as an advisory FLAG but the lead STILL reaches your sheet.
//
// Every block and every flag is written to a "Blocked Log" tab in the same
// spreadsheet, so you always have visibility into what was filtered and why.
//
// WHERE THIS GOES: the Apps Script project that RECEIVES form submissions
// (the one deployed as a Web App whose /exec URL is in index.html).
// NOT the email-confirmation script.
//
// SETUP (one-time):
//   1. In your existing Code.gs, find the line:  function doPost(e) {
//      and rename it to:                          function doPostOriginal(e) {
//      (change that one word — touch nothing else)
//   2. Paste this ENTIRE file below your existing code (same Code.gs is fine)
//   3. Deploy → Manage deployments → ✏️ (pencil) → Version: "New version"
//      → Deploy.  (This keeps the same /exec URL — do NOT create a new
//      deployment, or the URL changes and the site form breaks.)
//
// reCAPTCHA is OPTIONAL and dormant until you paste a real secret key below.
// Leave it as-is and the form works without it.
// ─────────────────────────────────────────────────────────────────────────────

var RECAPTCHA_SECRET = 'PASTE_RECAPTCHA_SECRET_KEY';
var RECAPTCHA_MIN_SCORE = 0.5; // 0 = definitely bot, 1 = definitely human

var MIN_FILL_MS = 1200;                          // faster than this = advisory flag only
var DEDUPE_WINDOW_MS = 2 * 60 * 1000;            // collapse accidental double-submits (2 min)
var BLOCK_LOG_SHEET = 'Blocked Log';             // tab where blocks + flags are recorded
var DISPOSABLE_DOMAINS = [                        // throwaway inboxes spammers love
  'mailinator.com', 'tempmail.com', 'guerrillamail.com', '10minutemail.com',
  'yopmail.com', 'sharklasers.com', 'trashmail.com', 'getnada.com',
  'maildrop.cc', 'dispostable.com', 'temp-mail.org', 'fakeinbox.com'
];

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    // Unparseable request — not from our form.
    return ok();
  }

  // ── HARD BLOCKS — only signals that are ~never a real customer ──────────────
  // Honeypot: a hidden field only bots fill in.
  if (data._h) return hardBlock('honeypot filled', data);

  // Email: the form enforces type="email" required, so a malformed or throwaway
  // address never comes from a genuine lead.
  if (!isValidEmail(data.email)) return hardBlock('malformed/disposable email', data);

  // Exact same email+phone within 2 minutes = a double-click or a tight loop.
  // The lead is already captured by the first submit, so this loses nothing.
  if (isRecentDuplicate(data)) return hardBlock('duplicate re-submit within 2 min', data);

  // ── SOFT FLAGS — suspicious, but we STILL SAVE the lead (fail open) ──────────
  var flags = [];
  if (isTooFast(data))                          flags.push('submitted fast (<' + MIN_FILL_MS + 'ms)');
  if (!isValidPhone(data.phone))                flags.push('phone looks off');
  if (looksSpammy(data.full_name))              flags.push('name looks off');
  if (!verifyRecaptcha(data.recaptcha_token))   flags.push('low/absent reCAPTCHA');

  if (flags.length) logRow('FLAGGED', flags.join('; '), data); // visibility only — lead still saved

  // Remember it (for dedup) and hand off to your original handler untouched.
  rememberSubmission(data);
  return doPostOriginal(e);
}

// ── Logging + responses ───────────────────────────────────────────────────────

// Always return the same dummy "ok" so bots get no feedback and a real user's
// UX is never broken.
function ok() {
  return ContentService.createTextOutput('ok');
}

function hardBlock(reason, data) {
  logRow('BLOCKED', reason, data);
  return ok();
}

// Best-effort append to the "Blocked Log" tab. Wrapped so a logging failure can
// NEVER throw and take a real lead down with it.
function logRow(decision, reason, data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      Logger.log(decision + ' (' + reason + ') for ' + ((data && data.email) || 'unknown'));
      return;
    }
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

// ── Validation helpers ────────────────────────────────────────────────────────

// Reject only when we actually measured a too-fast fill. A null/absent timer
// (older cached page, measurement failed) is NOT treated as suspicious.
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

// Advisory only: real numbers vary a lot (extensions, country codes, spacing),
// so we flag rather than block.
function isValidPhone(phone) {
  if (!phone) return false;
  var digits = String(phone).replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15; // E.164 upper bound is 15
}

// Advisory only. Allows Unicode letters so names in any script (Devanagari,
// etc.) are never treated as spam.
function looksSpammy(name) {
  if (!name || typeof name !== 'string') return true;
  var n = name.trim();
  if (n.length === 0 || n.length > 80) return true;
  if (/https?:\/\/|www\.|<a\s|\[url|\bhref\b/i.test(n)) return true;
  // Count letters across all scripts, not just A–Z. \p{L} needs the /u flag.
  var letters;
  try {
    letters = (n.match(/\p{L}/gu) || []).length;
  } catch (e) {
    letters = (n.match(/[A-Za-zÀ-ɏ]/g) || []).length; // fallback for old runtimes
  }
  if (letters / n.length < 0.4) return true; // mostly non-letters → junk
  return false;
}

// ── Deduplication (no third-party service; uses Script Properties) ─────────────

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

function nowMs() {
  return new Date().getTime();
}

// Advisory only: returns true (treat as fine) unless a real secret is set AND
// the token is missing or scores low. Dormant until you paste a secret key.
function verifyRecaptcha(token) {
  if (RECAPTCHA_SECRET.indexOf('PASTE_') === 0) return true; // not configured — skip

  if (!token) return false; // a real secret is set but no token arrived

  try {
    var res = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'post',
      payload: { secret: RECAPTCHA_SECRET, response: token }
    });
    var r = JSON.parse(res.getContentText());
    Logger.log('reCAPTCHA score: ' + r.score + ' success: ' + r.success);
    return r.success === true && (r.score === undefined || r.score >= RECAPTCHA_MIN_SCORE);
  } catch (err) {
    // Google's verify endpoint unreachable — treat as fine so leads aren't lost.
    Logger.log('reCAPTCHA verify error (allowing through): ' + err.message);
    return true;
  }
}
