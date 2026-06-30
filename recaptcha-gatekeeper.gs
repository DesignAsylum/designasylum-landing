// ─────────────────────────────────────────────────────────────────────────────
// Design Asylum — reCAPTCHA v3 Gatekeeper for the form-to-sheet Apps Script
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
//   3. Replace PASTE_RECAPTCHA_SECRET_KEY below with your SECRET key
//      from https://www.google.com/recaptcha/admin
//   4. Deploy → Manage deployments → ✏️ (pencil) → Version: "New version"
//      → Deploy.  (This keeps the same /exec URL — do NOT create a new
//      deployment, or the URL changes and the site form breaks.)
// ─────────────────────────────────────────────────────────────────────────────

var RECAPTCHA_SECRET = 'PASTE_RECAPTCHA_SECRET_KEY';
var RECAPTCHA_MIN_SCORE = 0.5; // 0 = definitely bot, 1 = definitely human

// ── No-friction spam hardening (works with NO third-party keys) ───────────────
var MIN_FILL_MS = 3000;                          // submissions faster than this = bot
var DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;      // block repeat email+phone within 24h
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
    return ContentService.createTextOutput('ok');
  }

  // Honeypot: hidden field only bots fill in. Pretend success, save nothing.
  if (data._h) return blocked('honeypot filled', data);

  // Time-trap: a human can't read and complete the form in a few seconds.
  if (isTooFast(data)) return blocked('submitted too fast', data);

  // Field validation: drop obviously fake or malformed leads.
  if (!isValidEmail(data.email)) return blocked('bad/disposable email', data);
  if (!isValidPhone(data.phone)) return blocked('bad phone', data);
  if (looksSpammy(data.full_name)) return blocked('spammy name', data);

  // Dedup: same email+phone inside the window is almost always a spam loop.
  if (isDuplicate(data)) return blocked('duplicate within window', data);

  // reCAPTCHA: reject missing/invalid tokens and low scores (dormant until keys set).
  if (!verifyRecaptcha(data.recaptcha_token)) return blocked('reCAPTCHA failed', data);

  // Legit submission — remember it (for dedup) and hand off to your handler untouched.
  rememberSubmission(data);
  return doPostOriginal(e);
}

// Log the reason and return the same dummy "ok" so bots get no feedback and a
// real user's UX is never broken.
function blocked(reason, data) {
  Logger.log('Blocked (' + reason + ') for ' + ((data && data.email) || 'unknown'));
  return ContentService.createTextOutput('ok');
}

// ── Validation helpers ────────────────────────────────────────────────────────

// Reject only when we actually measured a too-fast fill. A null/absent timer
// (older cached page, measurement failed) is NOT treated as a bot.
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

function isValidPhone(phone) {
  if (!phone) return false;
  var digits = String(phone).replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15; // E.164 upper bound is 15
}

// Common spam tell: links crammed into the name field, gibberish, or empty.
function looksSpammy(name) {
  if (!name || typeof name !== 'string') return true;
  var n = name.trim();
  if (n.length === 0 || n.length > 80) return true;
  if (/https?:\/\/|www\.|<a\s|\[url|\bhref\b/i.test(n)) return true;
  var letters = (n.match(/[A-Za-zÀ-ɏ]/g) || []).length;
  if (letters / n.length < 0.5) return true; // mostly non-letters → junk
  return false;
}

// ── Deduplication (no third-party service; uses Script Properties) ─────────────

function dedupeKey(data) {
  var email = String(data.email || '').trim().toLowerCase();
  var phone = String(data.phone || '').replace(/\D/g, '');
  return 'd_' + Utilities.base64EncodeWebSafe(email + '|' + phone);
}

function isDuplicate(data) {
  var props = PropertiesService.getScriptProperties();
  pruneDedupe(props);
  return props.getProperty(dedupeKey(data)) !== null;
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

function verifyRecaptcha(token) {
  // Secret not configured yet — let everything through so the form keeps
  // working while you finish setup.
  if (RECAPTCHA_SECRET.indexOf('PASTE_') === 0) return true;

  if (!token) return false; // no token = bot bypassing the page JS

  try {
    var res = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'post',
      payload: { secret: RECAPTCHA_SECRET, response: token }
    });
    var r = JSON.parse(res.getContentText());
    Logger.log('reCAPTCHA score: ' + r.score + ' success: ' + r.success);
    return r.success === true && (r.score === undefined || r.score >= RECAPTCHA_MIN_SCORE);
  } catch (err) {
    // Google's verify endpoint unreachable — fail OPEN so real leads aren't
    // lost to a transient outage.
    Logger.log('reCAPTCHA verify error (allowing through): ' + err.message);
    return true;
  }
}
