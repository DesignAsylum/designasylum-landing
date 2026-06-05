// ─────────────────────────────────────────────────────────────────────────────
// Design Asylum — Lead Confirmation Email
// Sends a branded HTML email to the lead when a new row is added to the sheet.
//
// SETUP (one-time):
//   1. Paste this file into Extensions → Apps Script
//   2. Click Run → installTrigger
//   3. Approve the permissions prompt
// ─────────────────────────────────────────────────────────────────────────────

// Run this ONCE to install the trigger. Never needs to run again.
function installTrigger() {
  // Remove any existing onChange triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'onNewRow') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('onNewRow')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onChange()
    .create();

  Logger.log('Trigger installed successfully.');
}

// ── Main trigger handler ──────────────────────────────────────────────────────
function onNewRow(e) {
  if (e.changeType !== 'INSERT_ROW') return;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // Read headers from row 1 and data from the last row
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values  = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Map headers → values (case-insensitive, trimmed)
  const row = {};
  headers.forEach(function(h, i) {
    row[h.toString().trim().toLowerCase()] = values[i];
  });

  const email    = (row['email']        || '').toString().trim();
  const fullName = (row['full name']    || 'there').toString().trim();
  const offer    = (row['offer']        || 'your selected plan').toString().trim();
  const phone    = (row['phone number'] || '').toString().trim();

  if (!email || !email.includes('@')) {
    Logger.log('No valid email in row ' + lastRow + '. Skipping.');
    return;
  }

  const subject  = 'We received your request — Design Asylum';
  const htmlBody = buildEmailHTML(fullName, offer, email, phone);

  GmailApp.sendEmail(email, subject, stripHtml(htmlBody), {
    htmlBody: htmlBody,
    name: 'Design Asylum',
    replyTo: 'accounts@designasylum.in'
  });

  Logger.log('Confirmation email sent to ' + email);
}

// ── HTML email template ───────────────────────────────────────────────────────
function buildEmailHTML(name, offer, email, phone) {
  return '<!DOCTYPE html>' +
'<html lang="en">' +
'<head>' +
'  <meta charset="UTF-8">' +
'  <meta name="viewport" content="width=device-width,initial-scale=1">' +
'  <title>We received your request</title>' +
'</head>' +
'<body style="margin:0;padding:0;background:#f2f2f2;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">' +

'<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2;padding:48px 16px;">' +
'<tr><td align="center">' +

  // ── Card ──────────────────────────────────────────────────────────────────
  '<table cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12);">' +

    // Header — dark
    '<tr><td style="background:#0a0a0a;padding:36px 44px 28px;">' +
      '<p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Design Asylum</p>' +
      '<p style="margin:5px 0 0;font-size:11px;color:rgba(255,255,255,0.38);letter-spacing:0.1em;text-transform:uppercase;">Mobile App Design Studio</p>' +
    '</td></tr>' +

    // Blue accent stripe
    '<tr><td style="background:#0038FF;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>' +

    // Hero headline — dark
    '<tr><td style="background:#0a0a0a;padding:28px 44px 44px;">' +
      '<h1 style="margin:0 0 10px;font-size:38px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;line-height:1.05;">Your enquiry<br>is with us.</h1>' +
      '<p style="margin:0;font-size:15px;color:rgba(255,255,255,0.45);line-height:1.6;">We\'ll get back to you within 24 hours.</p>' +
    '</td></tr>' +

    // Body — white
    '<tr><td style="background:#ffffff;padding:40px 44px 0;">' +
      '<p style="margin:0 0 20px;font-size:16px;color:#0a0a0a;line-height:1.6;">Hi <strong>' + name + '</strong>,</p>' +
      '<p style="margin:0 0 28px;font-size:15px;color:#555555;line-height:1.7;">Thank you for reaching out to Design Asylum. We\'ve received your details and our team will be in touch shortly to discuss your project.</p>' +

      // Summary box
      '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7f7;border-radius:12px;margin:0 0 28px;">' +
        '<tr><td style="padding:22px 24px;">' +
          '<p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#aaa;letter-spacing:0.09em;text-transform:uppercase;">Plan Selected</p>' +
          '<p style="margin:0;font-size:18px;font-weight:700;color:#0a0a0a;letter-spacing:-0.01em;">' + offer + '</p>' +
        '</td></tr>' +
      '</table>' +

      '<p style="margin:0 0 32px;font-size:15px;color:#555555;line-height:1.7;">While you wait, you\'re welcome to browse our recent work or reach out directly at any time.</p>' +

      // CTA button
      '<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 40px;">' +
        '<tr><td style="background:#0038FF;border-radius:50px;padding:0;">' +
          '<a href="https://mobileapps.designasylum.in" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.01em;">View Our Work &rarr;</a>' +
        '</td></tr>' +
      '</table>' +
    '</td></tr>' +

    // Divider
    '<tr><td style="background:#ffffff;padding:0 44px;">' +
      '<hr style="border:none;border-top:1px solid #eeeeee;margin:0;">' +
    '</td></tr>' +

    // Footer
    '<tr><td style="background:#ffffff;padding:28px 44px 36px;">' +
      '<table width="100%" cellpadding="0" cellspacing="0">' +
        '<tr>' +
          '<td valign="top">' +
            '<p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#0a0a0a;">Design Asylum</p>' +
            '<p style="margin:0;font-size:13px;color:#aaa;line-height:1.8;">' +
              '<a href="mailto:accounts@designasylum.in" style="color:#0038FF;text-decoration:none;">accounts@designasylum.in</a><br>' +
              '<a href="https://mobileapps.designasylum.in" style="color:#0038FF;text-decoration:none;">mobileapps.designasylum.in</a>' +
            '</p>' +
          '</td>' +
          '<td align="right" valign="top">' +
            '<p style="margin:0;font-size:11px;color:#cccccc;line-height:1.7;text-align:right;">You received this because<br>you submitted a form on<br>our website.</p>' +
          '</td>' +
        '</tr>' +
      '</table>' +
    '</td></tr>' +

  '</table>' +
  // ── End card ──────────────────────────────────────────────────────────────

  '<p style="margin:20px 0 0;font-size:11px;color:#bbbbbb;text-align:center;">&copy; 2026 Design Asylum. All rights reserved.</p>' +

'</td></tr>' +
'</table>' +

'</body></html>';
}

// Plain-text fallback (strips all HTML tags)
function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s{2,}/g, ' ').trim();
}
