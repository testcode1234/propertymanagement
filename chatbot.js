/* =====================================================================
   Options Property Management — Chat Widget (prototype)
   ---------------------------------------------------------------------
   Site-wide floating chat assistant. Injected on every page by
   components.js.

   MODES
   -----
   MOCK = true  -> replies are generated locally from canned answers.
                   No network calls, no API key, no cost. (current setting)
   MOCK = false -> messages are POSTed to ENDPOINT (the Cloudflare Worker
                   in chatbot-worker.js), which talks to the Claude API.

   To go live later: deploy chatbot-worker.js, set ENDPOINT to its URL,
   and set MOCK = false. Nothing here ever charges you on its own.
   ===================================================================== */
(function () {
  "use strict";

  // ---- Configuration -------------------------------------------------
  var MOCK = true; // <-- risk-free: no API calls while true
  var ENDPOINT = ""; // <-- set to your deployed Worker URL when going live

  var BRAND = {
    primary: "#1a4d7a",
    secondary: "#2c7bb5",
    accent: "#e8b44d",
    dark: "#1f2937",
    light: "#f9fafb",
    gray: "#6b7280",
  };

  var GREETING =
    "Hi! 👋 I'm the Options Property Management assistant. Ask me about our " +
    "services, fees, the areas we serve, or how to get started.";

  // ---- Canned answers used in MOCK mode ------------------------------
  // Keyword-matched; grounded in the real site content. When you switch to
  // live mode, the Worker's system prompt replaces this with richer answers.
  var CANNED = [
    {
      keys: ["fee", "cost", "price", "charge", "how much", "rate"],
      reply:
        "Our management fees are competitive and transparent. You can see the " +
        "full breakdown on our Fee Schedule page (fee-schedule.html). In live " +
        "mode I'll walk you through the specifics for your property — for now, " +
        "call (760) 651-2271 and we'll give you exact numbers.",
    },
    {
      keys: ["service", "what do you do", "offer", "manage", "management"],
      reply:
        "We handle full-service property management for San Diego County: " +
        "tenant screening, rent collection, maintenance coordination, " +
        "inspections, monthly statements, and compliance with California " +
        "rental law. Check the Owner Resources page (owner-info.html) for details.",
    },
    {
      keys: ["area", "where", "location", "serve", "county", "san diego", "north county"],
      reply:
        "We serve San Diego County, including North County (Escondido, San " +
        "Marcos, Vista, Carlsbad), the coast, East County, and South Bay. " +
        "We're based in Valley Center, CA.",
    },
    {
      keys: ["tenant", "screen", "application", "rent my", "lease"],
      reply:
        "Quality tenant screening is one of the most valuable things we do — " +
        "credit, income, rental history, and background checks. See our blog " +
        "post on tenant screening (blog-tenant-screening.html) for how we " +
        "protect your investment.",
    },
    {
      keys: ["owner", "login", "portal", "statement", "account"],
      reply:
        "Owners get an online portal with monthly statements and documents. " +
        "Visit the Owner Portal page (owner-portal.html), or I can point you " +
        "to the right resource.",
    },
    {
      keys: ["listing", "vacancy", "available", "for rent", "rental"],
      reply:
        "Current rental listings are on our Listings page (listings.html). " +
        "Want help finding a specific area or price range?",
    },
    {
      keys: ["contact", "call", "phone", "email", "reach", "talk", "speak"],
      reply:
        "You can reach us at (760) 651-2271 or optionspropertymanagementsd@gmail.com. " +
        "We're at 28588 Cole Grade Rd #1353, Valley Center, CA 92082.",
    },
    {
      keys: ["start", "get started", "sign up", "onboard", "switch"],
      reply:
        "Getting started is easy — we'll review your property, agree on terms, " +
        "and handle the transition. The Onboarding Guide (onboarding-guide.html) " +
        "covers the steps. Call (760) 651-2271 to begin.",
    },
    {
      keys: ["law", "legal", "ab 1482", "rent control", "eviction", "deposit"],
      reply:
        "California rental law changes often (AB 1482 rent caps, deposit rules, " +
        "just-cause eviction). Our CA Rental Laws page (ca-rental-laws.html) and " +
        "blog keep owners current — and we keep your properties compliant.",
    },
  ];

  var FALLBACK =
    "Great question! This is a preview assistant, so I can answer common " +
    "questions about our services, fees, areas, and contact info. For anything " +
    "specific, call us at (760) 651-2271 or email optionspropertymanagementsd@gmail.com.";

  function mockReply(text) {
    var t = (text || "").toLowerCase();
    for (var i = 0; i < CANNED.length; i++) {
      for (var j = 0; j < CANNED[i].keys.length; j++) {
        if (t.indexOf(CANNED[i].keys[j]) !== -1) return CANNED[i].reply;
      }
    }
    return FALLBACK;
  }

  // ---- Styles --------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("opm-chat-styles")) return;
    var css =
      "" +
      "#opm-chat-btn{position:fixed;bottom:22px;right:22px;z-index:99998;width:60px;height:60px;border:none;border-radius:50%;cursor:pointer;background:linear-gradient(135deg," +
      BRAND.primary +
      " 0%," +
      BRAND.secondary +
      " 100%);color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);font-size:26px;display:flex;align-items:center;justify-content:center;transition:transform .2s;}" +
      "#opm-chat-btn:hover{transform:translateY(-2px) scale(1.05);}" +
      "#opm-chat-panel{position:fixed;bottom:94px;right:22px;z-index:99999;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 130px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;}" +
      "#opm-chat-panel.open{display:flex;}" +
      "#opm-chat-head{background:linear-gradient(135deg," +
      BRAND.primary +
      " 0%," +
      BRAND.secondary +
      " 100%);color:#fff;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;}" +
      "#opm-chat-head h3{margin:0;font-size:1.05rem;font-weight:600;}" +
      "#opm-chat-head .sub{font-size:.75rem;opacity:.9;font-weight:300;}" +
      "#opm-chat-close{background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1;opacity:.9;}" +
      "#opm-chat-close:hover{opacity:1;}" +
      "#opm-chat-log{flex:1;overflow-y:auto;padding:16px;background:" +
      BRAND.light +
      ";}" +
      ".opm-msg{margin-bottom:12px;display:flex;}" +
      ".opm-msg .bubble{padding:10px 14px;border-radius:14px;font-size:.92rem;line-height:1.5;max-width:80%;}" +
      ".opm-msg.bot{justify-content:flex-start;}" +
      ".opm-msg.bot .bubble{background:#fff;color:" +
      BRAND.dark +
      ";border:1px solid #e5e7eb;border-bottom-left-radius:4px;}" +
      ".opm-msg.user{justify-content:flex-end;}" +
      ".opm-msg.user .bubble{background:" +
      BRAND.secondary +
      ";color:#fff;border-bottom-right-radius:4px;}" +
      ".opm-typing .bubble{color:" +
      BRAND.gray +
      ";font-style:italic;}" +
      "#opm-chat-form{display:flex;border-top:1px solid #e5e7eb;background:#fff;padding:10px;gap:8px;}" +
      "#opm-chat-input{flex:1;border:1px solid #d1d5db;border-radius:24px;padding:10px 14px;font-size:.92rem;outline:none;font-family:inherit;}" +
      "#opm-chat-input:focus{border-color:" +
      BRAND.secondary +
      ";}" +
      "#opm-chat-send{border:none;border-radius:24px;padding:0 18px;cursor:pointer;background:" +
      BRAND.accent +
      ";color:" +
      BRAND.dark +
      ";font-weight:600;font-size:.9rem;}" +
      "#opm-chat-send:disabled{opacity:.5;cursor:default;}" +
      "#opm-chat-disclaimer{font-size:.68rem;color:" +
      BRAND.gray +
      ";text-align:center;padding:0 12px 8px;background:#fff;}";
    var s = document.createElement("style");
    s.id = "opm-chat-styles";
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ---- DOM build -----------------------------------------------------
  var log, input, sendBtn, panel;

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }

  function addMessage(role, text) {
    var wrap = el("div", { class: "opm-msg " + role });
    var bubble = el("div", { class: "bubble" });
    bubble.textContent = text;
    wrap.appendChild(bubble);
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
    return wrap;
  }

  function setBusy(busy) {
    sendBtn.disabled = busy;
    input.disabled = busy;
  }

  function botRespond(userText) {
    var typing = el("div", { class: "opm-msg bot opm-typing" });
    typing.appendChild(el("div", { class: "bubble" }, "typing…"));
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    function finish(reply) {
      typing.remove();
      addMessage("bot", reply);
      setBusy(false);
      input.focus();
    }

    if (MOCK || !ENDPOINT) {
      // Local canned reply with a short, natural delay.
      setTimeout(function () {
        finish(mockReply(userText));
      }, 500 + Math.random() * 500);
      return;
    }

    // Live mode: ask the Worker (which calls Claude).
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        finish(d.reply || FALLBACK);
      })
      .catch(function () {
        finish(
          "Sorry — I'm having trouble connecting right now. Please call " +
            "(760) 651-2271."
        );
      });
  }

  function handleSubmit(e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    addMessage("user", text);
    input.value = "";
    setBusy(true);
    botRespond(text);
  }

  function togglePanel() {
    var isOpen = panel.classList.toggle("open");
    if (isOpen) {
      if (!log.dataset.greeted) {
        addMessage("bot", GREETING);
        log.dataset.greeted = "1";
      }
      setTimeout(function () {
        input.focus();
      }, 50);
    }
  }

  function build() {
    injectStyles();

    var btn = el("button", {
      id: "opm-chat-btn",
      "aria-label": "Open chat assistant",
      title: "Chat with us",
    });
    btn.textContent = "💬";

    panel = el("div", { id: "opm-chat-panel", role: "dialog", "aria-label": "Chat assistant" });

    var head = el("div", { id: "opm-chat-head" });
    var titleWrap = el("div");
    titleWrap.appendChild(el("h3", null, "Options Assistant"));
    titleWrap.appendChild(el("div", { class: "sub" }, "Typically replies instantly"));
    var close = el("button", { id: "opm-chat-close", "aria-label": "Close chat" }, "&times;");
    head.appendChild(titleWrap);
    head.appendChild(close);

    log = el("div", { id: "opm-chat-log" });

    var form = el("form", { id: "opm-chat-form" });
    input = el("input", {
      id: "opm-chat-input",
      type: "text",
      placeholder: "Type your question…",
      autocomplete: "off",
    });
    sendBtn = el("button", { id: "opm-chat-send", type: "submit" }, "Send");
    form.appendChild(input);
    form.appendChild(sendBtn);

    var disclaimer = el(
      "div",
      { id: "opm-chat-disclaimer" },
      "Automated assistant. Don't share sensitive personal information."
    );

    panel.appendChild(head);
    panel.appendChild(log);
    panel.appendChild(form);
    panel.appendChild(disclaimer);

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    btn.addEventListener("click", togglePanel);
    close.addEventListener("click", togglePanel);
    form.addEventListener("submit", handleSubmit);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
