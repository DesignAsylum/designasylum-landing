#!/usr/bin/env python3
"""Apply the lead-form spam-hardening edits to index.html.

Idempotent and deterministic: each edit asserts its anchor is present exactly
once. Run this once on a checkout whose index.html still lacks the honeypot /
timing changes (i.e. matches origin/main), then commit + push.

This helper exists only because index.html (182 KB) could not be pushed through
the API channel; once the change lands, delete this file in the same commit.

Pairs with the server-side checks already in recaptcha-gatekeeper.gs.
"""
import sys

PATH = sys.argv[1] if len(sys.argv) > 1 else "index.html"

# (description, old, new) — old must appear exactly once.
EDITS = [
    (
        "honeypot on the 30s popup form",
        '    <form class="lead-popup__form" id="lead-popup-form" onsubmit="handlePopupSubmit(event)">\n'
        '      <div class="lead-popup__field">',
        '    <form class="lead-popup__form" id="lead-popup-form" onsubmit="handlePopupSubmit(event)">\n'
        '      <!-- Honeypot — hidden from real users, filled by bots -->\n'
        '      <input type="text" id="popup-honeypot" name="_h" style="display:none" tabindex="-1" autocomplete="off">\n'
        '      <div class="lead-popup__field">',
    ),
    (
        "stamp open-time when the 30s popup opens",
        "      overlay.classList.add('is-open');\n"
        "      overlay.removeAttribute('aria-hidden');\n"
        "      closeBtn.focus();\n"
        "    }",
        "      overlay.classList.add('is-open');\n"
        "      overlay.removeAttribute('aria-hidden');\n"
        "      closeBtn.focus();\n"
        "      window._popupOpenedAt = Date.now(); // for the server-side time-trap\n"
        "    }",
    ),
    (
        "stamp open-time when the CTA popup opens",
        "      ctaOverlay.classList.add('is-open');\n"
        "      ctaOverlay.removeAttribute('aria-hidden');\n"
        "      document.getElementById('cta-name').focus();\n"
        "    }",
        "      ctaOverlay.classList.add('is-open');\n"
        "      ctaOverlay.removeAttribute('aria-hidden');\n"
        "      document.getElementById('cta-name').focus();\n"
        "      window._ctaOpenedAt = Date.now(); // for the server-side time-trap\n"
        "    }",
    ),
    (
        "CTA payload: send honeypot value + _elapsed",
        "        source:    window._ctaSource || 'Unknown button',\n"
        "        _h:        document.getElementById('cta-honeypot').value\n"
        "      };",
        "        source:    window._ctaSource || 'Unknown button',\n"
        "        _h:        document.getElementById('cta-honeypot').value,\n"
        "        _elapsed:  window._ctaOpenedAt ? (Date.now() - window._ctaOpenedAt) : null\n"
        "      };",
    ),
    (
        "30s popup payload: read honeypot field + _elapsed",
        "      offer:     '',\n"
        "      source:    '30-second popup',\n"
        "      _h:        ''\n"
        "    };",
        "      offer:     '',\n"
        "      source:    '30-second popup',\n"
        "      _h:        document.getElementById('popup-honeypot').value,\n"
        "      _elapsed:  window._popupOpenedAt ? (Date.now() - window._popupOpenedAt) : null\n"
        "    };",
    ),
]

with open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

for desc, old, new in EDITS:
    if new in src and old not in src:
        print(f"  already applied: {desc}")
        continue
    n = src.count(old)
    if n != 1:
        print(f"ERROR: anchor for '{desc}' found {n} times (expected 1). Aborting.")
        sys.exit(1)
    src = src.replace(old, new)
    print(f"  applied: {desc}")

with open(PATH, "w", encoding="utf-8") as f:
    f.write(src)
print("Done.")
