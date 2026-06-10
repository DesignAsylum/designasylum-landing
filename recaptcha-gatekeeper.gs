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

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Honeypot: hidden field only bots fill in. Pretend success, save nothing.
    if (data._h) {
      Logger.log('Blocked: honeypot filled');
      return ContentService.createTextOutput('ok');
    }

    // reCAPTCHA: reject missing/invalid tokens and low scores.
    if (!verifyRecaptcha(data.recaptcha_token)) {
      Logger.log('Blocked: reCAPTCHA failed for ' + (data.email || 'unknown'));
      return ContentService.createTextOutput('ok');
    }
  } catch (err) {
    // Unparseable request — not from our form.
    return ContentService.createTextOutput('ok');
  }

  // Legit submission — hand off to your original handler untouched.
  return doPostOriginal(e);
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
