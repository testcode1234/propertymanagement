# Chat Widget — Prototype

A site-wide chat assistant for the Options Property Management website.

## Files

| File | What it is |
|---|---|
| `chatbot.js` | The chat widget (floating bubble + panel). Runs in the browser. |
| `chatbot-worker.js` | The backend proxy (Cloudflare Worker). Holds the API key, calls Claude. **Not deployed yet.** |
| `components.js` | Loads the widget on every page (one line added). |

## Current state: MOCK mode (free, no API key)

Right now the widget is in **mock mode** (`MOCK = true` in `chatbot.js`). It replies
with canned, keyword-matched answers grounded in the real site content. There are
**no network calls, no API key, and no cost**. Nothing can charge you while it's in
this state.

### Try it locally

It can't work over `file://` (the shared header/footer use `fetch`). Serve over HTTP:

```sh
cd /Users/seanadams/propertymanagement
python3 -m http.server 8765
```

Then open <http://localhost:8765/index.html> and click the 💬 bubble (bottom-right).
Ask things like "what are your fees?", "what areas do you serve?", "how do I get started?".

## Going live later (the only step that costs money)

Live mode swaps the canned answers for real Claude responses. It needs a funded
**Anthropic API key**. Steps:

1. **Get an API key** at <https://console.anthropic.com> and add a little credit
   (even $5 covers thousands of messages).
2. **Deploy the Worker** (Cloudflare account required; free tier):
   ```sh
   npm i -g wrangler
   wrangler login
   wrangler deploy chatbot-worker.js --name opm-chatbot
   wrangler secret put ANTHROPIC_API_KEY   # paste your key when prompted
   ```
   Wrangler prints a URL like `https://opm-chatbot.<you>.workers.dev`.
3. **Point the widget at it.** In `chatbot.js`:
   ```js
   var MOCK = false;
   var ENDPOINT = "https://opm-chatbot.<you>.workers.dev";
   ```
4. Commit and push. Done.

### Costs once live

| Item | Cost |
|---|---|
| Cloudflare Worker (the proxy) | **$0** — free tier covers ~100k requests/day |
| GitHub Pages hosting | **$0** — already free |
| Claude API usage | **pay-as-you-go** — a fraction of a cent per message on `claude-haiku-4-5` |

The model is set in `chatbot-worker.js` (`MODEL`). `claude-haiku-4-5` is the
cost-friendly default; switch to `claude-sonnet-4-6` for sharper answers at a
higher per-token rate.

## Notes

- The API key lives only in the Worker (as a Cloudflare secret), never in the
  browser or the repo.
- `ALLOWED_ORIGINS` in the Worker restricts which sites may call it — keep it
  set to your domains.
- The widget tells users not to share sensitive info; keep that disclaimer.
