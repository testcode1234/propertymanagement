/* =====================================================================
   Options Property Management — Tracking
   ---------------------------------------------------------------------
   * Loads GA4, the Google Ads tag, and the Meta Pixel from the IDs in
     config/marketing.json, but only after consent (js/consent.js).
     Blank IDs mean that tag is skipped.
   * Defines the event taxonomy. Fire events with:
         opmTrack("lead_form_submit", { form_id: "home-contact", lead_type: "owner" });
     Events fired before the visitor decides are held and sent if they
     accept; they are dropped if they decline.
   * Records first-touch and latest campaign touch (UTM tags, ad click IDs,
     external referrer) in localStorage so forms can attach them to leads:
         opmAttribution()  ->  { first_touch, last_touch, page_url, referrer }
   * Fires phone_clicked / email_clicked / booking_clicked automatically.

   Full event reference and testing steps: docs/tracking.md
   ===================================================================== */
(function () {
  "use strict";

  // name -> Meta standard event (if any). Google Ads conversion fires on
  // lead_form_submit only.
  var EVENTS = {
    lead_form_submit: "Lead",
    estimate_started: null,
    estimate_completed: null,
    chat_started: null,
    chat_qualified: null,
    booking_clicked: "Schedule",
    phone_clicked: "Contact",
    email_clicked: "Contact"
  };

  var FIRST_TOUCH_KEY = "opm_first_touch";
  var LAST_TOUCH_KEY = "opm_last_touch";
  var TOUCH_TTL_DAYS = 90;
  var CAMPAIGN_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
                         "gclid", "gbraid", "wbraid", "fbclid"];
  var MAX_QUEUE = 25;

  var config = null;     // tracking section of config/marketing.json
  var bookingHost = "";
  var tagsLoaded = false;
  var queue = [];
  var debug = /[?&]opm_debug=1\b/.test(location.search);

  // ---- Attribution ---------------------------------------------------

  function readTouch(key) {
    try {
      var t = JSON.parse(localStorage.getItem(key));
      if (!t || !t.ts) return null;
      var ageDays = (Date.now() - Date.parse(t.ts)) / 86400000;
      return ageDays <= TOUCH_TTL_DAYS ? t : null;
    } catch (e) {
      return null;
    }
  }

  function writeTouch(key, touch) {
    try { localStorage.setItem(key, JSON.stringify(touch)); } catch (e) {}
  }

  function sameSite(host) {
    return host.replace(/^www\./, "") === location.hostname.replace(/^www\./, "");
  }

  // Campaign data on this page view, or null for an internal/direct view.
  function campaignTouch() {
    var params = new URLSearchParams(location.search);
    var touch = {};
    var found = false;
    CAMPAIGN_PARAMS.forEach(function (p) {
      var v = params.get(p);
      if (v) { touch[p] = v.slice(0, 200); found = true; }
    });
    var ref = document.referrer;
    if (ref) {
      try {
        if (!sameSite(new URL(ref).hostname)) { touch.referrer = ref.slice(0, 500); found = true; }
      } catch (e) {}
    }
    return found ? touch : null;
  }

  function recordTouch() {
    var campaign = campaignTouch();
    var base = { landing_page: (location.pathname + location.search).slice(0, 500), ts: new Date().toISOString() };
    if (!readTouch(FIRST_TOUCH_KEY)) {
      writeTouch(FIRST_TOUCH_KEY, Object.assign({ source: campaign ? "campaign" : "direct" }, campaign || {}, base));
    }
    if (campaign) {
      writeTouch(LAST_TOUCH_KEY, Object.assign({ source: "campaign" }, campaign, base));
    }
  }

  window.opmAttribution = function () {
    return {
      first_touch: readTouch(FIRST_TOUCH_KEY),
      last_touch: readTouch(LAST_TOUCH_KEY),
      page_url: location.href,
      referrer: document.referrer || ""
    };
  };

  // ---- Tag loading ---------------------------------------------------

  function loadScript(src) {
    var s = document.createElement("script");
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  function loadGoogle() {
    var primary = config.ga4_id || config.google_ads_id;
    if (!primary) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted"
    });
    window.gtag("js", new Date());
    if (config.ga4_id) window.gtag("config", config.ga4_id, debug ? { debug_mode: true } : {});
    if (config.google_ads_id) window.gtag("config", config.google_ads_id);
    loadScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(primary));
  }

  function loadMeta() {
    if (!config.meta_pixel_id) return;
    // Standard Meta Pixel bootstrap: queue calls until fbevents.js arrives.
    var fbq = window.fbq = function () {
      fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    loadScript("https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", config.meta_pixel_id);
    fbq("track", "PageView");
  }

  function loadTags() {
    if (tagsLoaded || !hasTags()) return;  // no config yet: init() retries once it arrives
    tagsLoaded = true;
    loadGoogle();
    loadMeta();
    queue.splice(0).forEach(function (ev) { send(ev.name, ev.params); });
  }

  // Visitor accepted again after declining on this same page view.
  function regrantTags() {
    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "granted",
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted"
      });
    }
    if (window.fbq) window.fbq("consent", "grant");
  }

  function revokeTags() {
    queue = [];
    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied"
      });
    }
    if (window.fbq) window.fbq("consent", "revoke");
    // Remove cookies these tags already set on our domain.
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (/^(_ga|_gid|_gcl|_fbp|_fbc)/.test(name)) {
        var domain = location.hostname.replace(/^www\./, "");
        document.cookie = name + "=; Max-Age=0; path=/";
        document.cookie = name + "=; Max-Age=0; path=/; domain=." + domain;
      }
    });
  }

  function hasTags() {
    return !!(config && (config.ga4_id || config.google_ads_id || config.meta_pixel_id));
  }

  // ---- Events --------------------------------------------------------

  function send(name, params) {
    if (window.gtag && config.ga4_id) window.gtag("event", name, params);
    if (window.gtag && name === "lead_form_submit" && config.google_ads_id && config.google_ads_lead_label) {
      window.gtag("event", "conversion", { send_to: config.google_ads_id + "/" + config.google_ads_lead_label });
    }
    if (window.fbq && EVENTS[name]) window.fbq("track", EVENTS[name], { content_name: name });
  }

  window.opmTrack = function (name, params) {
    if (!Object.prototype.hasOwnProperty.call(EVENTS, name)) return;
    params = params || {};
    if (debug) console.info("[opmTrack]", name, params);
    if (!hasTags()) return;
    var consent = window.opmConsent ? window.opmConsent.status() : null;
    if (consent === "denied") return;
    if (tagsLoaded) {
      send(name, params);
    } else if (config === null || consent === null) {
      if (queue.length < MAX_QUEUE) queue.push({ name: name, params: params });
    }
  };

  // Where on the page a link was clicked, for event context.
  function linkLocation(el) {
    if (el.closest("header, #header-placeholder")) return "header";
    if (el.closest("footer, #footer-placeholder")) return "footer";
    if (el.closest("#opm-chat-panel")) return "chat";
    var section = el.closest("section[id]");
    return section ? section.id : "body";
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    var params = { link_location: linkLocation(a) };
    if (/^tel:/i.test(href)) {
      window.opmTrack("phone_clicked", params);
    } else if (/^mailto:/i.test(href)) {
      window.opmTrack("email_clicked", params);
    } else if (a.hasAttribute("data-booking-link") || (bookingHost && a.hostname === bookingHost)) {
      window.opmTrack("booking_clicked", params);
    }
  });

  // ---- Init ----------------------------------------------------------

  recordTouch();

  fetch("config/marketing.json")
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; })
    .then(function (cfg) {
      config = cfg.tracking || {};
      try { bookingHost = cfg.booking_url ? new URL(cfg.booking_url).hostname : ""; } catch (e) {}
      if (!hasTags()) { queue = []; return; }
      var consent = window.opmConsent ? window.opmConsent.status() : "denied";
      if (consent === "granted") {
        loadTags();
      } else if (consent === null) {
        window.opmConsent.request();
      } else {
        queue = [];
      }
    });

  if (window.opmConsent) {
    window.opmConsent.onChange(function (status) {
      if (status !== "granted") revokeTags();
      else if (tagsLoaded) regrantTags();
      else loadTags();
    });
  }
})();
