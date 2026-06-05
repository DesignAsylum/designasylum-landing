// ─────────────────────────────────────────────────────────────────────────────
// Design Asylum — Lead Confirmation Email
//
// SETUP (one-time, ~2 minutes):
//   1. In Apps Script editor: File > New > HTML file → name it "email-template"
//   2. Replace its contents with the full contents of email-template.html
//   3. Back in Code.gs, click Run > installTrigger
//   4. Approve the permissions popup
//
// The script fires on every new row, reads the lead's data, fills in all
// {{TOKENS}}, strips the offer card when the offer field is blank,
// and sends the HTML email to the lead's address.
// ─────────────────────────────────────────────────────────────────────────────

// ── Offer lookup table ────────────────────────────────────────────────────────
var OFFER_MAP = {
  'offer 1': {
    name:  'Launchpad',
    price: '₹3.90 L',
    weeks: '6 weeks',
    desc:  'A polished MVP: your core funnel and top three features, build-ready. '
  },
  'offer 2': {
    name:  'Foundation',
    price: '₹6.90 L',
    weeks: '9 weeks',
    desc:  'Strategy baked in: stakeholder interviews, competitor research, full IA. '
  },
  'offer 3': {
    name:  'Flagship',
    price: '₹9.90 L',
    weeks: '14 weeks',
    desc:  'Deeper discovery, more screens, and a clickable prototype investors can use. '
  }
};

// ── Run once to install the trigger ──────────────────────────────────────────
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'onNewRow') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onNewRow')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onChange()
    .create();
  Logger.log('Trigger installed.');
}

// ── Main handler — fires on every sheet change ────────────────────────────────
function onNewRow(e) {
  if (e.changeType !== 'INSERT_ROW') return;

  var sheet   = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var values  = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = {};
  headers.forEach(function(h, i) {
    row[h.toString().trim().toLowerCase()] = values[i];
  });

  var email    = (row['email']     || '').toString().trim();
  var fullName = (row['full name'] || '').toString().trim();
  var offerRaw = (row['offer']     || '').toString().trim();

  if (!email || !email.includes('@')) {
    Logger.log('Row ' + lastRow + ': no valid email — skipped.');
    return;
  }

  var firstName = fullName.split(' ')[0] || fullName || 'there';
  var offerKey  = offerRaw.toLowerCase().substring(0, 7);
  var offerData = OFFER_MAP[offerKey] || null;

  var htmlBody = buildEmail(firstName, offerData);
  var subject  = 'Your app brief is with us — Design Asylum';

  GmailApp.sendEmail(email, subject, plainTextFallback(firstName, offerData), {
    htmlBody: htmlBody,
    name:     'Design Asylum',
    replyTo:  'accounts@designasylum.in'
  });

  Logger.log('Email sent to ' + email + ' (' + (offerData ? offerData.name : 'no offer') + ')');
}

// ── Build the final HTML ───────────────────────────────────────────────────────
function buildEmail(firstName, offerData) {
  // Reads the HTML file named "email-template" inside this Apps Script project
  var html = HtmlService.createHtmlOutputFromFile('email-template').getContent();

  html = html.replace(/\{\{FIRST_NAME\}\}/g, escapeHtml(firstName));

  if (offerData) {
    html = html.replace(/\{\{OFFER_NAME\}\}/g,  escapeHtml(offerData.name));
    html = html.replace(/\{\{OFFER_PRICE\}\}/g, escapeHtml(offerData.price));
    html = html.replace(/\{\{OFFER_WEEKS\}\}/g, escapeHtml(offerData.weeks));
    html = html.replace(/\{\{OFFER_DESC\}\}/g,  escapeHtml(offerData.desc));
    // Remove the marker comments, keeping the card
    html = html.replace(/<!--\s*OFFER_CARD_START\s*-->/g, '');
    html = html.replace(/<!--\s*OFFER_CARD_END\s*-->/g,   '');
  } else {
    // Strip the entire offer card block for popup/blank-offer leads
    html = html.replace(/<!--\s*OFFER_CARD_START\s*-->[\s\S]*?<!--\s*OFFER_CARD_END\s*-->/g, '');
  }

  return html;
}

// ── Plain-text fallback ───────────────────────────────────────────────────────
function plainTextFallback(firstName, offerData) {
  var lines = [
    'Hi ' + firstName + ',',
    '',
    "Good move. You've just done what most founders postpone for months — put your app on a real timeline.",
    "Your brief is with a design lead right now. We'll reach out within 24 hours, usually much sooner.",
    ''
  ];
  if (offerData) {
    lines.push('Plan selected: ' + offerData.name + ' — ' + offerData.price + ' / ' + offerData.weeks);
    lines.push(offerData.desc + 'Fixed scope, fixed fee.');
    lines.push('');
  }
  lines.push("Can't wait? Chat with us on WhatsApp: https://wa.me/918256879792");
  lines.push('');
  lines.push('— Design Asylum');
  lines.push('accounts@designasylum.in | mobileapps.designasylum.in');
  return lines.join('\n');
}

// ── Escape HTML special characters in injected values ────────────────────────
function escapeHtml(str) {
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
