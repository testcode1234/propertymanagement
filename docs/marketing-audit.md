# Marketing Automation — Phase 0 Audit

_Audit date: 2026-09-27. No site code was changed in this phase._

## 1. Repo map

**Hosting:** GitHub Pages (`testcode1234/propertymanagement`, `main` branch, repo root). Domain `www.options-pm.com` via `CNAME`. DNS is at **GoDaddy** (`ns39/ns40.domaincontrol.com`), not Cloudflare. Responses come straight from GitHub's CDN (`server: GitHub.com`). No build step, no `.nojekyll`, no GitHub Actions, no `package.json`.

**Important consequence:** GitHub Pages publishes *every file in the repo*. `README.md`, `CHATBOT-README.md`, `chatbot-worker.js`, `blotter.html`, and `levels.html` all return HTTP 200 on the live domain today. Anything we add under `docs/`, `config/`, `drafts/`, `marketing/` will also be public unless we exclude it (see §5).

**Pages (35 HTML files, all flat at repo root):**

| Group | Files |
|---|---|
| Core | `index.html`, `owner-info.html`, `blog.html`, `listings.html` |
| Owner resources | `owner-portal`, `monthly-statements`, `reading-statements`, `maintenance`, `inspections`, `tax-documents`, `tax-deduction-guide`, `trust-accounting`, `onboarding-guide`, `owner-handbook`, `management-agreement`, `fee-schedule` |
| Tools | `roi-calculator`, `market-analysis` |
| Legal / compliance | `ca-rental-laws`, `fair-housing`, `lease-agreements` |
| Blog (12) | `blog-*.html` |
| Other | `san-diego-county-property-management-insights.html` |
| Unrelated to the business | `blotter.html`, `levels.html` (trading dashboards, `noindex`, auto-committed ~150 times) |

**Component loader (`components.js`):** on DOM ready it
1. `fetch`es `header.html` / `footer.html` into `#header-placeholder` / `#footer-placeholder`;
2. injects `chatbot.js`;
3. injects the Cloudflare Web Analytics beacon;
4. AJAX-binds any `form[action*="formspree.io"]` and swaps in an inline thank-you.

All 33 business pages include it correctly. Header/footer links are **relative** (`href="index.html"`) and loaded by relative path, so **new pages must stay at the repo root** (a page in a subfolder would break the header, footer, and nav). Phase 6 area pages need to follow that rule too, or the loader has to switch to root-absolute paths first.

## 2. Forms: where they submit today

| Page | Form | Endpoint | Spam | UTM / referrer |
|---|---|---|---|---|
| `index.html#contact` | "Request a Free Consultation" (name, email, phone, property, message) | Formspree `f/mwvdpagb` | Formspree `_gotcha` honeypot | none |
| `owner-portal.html` | Portal access request | same | honeypot | none |
| `blog.html` | Newsletter (email only) | same | honeypot | none |

- All three go to one Formspree inbox and reach Sean as email. Nothing reaches a CRM.
- No lead-type field, no Turnstile/captcha, no consent checkbox, no confirmation email to the lead.
- The newsletter signup sends a Formspree email only. No list is being built, and nothing sends a newsletter.
- JS-disabled fallback is a normal POST to Formspree, which is fine.

## 3. Analytics and tracking today

- **Cloudflare Web Analytics** (cookieless beacon, token hard-coded in `components.js`). It works without Cloudflare DNS.
- **No** GA4, GTM, Google Ads, or Meta Pixel on any page. No consent banner (none is needed yet, since nothing sets cookies).
- No conversion events of any kind.
- Phone and email are mostly **plain text**, not links. The header, footer, and homepage contact section have no `tel:`/`mailto:` links; only a few resource pages do. `phone_clicked` / `email_clicked` can't fire until these become links.

## 4. Existing chat widget

- `chatbot.js` is loaded on **every** page, including legal pages. It runs in **MOCK mode** (keyword-matched canned answers, no network calls).
- `chatbot-worker.js` is a written but **undeployed** Cloudflare Worker. Its model (`claude-haiku-4-5`) and system prompt are hard-coded. It sends single-turn messages (no conversation history), has no rate limiting, and on API errors echoes the upstream error `detail` back to the browser.
- It already shows a disclaimer: "Automated assistant. Don't share sensitive personal information."
- Phase 4 should replace this rather than add a second widget. The CORS, secret handling, and prompt caching in the Worker can be reused.

## 5. Broken or inconsistent pieces

**Compliance (blocking for paid ads)**
1. **No DRE license number anywhere.** The footer says "Licensed • Insured • Professional" with no number. Required before any ad landing page goes live.
2. **No privacy policy page.** Needed before Phase 1 tracking (CCPA/CPRA).
3. `listings.html` copy says "family-friendly neighborhood." Fair-housing trainers commonly flag this phrase as a familial-status preference. Recommend rewording.

**Branding ("20+ years")**
4. `blog-tenant-screening.html`: "In our nearly 10 years managing properties…"
5. `blog-self-managing-costs.html`: "…across San Diego County since 2015."
6. `README.md` says "Update 'Since 2015' references as years pass."
7. Footer copyright is hard-coded `© 2025`.

**SEO**
8. **No canonical tags** on any page.
9. **10 pages have no meta description:** `blog.html`, `blog-ca-law-updates`, `blog-market-outlook-2025`, `owner-info`, `owner-portal`, `inspections`, `maintenance`, `monthly-statements`, `tax-documents`, `san-diego-county-…-insights`.
10. **18 business pages lack Open Graph tags** (more lack Twitter tags), including `blog.html`, `owner-info.html`, and `fee-schedule.html`.
11. **Sitemap is missing 14 public pages:** `fee-schedule`, `ca-rental-laws`, `fair-housing`, `lease-agreements`, `management-agreement`, `market-analysis`, `onboarding-guide`, `owner-handbook`, `reading-statements`, `roi-calculator`, `tax-deduction-guide`, `trust-accounting`, `san-diego-county-…-insights`, `blog-market-outlook-2025`. Its `lastmod` dates are stale and it's hand-maintained.
12. Homepage schema is `RealEstateAgent` with address, phone, email, URL, and `areaServed`, but no license number and no `Service` markup. Other pages have no business schema.
13. The only `<h1>` on each page is the brand name inside the JS-injected header. Most pages have no `<h1>` of their own in their initial HTML.
14. `listings.html` and the insights page aren't in the nav. Each is reachable only from one or two blog posts.

**Hygiene**
15. `blotter.html` / `levels.html` (personal trading dashboards) are publicly served on the business domain, and their auto-commits dominate `main`'s history. I'd move them to a separate repo. That's your call, and nothing else here depends on it.
16. `README.md` is out of date (says 5 blog posts / 16 files) and publicly served.

## 6. Proposed serverless approach

GitHub Pages can't run server code, so `/api/lead`, `/api/chat`, and `/api/estimate` need to live elsewhere. The existing Worker draft already points at **Cloudflare Workers**. I recommend one Worker that handles all three routes.

**Option A (recommended): move DNS to Cloudflare (free plan), keep GitHub Pages as origin.**
- Proxy `www.options-pm.com` through Cloudflare and attach the Worker to the route `www.options-pm.com/api/*`. The site calls **same-origin** `POST /api/lead` exactly as the brief specifies: no CORS, no third-party URL in the page.
- Turnstile, rate limiting, KV/D1 (for the failed-lead log and chat rate limits), and secrets all live in the same account.
- Side benefit: Cloudflare's edge certificate covers the bare apex, which fixes the long-standing `https://options-pm.com` cert warning.
- Cost: $0 at this traffic level, apart from Anthropic and rent-API usage.
- Risk: it's a nameserver change at GoDaddy. Records must be copied exactly (including any email/MX records) and SSL mode set to **Full**. About 30 minutes of work plus propagation; I'd walk through it with you.

**Option B (no DNS change): Worker on `*.workers.dev`.**
- Pages call `https://opm-api.<account>.workers.dev/api/lead` cross-origin with CORS locked to our domain.
- It works, but ad-blockers and privacy extensions sometimes block `workers.dev` calls. A custom `api.options-pm.com` hostname isn't possible without Cloudflare DNS.

The brief lists "existing FastAPI server" as an example hosting option. There is no FastAPI server for this site (confirmed by Sean), so Cloudflare Workers it is.

**Worker internals (both options):** Wrangler project, ES modules, no framework. Secrets via `wrangler secret put` (`ANTHROPIC_API_KEY`, `CRM_API_KEY`, `EMAIL_API_KEY`, `RENT_API_KEY`, `TURNSTILE_SECRET`). Non-secret config (`CHAT_MODEL=claude-sonnet-5`, booking URL, notify address) in `wrangler.toml` `[vars]`. The chat system prompt is bundled from `config/chat-system-prompt.md` at deploy time.

## 7. Proposed file / folder layout

```
/                              existing pages stay here; new public pages also go at root
  components.js                extended: loads consent.js, tracking.js, lead-forms.js
  chatbot.js                   replaced in Phase 4 (same filename, loader unchanged)
  privacy.html                 NEW (Phase 1)
  rental-estimate.html         NEW (Phase 3)
  review.html, refer.html      NEW (Phase 7)
  property-management-<area>.html   GENERATED (Phase 6)
  js/
    consent.js                 consent banner + gating of non-essential tags
    tracking.js                event taxonomy, first-touch UTM persistence
    lead-forms.js              posts every form to /api/lead, Turnstile, thank-you
  config/
    marketing.json             public, non-secret IDs (GA4, Ads, Pixel, booking URL, DRE #)
    chat-system-prompt.md      editable prompt (bundled into Worker, not fetched by browser)
worker/                        Cloudflare Worker (replaces chatbot-worker.js)
  wrangler.toml
  src/index.js                 router: /api/lead, /api/chat, /api/estimate
  src/lead.js  src/chat.js  src/estimate.js
  src/lib/ (validate, turnstile, crm, email, ratelimit)
data/service-areas.json        Phase 6
templates/area-page.html       Phase 6
scripts/                       Node (matches the JS-only repo; no Python currently)
  build-areas.mjs              generates area pages + rewrites sitemap.xml
  build-sitemap.mjs            sitemap from all public pages (fixes finding 11)
  draft-market-update.mjs      Phase 8
data/market-update.json        Phase 8 input Sean edits
drafts/YYYY-MM/                Phase 8 output
marketing/sequences/*.md       Phase 5
docs/*.md
_config.yml                    NEW: Jekyll `exclude:` for worker/, scripts/, templates/,
                               drafts/, marketing/, docs/, data/, *.md so they are
                               NOT published by GitHub Pages
```

Notes:
- **`drafts/` must never be published.** The `_config.yml` exclude keeps it off the live site even after it's merged. Phase 8's monthly Action would open a PR, so drafts are reviewed before anything is copied into a live page.
- `config/marketing.json` is intentionally public (tracking IDs and the booking link are visible in page source anyway). The Worker gets the same values through `[vars]`, so there's one place to edit per environment. I'll keep them in sync with a small check in the build script.
- Scripts are in **Node, not Python**, to match the repo. The brief allowed either.

## 8. Decisions and inputs needed before Phase 1

1. ~~**Hosting:**~~ **Decided 2026-09-27: Option A. Completed 2026-09-28:** DNS is live on Cloudflare, proxied, SSL mode Full; redirects and apex cert verified. DNS moves from GoDaddy to Cloudflare (free plan), with GitHub Pages as the origin and the Worker on `www.options-pm.com/api/*`.
2. **Privacy policy:** OK to draft `privacy.html` in Phase 1? You or counsel would review it; it's a template, not legal advice.
3. **GTM vs direct gtag:** GTM makes adding tags later easier without code changes. Direct gtag is lighter and easier to audit. I lean **direct gtag.js + Meta Pixel** behind the consent banner, since you're the only one managing tags. Tell me if someone else (an agency) will manage tags.
4. **Branding fixes (findings 4–7, 3):** fix these in Phase 1 as housekeeping, or handle separately?
5. **`blotter.html` / `levels.html`:** leave as-is, or move to another repo?
6. **Brief inputs table:** Phase 1 needs the **GA4 ID, Ads conversion ID, Meta Pixel ID, and DRE license number**. The rest can wait until Phase 2.
