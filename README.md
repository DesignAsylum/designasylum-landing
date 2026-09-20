# CODING AGENTS: READ THIS FIRST

This is a **handoff bundle** from Claude Design (claude.ai/design).

A user mocked up designs in HTML/CSS/JS using an AI design tool, then exported this bundle so a coding agent can implement the designs for real.

## Pages in this repo

One repo, one page per service subdomain. Each page is a single self-contained
HTML file with the design system inlined, so a deploy is just uploading that
file plus its `assets/` folder to the right docroot.

| Page | File | Domain |
| --- | --- | --- |
| Mobile app design | `mobileapps/index.html` | `mobileapps.designasylum.in` (Hostinger) |
| Content marketing | `content-marketing/index.html` | Vercel preview, domain undecided |

Each page owns its assets, at `<page>/assets/images/` and `<page>/assets/videos/`,
so the two sites never share a file and can diverge freely. That layout is what
lets one Vercel project per subdomain point at a different Root Directory in
this one repo.

Assets were historically kept out of git and uploaded to the web host by hand.
That changes as pages move to Vercel, which deploys from git: an asset that is
not committed does not exist on the deployed site.

### Vercel routing

`vercel.json` serves `content-marketing/index.html` at the deployment root, so
the preview URL is the bare domain. Because the page is served from the root,
its relative paths resolve to `/assets/...`, which is why a rewrite maps that
onto the page's own `content-marketing/assets/` folder. Vercel takes the first
matching rewrite, so the two logo lines sit above the catch-all and keep
working from `project/ds/assets` regardless of what has been uploaded.

`.vercelignore` keeps everything else out of the deployment, including the
mobile app page while it still lives on Hostinger. Its patterns follow
gitignore rules, so a bare filename matches at every level, not just the repo
root.

### Adding another service page

Copy the closest existing page into a new folder, then change the `<title>`,
the meta description, the canonical URL, the Open Graph tags and the JSON-LD
block at the top. Leave the `<style>` block alone. It is byte-identical across
pages on purpose, so a design-system change can be diffed and copied cleanly.

Leads from every page post to the same Apps Script endpoint. Each page prefixes
its `source` field with the page name (`Content Marketing | Hero ...`) so the
spreadsheet stays readable without a schema change.

## What you should do — IMPORTANT

**Read the chat transcripts first.** There are 3 chat transcript(s) in `chats/`. The transcripts show the full back-and-forth between the user and the design assistant — they tell you **what the user actually wants** and **where they landed** after iterating. Don't skip them. The final HTML files are the output, but the chat is where the intent lives.

**Read `project/Landing Page.html` in full.** The user had this file open when they triggered the handoff, so it's almost certainly the primary design they want built. Read it top to bottom — don't skim. Then **follow its imports**: open every file it pulls in (shared components, CSS, scripts) so you understand how the pieces fit together before you start implementing.

**If anything is ambiguous, ask the user to confirm before you start implementing.** It's much cheaper to clarify scope up front than to build the wrong thing.

## About the design files

The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

**Don't render these files in a browser or take screenshots unless the user asks you to.** Everything you need — dimensions, colors, layout rules — is spelled out in the source. Read the HTML and CSS directly; a screenshot won't tell you anything they don't.

## Bundle contents

- `README.md` — this file
- `chats/` — conversation transcripts (read these!)
- `project/` — the `Mobile app landing page` project files (HTML prototypes, assets, components)

## Lead form spam protection (live site)

The live `index.html` posts leads to a Google Apps Script web app (`Code.gs` in
this repo is its source of record). The `/exec` URL is public — anyone reading
the page source can POST to it directly — so the real gate is Cloudflare
Turnstile, verified **server-side** in `Code.gs`. A submission without a valid
token is hard-blocked and logged to the spreadsheet's "Blocked Log" tab.

Changes to `Code.gs` do nothing until deployed. One-time setup / redeploy:

1. Open the Apps Script project behind the `/exec` URL and paste the full
   contents of `Code.gs` over the existing script.
2. Project Settings → Script Properties → add `TURNSTILE_SECRET` = the
   **secret key** from the Cloudflare Turnstile dashboard (same widget as the
   site key already in `index.html`). Never commit the secret to this repo.
3. Deploy → Manage deployments → ✏️ → Version "New version" → Deploy. This
   keeps the same `/exec` URL, so `index.html` needs no change.
4. Upload the updated `index.html` to the web host.

Until the `TURNSTILE_SECRET` property is set, the script runs in the old
fail-open mode: suspicious leads are flagged in "Blocked Log" but still saved.
