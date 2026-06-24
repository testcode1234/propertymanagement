/* =====================================================================
   Options Property Management — Chat Worker (Cloudflare Worker)
   ---------------------------------------------------------------------
   This is the small backend that holds your Anthropic API key and talks
   to the Claude API on the browser's behalf. The key NEVER reaches the
   browser. The widget (chatbot.js) POSTs { message } here and gets back
   { reply }.

   DEPLOY (only when you're ready to go live — see CHATBOT-README.md):
     1. npm i -g wrangler  &&  wrangler login
     2. wrangler deploy chatbot-worker.js --name opm-chatbot
     3. wrangler secret put ANTHROPIC_API_KEY   (paste your key)
     4. Put the deployed URL into ENDPOINT in chatbot.js and set MOCK=false

   COST: Cloudflare Workers free tier covers ~100k requests/day ($0).
   The only spend is Claude API usage — fractions of a cent per message
   on the model below. Nothing here runs (or charges) until deployed.
   ===================================================================== */

// Cost-friendly default for a public FAQ widget. Swap to
// "claude-sonnet-4-6" for sharper answers at higher per-token cost.
const MODEL = "claude-haiku-4-5";

// Grounding: who the bot is and the facts it should rely on. Kept in the
// cache-stable prefix so prompt caching makes repeat requests cheap.
const SYSTEM_PROMPT = `You are the friendly website assistant for Options Property Management, a full-service residential property management company serving San Diego County, California, for over 20 years (based in Valley Center, CA).

Answer questions from property owners and prospective clients concisely and warmly. Use only the facts below plus general property-management knowledge. If you don't know something specific (exact fees for a given property, account details), say so and direct them to call (760) 651-2271 or email optionspropertymanagementsd@gmail.com.

FACTS:
- Services: tenant screening, rent collection, maintenance coordination, property inspections, monthly owner statements, marketing/listings, and California rental-law compliance.
- Areas served: all of San Diego County — North County (Escondido, San Marcos, Vista, Carlsbad, Oceanside, Encinitas), coastal San Diego, East County (El Cajon, Santee, La Mesa), and South Bay (Chula Vista, National City).
- Phone: (760) 651-2271. Email: optionspropertymanagementsd@gmail.com. Address: 28588 Cole Grade Rd #1353, Valley Center, CA 92082.
- Helpful pages: fee-schedule.html, owner-info.html, owner-portal.html, listings.html, onboarding-guide.html, ca-rental-laws.html, blog.html.
- Tone: professional, helpful, never pushy. Keep replies to a few sentences. Encourage a call for specifics.
- Never invent exact prices, legal advice, or account information.`;

// Lock CORS to your domains in production.
const ALLOWED_ORIGINS = [
  "https://www.options-pm.com",
  "https://options-pm.com",
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: "Invalid JSON" }, 400, cors);
    }

    const message = (body && body.message ? String(body.message) : "").slice(0, 2000);
    if (!message.trim()) {
      return json({ error: "Empty message" }, 400, cors);
    }

    try {
      const apiResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system: [
            {
              type: "text",
              text: SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" }, // cache the grounding prefix
            },
          ],
          messages: [{ role: "user", content: message }],
        }),
      });

      if (!apiResp.ok) {
        const detail = await apiResp.text();
        return json(
          { reply: "Sorry, I'm having trouble right now. Please call (760) 651-2271.", detail },
          502,
          cors
        );
      }

      const data = await apiResp.json();
      const textBlock = (data.content || []).find((b) => b.type === "text");
      const reply = textBlock ? textBlock.text : "Sorry, I couldn't generate a reply.";
      return json({ reply }, 200, cors);
    } catch (err) {
      return json(
        { reply: "Sorry, I'm having trouble connecting. Please call (760) 651-2271." },
        502,
        cors
      );
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, cors || {}),
  });
}
