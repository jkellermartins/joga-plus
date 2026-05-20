# JOGA+ Academy — Project Brief for Codex

You are helping ship the JOGA+ Academy lead-generation system. Read this whole file before doing anything.

## What this project is

A static website for **JOGA+ Academy**, a premium youth sports training program in the DMV (Washington D.C., Bethesda, Potomac, Rockville, Silver Spring, Georgetown). They run programs for **Soccer, Footvolley, and Tennis**. The owner is non-technical — explain things in plain language and ask before destructive actions.

- **Live domain:** `jogaplusacademy.com`
- **Host:** Vercel (auto-deploys from GitHub `main` branch)
- **GitHub repo:** `jkellermartins/joga-plus`
- **Local repo:** `/Users/jorgeakeller/Projects/joga-plus`
- **Owner email:** `Operations@jogaplusacademy.com`
- **WhatsApp number used in code:** `+1 (301) 818-1797`

## Brand system

- **Background:** `#000000`
- **Accent (neon lime):** `#C5F73A` — matches the `+` in the JOGA+ logo
- **Text:** `#FFFFFF`
- **Fonts:** `Space Grotesk` (display, weights 500–700) + `Inter` (body, 300–900)
- **Logo file:** `images/joga-plus-logo.png` (white wordmark with neon-green "+" and a soft white halo)

## Tech stack

Static HTML/CSS/JS. No framework, no build step. Edit files directly, commit, and Vercel deploys.

## File map (only the relevant ones)

| Path | Purpose |
|---|---|
| `apply.html` | The 4-step athlete application form (the lead-capture funnel). Multi-sport. |
| `admin-leads.html` | Internal-only page to view captured leads from localStorage archive. |
| `index.html` | Homepage. |
| `soccer.html` / `footvolley.html` / `tennis.html` | Per-sport landing pages. |
| `coaches.html` / `pickups.html` / `booking.html` / `results.html` | Other pages, unrelated to the apply funnel. |
| `images/joga-plus-logo.png` | Logo asset. |
| `integrations/google-sheets.gs` | Apps Script source for the webhook (paste into Google's editor; not executed locally). |

## Lead capture pipeline (already wired and live)

```
apply.html  ──POST(JSON, text/plain)──▶  Google Apps Script Web App  ──▶  Google Sheet
                                               │
                                               └─ "JOGA+ Applications" sheet
                                                  Applications tab → one row per submission
```

- **Webhook URL** (set in `apply.html` → `CONFIG.submitEndpoint`):
  `https://script.google.com/macros/s/AKfycbyAeH6UsViMaJF42DrZnR_ebT4vgjhx0xAVX-KIsAji4LdpVj9aM-nGWipS2KRpb3XL/exec`
- **Why `text/plain`:** Apps Script Web Apps reject the CORS preflight that `application/json` triggers. The script reads `e.postData.contents` as the JSON body either way. Don't change this.
- **Mailto fallback:** `apply.html` opens a pre-filled `mailto:Operations@jogaplusacademy.com` if the endpoint fails.
- **Local archive:** Each submission also stored in `localStorage` (rolling last 50) under key `joga_apply_submissions` — viewable via `admin-leads.html`.

### Form field schema (source of truth: `apply.html`)

| Field name | Step | Type | Required |
|---|---|---|---|
| `athleteName` | 1 | text | yes |
| `parentName` | 1 | text | conditional (if athlete < 18) |
| `phone` | 1 | tel | yes |
| `email` | 1 | email | yes |
| `age` | 1 | number 3–99 | yes |
| `sport` | 2 | radio: Soccer / Footvolley / Tennis / Multi-sport | yes |
| `level` | 2 | radio: Beginner / Intermediate / Advanced | yes |
| `goals` | 2 | checkbox (multi) | yes |
| `location` | 3 | radio (single) | yes |
| `availability` | 3 | checkbox (multi) | yes |
| `notes` | 4 | textarea | optional |
| `consent` | 4 | checkbox | yes |

Apps Script `HEADERS` and `appendRow` in `integrations/google-sheets.gs` must match these exactly.

## State as of last session

**Done:**
- Form built and styled (premium black + lime, mobile-first, multi-step with progress, draft auto-save, draft-restore)
- Logo wired in header + confirmation
- Apps Script written, pasted into a sheet titled "JOGA+ Applications", deployed as a Web App with access set to "Anyone"
- Webhook URL configured in `apply.html`
- First test submission successfully landed a row in the sheet ✅

**Pending — likely first thing to fix:**
1. **Apps Script needs to be re-deployed.** The currently deployed version uses the OLD field schema (footvolley-only headers like `Full Name`, `Locations`, `Played Before`, `Age Group`, `Commitment`, `Days`). The local `integrations/google-sheets.gs` has the correct new schema but the user hasn't pasted/redeployed yet. Symptom: most columns in the sheet's first row are empty.
   - **Fix:** Have the user paste the latest `integrations/google-sheets.gs` into Apps Script, save, `Deploy → Manage deployments → ✏️ → Version: New version → Deploy`. Then in the Sheet, **right-click the existing "Applications" tab → Delete** so the new headers regenerate on the next submission. Then submit a fresh test.

2. **Files not pushed to GitHub yet.** New: `apply.html`, `admin-leads.html`, `integrations/google-sheets.gs`, `images/joga-plus-logo.png`. Updated: `index.html`, `soccer.html`, `footvolley.html`, `tennis.html`. Until pushed, none of this is live on `jogaplusacademy.com`. **Do not push without explicit user approval.**

3. **No clean URLs.** The form will live at `/apply.html` until a `vercel.json` is added. Trivial to add; recommended.

4. **No "Apply" CTA on the homepage** linking to the form. Needs a bold lime button in the hero of `index.html` and probably each sport page.

## Optional system features (a–h) — discussed but NOT yet implemented

Pick which to ship based on what the user prioritizes:

| # | Feature | Effort | Impact |
|---|---|---|---|
| a | Email alert on submit (Apps Script `MailApp.sendEmail` to owner) | 5 min | high — speed-to-contact |
| b | Per-sport tabs in sheet (auto-route Soccer / Footvolley / Tennis) | 10 min | medium |
| c | Status column with dropdown (`New / Contacted / Trial Booked / Joined / Lost`) + "Last Contact" date | 5 min | medium — turns sheet into a CRM |
| d | Pre-filled sport links (`/apply?sport=soccer` skips step 2) | 10 min | high — better conversion + per-channel attribution |
| e | UTM tracking (`?utm_source=instagram` → column) | 5 min | medium — only useful with paid ads |
| f | Honeypot spam protection | 5 min | low pre-launch, high post-launch |
| g | Auto-reply email to applicant (branded confirmation + WhatsApp link) | 15 min | high — looks professional |
| h | QR-code share kit (printable QR pointing at `/apply` for jerseys, flyers, IG) | 5 min | high — free offline channel |

Owner's likely priorities tonight: **a + f + h** (email alerts, anti-spam, QR for offline) before shipping. Defer b, c, d, e, g until 5–10 real submissions have come in.

## Conventions and constraints

- **Don't push to git, force-push, or do anything destructive without explicit user approval.** Production goes to a real customer-facing domain.
- **Don't change the `Content-Type: text/plain;charset=utf-8` on the webhook fetch** — Apps Script CORS will break.
- **Test UI changes locally** before pushing: `open /Users/jorgeakeller/Projects/joga-plus/apply.html` (Mac).
- **The user is on macOS** — `pbcopy` works to load files into clipboard for paste flows (e.g. into Apps Script editor).
- **No frameworks.** Don't introduce React, build steps, or package managers — this is intentionally a plain static site.
- **No comments in code unless the WHY is non-obvious.**
- **Keep the brand tight.** Black background, lime `#C5F73A` accent, Space Grotesk + Inter, generous spacing, premium-sport feel (Nike/Adidas adjacent, not amateur club).

## Suggested first message to the user

> "Read AGENTS.md. Want me to start with re-deploying the Apps Script, pushing the repo to Vercel, or implementing one of the a–h features? And do you want a `vercel.json` so the form lives at `/apply` instead of `/apply.html`?"
