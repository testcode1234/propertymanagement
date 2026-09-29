# Tracking

Phase 1 of the marketing automation build. It covers analytics, ad conversion tracking, the consent banner, and campaign attribution.

## Files

| File | Role |
|---|---|
| `config/marketing.json` | Tracking IDs and booking URL. **This is the only file to edit** to turn tags on or off. Public by design, since these IDs are visible in page source anyway. |
| `js/consent.js` | Consent banner, stored choice, Global Privacy Control handling. |
| `js/tracking.js` | Loads GA4 / Google Ads / Meta Pixel after consent, defines the event taxonomy, records campaign attribution, auto-tracks phone/email/booking clicks. |
| `components.js` | Loads the two scripts above on every page, attaches attribution to forms, and fires `lead_form_submit`. |
| `footer.html` | Privacy Policy and "Your Privacy Choices" links. |
| `privacy.html` | Privacy policy (draft, pending review). |

## Configuration

```json
"tracking": {
  "ga4_id": "G-XXXXXXXXXX",
  "google_ads_id": "AW-XXXXXXXXXX",
  "google_ads_lead_label": "AbCdEfGhIj",
  "meta_pixel_id": "123456789012345"
}
```

- A blank ID means that tag never loads.
- While **all** IDs are blank (the current state), no consent banner is shown, because there's nothing to consent to.
- `google_ads_lead_label` comes from Google Ads → Goals → Conversions → your "Lead" conversion → Tag setup → "Use Google tag" → the part after the `/` in `send_to`.
- `booking_url` (top level) is used to recognize booking links for `booking_clicked`.

Cloudflare Web Analytics (cookieless, aggregate) is separate. It still loads on every page from `components.js` and isn't gated by consent. The privacy policy discloses it.

## Consent behavior

| Situation | Result |
|---|---|
| First visit, IDs configured | Banner appears (bottom-left; full width on phones). No Google/Meta requests. |
| Accept | Tags load immediately. Events fired earlier on the same page (up to 25) are sent. The choice is saved in `localStorage` (`opm_consent_v1`). |
| Decline | No tags, no banner on later pages. Queued events are dropped. |
| Browser sends Global Privacy Control | Treated as Decline, no banner. |
| "Your Privacy Choices" in footer / privacy page | Reopens the banner. Declining after accepting sets Google consent to denied, revokes Meta consent, and deletes `_ga*`, `_gid`, `_gcl*`, `_fbp`, `_fbc` cookies. |

## Event taxonomy

| Event | Fires when | Parameters | GA4 | Google Ads | Meta | Status |
|---|---|---|---|---|---|---|
| `lead_form_submit` | A form with `data-lead-type` submits successfully | `form_id`, `lead_type` | event | **conversion** (`send_to` ads id / label) | `Lead` | **Live:** homepage consultation form (`home-contact`, `owner`) |
| `phone_clicked` | Click on any `tel:` link | `link_location` | event | – | `Contact` | **Live** |
| `email_clicked` | Click on any `mailto:` link | `link_location` | event | – | `Contact` | **Live** |
| `booking_clicked` | Click on a link to the `booking_url` host, or any link with `data-booking-link` | `link_location` | event | – | `Schedule` | Ready. Fires once a booking URL/link exists (Phase 2). |
| `chat_started` | First message a visitor sends in the chat widget (once per page view) | – | event | – | – | **Live** |
| `chat_qualified` | Chat assistant has collected qualification details | TBD | event | – | – | Phase 4 |
| `estimate_started` | Visitor begins the rental estimate form | TBD | event | – | – | Phase 3 |
| `estimate_completed` | Estimate result shown | TBD | event | – | – | Phase 3 |

`link_location` is `header`, `footer`, `chat`, the `id` of the enclosing `<section>` (e.g. `contact`), or `body`.

Forms without `data-lead-type` (blog newsletter, owner portal access) don't fire `lead_form_submit`. They aren't new-client leads.

To fire an event from new code:

```js
if (window.opmTrack) window.opmTrack('estimate_started', { form_id: 'rental-estimate' });
```

Unknown event names are ignored, so add new events to `EVENTS` in `js/tracking.js` and to this table.

## Campaign attribution (first touch)

`js/tracking.js` records on every page view, whether or not consent was given. The data stays in the visitor's browser and reaches us only when they submit a form.

- **`opm_first_touch`**: set on the first visit and never overwritten while valid. Includes `source` (`campaign` or `direct`), any of `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, `gbraid`, `wbraid`, `fbclid`, an external `referrer`, `landing_page`, `ts`.
- **`opm_last_touch`**: the most recent visit that had campaign tags or an external referrer. It's overwritten each time.
- Both expire after 90 days.

`window.opmAttribution()` returns `{ first_touch, last_touch, page_url, referrer }`. The Formspree forms now include these as extra fields (`first_touch_utm_source`, `last_touch_gclid`, `page_url`, …), so they appear in the lead email. The Phase 2 `/api/lead` endpoint will send the same object to the CRM.

## GA4 setup (one-time, after adding the ID)

1. **Admin → Events:** once events arrive, mark `lead_form_submit` as a **key event**. Optionally mark `phone_clicked` and `booking_clicked` too.
2. **Admin → Custom definitions:** add event-scoped custom dimensions `lead_type`, `form_id`, `link_location` so they appear in reports.
3. **Admin → Data streams → Enhanced measurement:** leave on. Its outbound-click and form-interaction events are separate from ours and don't conflict.
4. Link Google Ads (Admin → Product links) so GA4 key events can be imported, but keep the direct Ads conversion as the primary "Lead" conversion to avoid double counting.

## How to verify

### GA4 DebugView

1. Open any page with `?opm_debug=1` added, e.g. `https://www.options-pm.com/?opm_debug=1&utm_source=test&utm_medium=debug`. This turns on GA4 `debug_mode` and logs each event to the browser console as `[opmTrack] …`.
2. Click **Accept** on the banner. If you accepted earlier, events flow straight away. If you declined earlier, use "Your Privacy Choices" in the footer.
3. In GA4 open **Admin → DebugView**. Within about 30 seconds your device appears with `page_view`.
4. Trigger each live event and confirm it appears with its parameters:
   - Click the phone number in the footer → `phone_clicked` (`link_location: footer`).
   - Click the email address in the footer → `email_clicked`.
   - Send a chat message → `chat_started`.
   - Submit the homepage "Request a Free Consultation" form → `lead_form_submit` (`form_id: home-contact`, `lead_type: owner`). Use a test name like "TEST – ignore"; it will reach the inbox.
5. In the lead email, confirm the `first_touch_utm_source: test` field is present.

### Google Ads

Google Ads → Goals → Conversions → your Lead conversion. Status moves to "Recording conversions" within a few hours of the first test submission. Tag Assistant (tagassistant.google.com) shows the `conversion` hit live.

### Meta

Events Manager → your Pixel → **Test events**. Enter the site URL, accept the banner, then trigger events and watch for `PageView`, `Contact`, and `Lead`.

### Consent checks

- Private window, first visit: DevTools → Network, filter `googletagmanager|facebook`. Nothing should load until **Accept**.
- Click **Decline**, then reload: still nothing, and no banner.
- A browser with GPC on (Brave, Firefox with the setting, DuckDuckGo): no banner, no tags.

### Automated check

A Playwright script covering all of the above (26 checks: consent gating, queued events, attribution, form fields, Ads conversion, Meta events, GPC, blank-ID mode, console errors) was run against a local copy with dummy IDs on 2026-09-28. All checks passed. It isn't committed yet. Ask if you want it added under `scripts/`.
