// ─────────────────────────────────────────────────────────────────────────────
// Design Asylum — Lead Confirmation Email  (self-contained, no extra files)
//
// SETUP (one-time):
//   1. Paste this entire file into your Apps Script Code.gs (replace everything)
//   2. Click Run → installTrigger  and approve permissions
//   3. Done — emails send within 60 seconds of each new form submission
// ─────────────────────────────────────────────────────────────────────────────

var OFFER_MAP = {
  'offer 1': { name: 'Launchpad',  price: '₹3.90 L', weeks: '6 weeks',  desc: 'A polished MVP: your core funnel and top three features, build-ready. ' },
  'offer 2': { name: 'Foundation', price: '₹6.90 L', weeks: '9 weeks',  desc: 'Strategy baked in: stakeholder interviews, competitor research, full IA. ' },
  'offer 3': { name: 'Flagship',   price: '₹9.90 L', weeks: '14 weeks', desc: 'Deeper discovery, more screens, and a clickable prototype investors can use. ' }
};

// ── Run ONCE to install the trigger ──────────────────────────────────────────
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'onNewRow') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onNewRow')
    .timeBased()
    .everyMinutes(1)
    .create();
  // Reset the row counter so the next submission is caught fresh
  PropertiesService.getScriptProperties().deleteProperty('lastSentRow');
  Logger.log('Trigger installed and row counter reset.');
}

// ── Runs every minute ─────────────────────────────────────────────────────────
function onNewRow() {
  var sheet   = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var props    = PropertiesService.getScriptProperties();
  var lastSent = parseInt(props.getProperty('lastSentRow') || '1', 10);
  if (lastRow <= lastSent) return;

  // Process every new row since the last run (handles bursts)
  for (var r = lastSent + 1; r <= lastRow; r++) {
    try {
      sendConfirmation(sheet, r);
    } catch (err) {
      Logger.log('Row ' + r + ' error: ' + err.message);
    }
  }
  props.setProperty('lastSentRow', lastRow.toString());
}

function sendConfirmation(sheet, rowNum) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var values  = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = {};
  headers.forEach(function(h, i) { row[h.toString().trim().toLowerCase()] = values[i]; });

  var email    = (row['email']     || '').toString().trim();
  var fullName = (row['full name'] || '').toString().trim();
  var offerRaw = (row['offer']     || '').toString().trim();

  if (!email || !email.includes('@')) { Logger.log('Row ' + rowNum + ': no email, skipped'); return; }

  var firstName = fullName.split(' ')[0] || 'there';
  var offerData = OFFER_MAP[offerRaw.toLowerCase().substring(0, 7)] || null;
  var htmlBody  = buildEmail(firstName, offerData);

  GmailApp.sendEmail(email, 'Your app brief is with us — Design Asylum', plainText(firstName, offerData), {
    htmlBody: htmlBody,
    name:     'Design Asylum',
    replyTo:  'accounts@designasylum.in'
  });
  Logger.log('Sent to ' + email + ' (' + (offerData ? offerData.name : 'no offer') + ')');
}

// ── HTML email (template embedded — no extra file required) ──────────────────
function buildEmail(firstName, offerData) {
  var F   = escHtml(firstName);
  var FAM = "-apple-system,BlinkMacSystemFont,\"Segoe UI\",Helvetica,Arial,sans-serif";

  var offerCard = '';
  if (offerData) {
    offerCard =
      '<tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:32px 40px 8px 40px;">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E6E6E6;border-radius:12px;">' +
          '<tr><td style="padding:20px 24px;">' +
            '<p style="margin:0 0 4px 0;font-family:' + FAM + ';font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#666666;">You picked</p>' +
            '<p style="margin:0 0 6px 0;font-family:' + FAM + ';font-size:20px;font-weight:800;color:#0A0A0A;">' +
              escHtml(offerData.name) + ' &mdash; ' + escHtml(offerData.price) + ' / ' + escHtml(offerData.weeks) +
            '</p>' +
            '<p style="margin:0;font-family:' + FAM + ';font-size:14px;line-height:1.55;color:#2E2E2E;">' +
              escHtml(offerData.desc) + 'Fixed scope, fixed fee &mdash; the price you see is the price you sign.' +
            '</p>' +
          '</td></tr>' +
        '</table>' +
      '</td></tr>';
  }

  var GRID = 'background-image:linear-gradient(to right,rgba(255,255,255,0.08) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.08) 1px,transparent 1px);background-size:64px 64px;';

  return [
    '<!DOCTYPE html><html lang="en"><head>',
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="color-scheme" content="light only">',
    '<style>',
    '@media only screen and (max-width:620px){',
    '.container{width:100% !important;}',
    '.px{padding-left:20px !important;padding-right:20px !important;}',
    '.h1{font-size:24px !important;line-height:1.15 !important;}',
    '.hero-p{font-size:14px !important;}',
    '.offer-title{font-size:17px !important;}',
    '.wa-pill{padding:10px 18px !important;}',
    '.brand-chip{font-size:10px !important;padding:5px 10px !important;}',
    '.guarantee-pad{padding:18px 16px !important;}',
    '.footer-left,.footer-right{display:block !important;width:100% !important;text-align:left !important;padding-bottom:8px !important;}',
    '}',
    '</style></head>',
    '<body style="margin:0;padding:0;background-color:#F2F2F0;">',

    // Preheader
    '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">A design lead is reviewing your brief. You\'ll hear from us within 24 hours.</div>',

    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F2F2F0;">',
    '<tr><td align="center" style="padding:32px 12px;">',
    '<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">',

    // Header
    '<tr><td bgcolor="#0038FF" style="background-color:#0038FF;' + GRID + 'border-radius:16px 16px 0 0;padding:28px 40px;" class="px">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>',
    '<td align="left" valign="middle">',
    '<img src="https://mobileapps.designasylum.in/assets/images/logo-da-mark-inverse.png" alt="Design Asylum" width="36" style="display:inline-block;vertical-align:middle;border:0;">',
    '<span style="font-family:' + FAM + ';font-size:16px;font-weight:700;color:#FFFFFF;vertical-align:middle;padding-left:10px;">design asylum</span>',
    '</td>',
    '<td align="right" valign="middle"><span style="font-family:' + FAM + ';font-size:11px;letter-spacing:1px;color:#D6FF3D;text-transform:uppercase;">Brief received</span></td>',
    '</tr></table></td></tr>',

    // Hero
    '<tr><td bgcolor="#0038FF" style="background-color:#0038FF;' + GRID + 'padding:8px 40px 40px;" class="px">',
    '<h1 class="h1" style="margin:0 0 14px 0;font-family:' + FAM + ';font-size:30px;line-height:1.1;font-weight:800;color:#FFFFFF;">Good move, ' + F + '.</h1>',
    '<p class="hero-p" style="margin:0;font-family:' + FAM + ';font-size:15px;line-height:1.6;color:#E2E2FF;">',
    'You\'ve just done what most founders postpone for months &mdash; put your app on a real timeline. ',
    'Your brief is with a design lead right now. <strong style="color:#D6FF3D;">We\'ll reach out within 24 hours</strong>, usually much sooner.',
    '</p></td></tr>',

    // Offer card (or empty string)
    offerCard,

    // What happens next
    '<tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:28px 40px 8px 40px;" class="px">',
    '<h2 style="margin:0 0 16px 0;font-family:' + FAM + ';font-size:18px;font-weight:800;color:#0A0A0A;">What happens next</h2>',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">',

    '<tr>',
    '<td width="40" valign="top" style="padding:0 0 18px 0;"><span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background-color:#D6FF3D;border-radius:50%;font-family:' + FAM + ';font-size:13px;font-weight:800;color:#0A0A0A;">1</span></td>',
    '<td valign="top" style="padding:2px 0 18px 0;font-family:' + FAM + ';font-size:14px;line-height:1.55;color:#2E2E2E;"><strong style="color:#0A0A0A;">Within 24 hours</strong> &mdash; our design lead calls you for a 30-minute scope conversation. No pitch, just your product.</td>',
    '</tr>',

    '<tr>',
    '<td width="40" valign="top" style="padding:0 0 18px 0;"><span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background-color:#D6FF3D;border-radius:50%;font-family:' + FAM + ';font-size:13px;font-weight:800;color:#0A0A0A;">2</span></td>',
    '<td valign="top" style="padding:2px 0 18px 0;font-family:' + FAM + ';font-size:14px;line-height:1.55;color:#2E2E2E;"><strong style="color:#0A0A0A;">Within 48 hours</strong> &mdash; you get a one-page scoping doc and a fixed-fee contract. Read it, question it, sign when you\'re ready.</td>',
    '</tr>',

    '<tr>',
    '<td width="40" valign="top"><span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;background-color:#D6FF3D;border-radius:50%;font-family:' + FAM + ';font-size:13px;font-weight:800;color:#0A0A0A;">3</span></td>',
    '<td valign="top" style="padding:2px 0 0 0;font-family:' + FAM + ';font-size:14px;line-height:1.55;color:#2E2E2E;"><strong style="color:#0A0A0A;">The day you sign</strong> &mdash; the clock starts. Scope locks in week one, and your app is dev-ready in 6 weeks.</td>',
    '</tr>',

    '</table></td></tr>',

    // WhatsApp CTA
    '<tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:28px 40px;" class="px" align="center">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>',
    '<td align="center" class="wa-pill" style="background-color:#25D366;border-radius:999px;padding:10px 28px;">',
    '<a href="https://wa.me/918256879792?text=Hi%20Design%20Asylum%2C%20I%20just%20filled%20the%20form%20on%20your%20site.%20Can%20we%20talk%20about%20my%20app%3F" style="display:inline-block;font-family:' + FAM + ';font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">',
    'Can\'t wait? Chat with us on WhatsApp</a>',
    '</td></tr></table>',
    '<p style="margin:10px 0 0 0;font-family:' + FAM + ';font-size:12px;color:#666666;">We typically reply within minutes.</p>',
    '</td></tr>',

    // Proof + logos
    '<tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:0 40px 28px 40px;" class="px" align="center">',
    '<p style="margin:0 0 18px 0;font-family:' + FAM + ';font-size:13px;line-height:1.6;color:#666666;">',
    '50 apps shipped in 5 years &mdash; for the world\'s largest companies and founders like you.<br>',
    'Apps we designed have 10M+ downloads and 4.5&#9733;+ store ratings.</p>',
    '<div style="text-align:center;">',
    ['Kia','Abbott','Axis Bank','Godrej','Michelin'].map(function(b){
      return '<span class="brand-chip" style="display:inline-block;margin:3px;padding:7px 14px;border:1px solid #E6E6E6;border-radius:999px;font-family:' + FAM + ';font-size:12px;font-weight:700;letter-spacing:1px;color:#0A0A0A;text-transform:uppercase;">' + b + '</span>';
    }).join(''),
    '</div></td></tr>',

    // Guarantee strip
    '<tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:0 40px 36px 40px;" class="px">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0A0A0A;border-radius:12px;">',
    '<tr><td bgcolor="#0A0A0A" class="guarantee-pad" style="padding:24px 28px;">',
    '<p style="margin:0 0 14px 0;font-family:' + FAM + ';font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#D6FF3D;">Three things we guarantee. In writing.</p>',
    '<p style="margin:0 0 10px 0;font-family:' + FAM + ';font-size:14px;line-height:1.5;color:#FFFFFF;"><strong>01</strong> &nbsp;8 of 10 real users complete your core flow in testing.</p>',
    '<p style="margin:0 0 10px 0;font-family:' + FAM + ';font-size:14px;line-height:1.5;color:#FFFFFF;"><strong>02</strong> &nbsp;100% clickable prototype &mdash; every screen, every state.</p>',
    '<p style="margin:0;font-family:' + FAM + ';font-size:14px;line-height:1.5;color:#FFFFFF;"><strong>03</strong> &nbsp;On time &mdash; or every extra week is on us.</p>',
    '</td></tr></table></td></tr>',

    // Footer
    '<tr><td style="background-color:#0A0A0A;border-radius:0 0 16px 16px;padding:26px 40px;" class="px">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>',
    '<td align="left" valign="middle" class="footer-left">',
    '<img src="https://mobileapps.designasylum.in/assets/images/logo-da-mark-inverse.png" alt="Design Asylum" width="26" style="display:inline-block;vertical-align:middle;border:0;">',
    '<span style="font-family:' + FAM + ';font-size:12px;color:#AAAAAA;vertical-align:middle;padding-left:8px;">Pune &middot; Dubai &middot; New Jersey</span>',
    '</td>',
    '<td align="right" valign="middle" class="footer-right">',
    '<a href="mailto:accounts@designasylum.in" style="font-family:' + FAM + ';font-size:12px;color:#FFFFFF;text-decoration:underline;">accounts@designasylum.in</a>',
    '</td></tr></table>',
    '<p style="margin:14px 0 0 0;font-family:' + FAM + ';font-size:11px;color:#666666;">&copy; 2026 Design Asylum Studio. You\'re receiving this because you submitted the form at mobileapps.designasylum.in.</p>',
    '</td></tr>',

    '</table></td></tr></table></body></html>'
  ].join('\n');
}

function plainText(firstName, offerData) {
  var lines = ['Hi ' + firstName + ',', '',
    "Good move. You've done what most founders postpone for months — put your app on a real timeline.",
    "Your brief is with a design lead. We'll reach out within 24 hours.", ''];
  if (offerData) {
    lines.push('Plan: ' + offerData.name + ' — ' + offerData.price + ' / ' + offerData.weeks);
    lines.push(offerData.desc + 'Fixed scope, fixed fee.', '');
  }
  lines.push("Can't wait? WhatsApp: https://wa.me/918256879792", '', '— Design Asylum', 'accounts@designasylum.in');
  return lines.join('\n');
}

function escHtml(s) {
  return s.toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
