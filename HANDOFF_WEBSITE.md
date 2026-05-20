# Paste this into your other Claude terminal

---

You're picking up the JOGA+ Academy lead-capture system. The lead form is built and the Google Sheet backend is live and tested. Now I need you to **wire it into the website and ship it to production**.

## First: read these two files for full context

```
/Users/jorgeakeller/Projects/joga-plus/CLAUDE.md
/Users/jorgeakeller/.claude/plans/whats-the-script-enchanted-pearl.md
```

`CLAUDE.md` should auto-load if you `cd /Users/jorgeakeller/Projects/joga-plus` before starting.

## What's already done

- `apply.html` — premium 4-step application form, brand-styled (black + lime `#C5F73A`, Space Grotesk + Inter), mobile-first, multi-sport (Soccer / Footvolley / Tennis / Multi-sport)
- `integrations/google-sheets.gs` — Apps Script webhook, **deployed and live**, with email alerts to `Operations@jogaplusacademy.com` on every submission and a honeypot field for spam protection
- Webhook URL is wired into `apply.html` → `CONFIG.submitEndpoint` (Google Apps Script `/exec` endpoint)
- First test submission lands a row in the "JOGA+ Applications" Google Sheet → Applications tab ✅
- Logo: `images/joga-plus-logo.png`
- `admin-leads.html` — internal-only viewer reading from `localStorage` archive

## What's NOT done — your job

The site `jogaplusacademy.com` is **hosted on Vercel** with auto-deploy from the GitHub repo `jkellermartins/joga-plus`. The local repo at `/Users/jorgeakeller/Projects/joga-plus` has uncommitted changes (the entire apply form, admin page, and updates to `index.html` / `soccer.html` / `footvolley.html` / `tennis.html`). **Until those are pushed, nothing is live.**

### Tasks (do in order, ask before each destructive step)

1. **Run `git status` and show the user what's about to be committed.** Do NOT commit until they approve.

2. **Add a `vercel.json`** at repo root with:
   ```json
   {
     "cleanUrls": true,
     "trailingSlash": false
   }
   ```
   So `/apply` works without `.html`.

3. **Add an "Apply to Train" CTA** to the homepage hero in `index.html`. Bold lime button (`#C5F73A` on black, Space Grotesk uppercase) linking to `/apply`. Match the existing brand exactly — don't introduce new styles.

4. **Add the same CTA** to each sport landing page — `soccer.html`, `footvolley.html`, `tennis.html`. Bonus: link with `?sport=soccer` etc. (and tell me if `apply.html` doesn't yet pre-select sport from a query param — if not, add it: read `?sport=` from URL, find the matching radio in step 2, mark it checked).

5. **Commit + push.** Suggested message: `Add JOGA+ application form, admin leads page, and Apps Script webhook integration`. Vercel will auto-deploy in ~30s. Watch `vercel.com/dashboard`.

6. **Verify the live site:**
   - `https://jogaplusacademy.com/apply` loads correctly
   - Submit a real test — confirm a row lands in the Google Sheet AND an email alert arrives at `Operations@jogaplusacademy.com`
   - Test on mobile (most users will arrive via WhatsApp link)

7. **Generate a QR code image** pointing at `https://jogaplusacademy.com/apply` and save it to `images/qr-apply.png`. The user wants it for printed flyers and IG stories. Use any reliable method — `qrencode` CLI if available (`brew install qrencode`), or Python's `qrcode` lib.

## Constraints — important

- **NEVER push to git without explicit user approval first.** Production is live to real customers.
- **Don't change `Content-Type: text/plain;charset=utf-8`** on the webhook fetch — Apps Script CORS will break.
- **Don't add frameworks** (no React, no Next.js, no build steps). This is a plain static site by design.
- **Don't write new comments unless the WHY is non-obvious.**
- **Match the existing brand exactly** — black `#000000` bg, lime `#C5F73A` accent, Space Grotesk display + Inter body, generous spacing, premium-sport feel.
- **Test UI changes locally first:** `open /Users/jorgeakeller/Projects/joga-plus/<file>.html` before pushing.

## Suggested first reply to the user

> "I've read the brief. Before I push anything: I'm about to add `vercel.json` for clean URLs, add 'Apply to Train' CTAs on the homepage and three sport pages (with `?sport=` pre-fill), then commit and push to deploy on Vercel. Sound right? Any changes before I start?"

---

End of handoff.
