/* =====================================================================
   Options Property Management — Consent banner
   ---------------------------------------------------------------------
   Non-essential tags (Google Analytics, Google Ads, Meta Pixel) load only
   after the visitor clicks "Accept". tracking.js asks for consent with
   opmConsent.request(); the banner never appears if no such tags are
   configured in config/marketing.json.

   A browser sending Global Privacy Control (GPC) is treated as "Decline"
   and never sees the banner.

   API (window.opmConsent):
     status()      -> "granted" | "denied" | null (not decided yet)
     request()     -> show the banner if the visitor hasn't decided
     open()        -> show the banner again (footer "Your Privacy Choices")
     onChange(fn)  -> fn(status) whenever the choice changes
   ===================================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "opm_consent_v1";
  var listeners = [];
  var banner = null;

  function gpcEnabled() {
    return navigator.globalPrivacyControl === true;
  }

  function stored() {
    try {
      var v = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return v && (v.status === "granted" || v.status === "denied") ? v.status : null;
    } catch (e) {
      return null;
    }
  }

  function status() {
    if (gpcEnabled()) return "denied";
    return stored();
  }

  function save(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ status: value, ts: new Date().toISOString() }));
    } catch (e) {}
    hide();
    listeners.forEach(function (fn) { fn(value); });
  }

  function injectStyles() {
    if (document.getElementById("opm-consent-style")) return;
    var css = document.createElement("style");
    css.id = "opm-consent-style";
    css.textContent =
      "#opm-consent{position:fixed;left:16px;bottom:16px;z-index:100000;max-width:520px;" +
      "background:#fff;color:#1f2937;border-radius:12px;box-shadow:0 10px 36px rgba(0,0,0,.25);" +
      "padding:1.1rem 1.25rem;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:.92rem;line-height:1.55;" +
      "border-top:4px solid #1a4d7a;}" +
      "#opm-consent p{margin:0 0 .85rem;}" +
      "#opm-consent a{color:#2c7bb5;}" +
      "#opm-consent .opm-consent-actions{display:flex;gap:.6rem;flex-wrap:wrap;}" +
      "#opm-consent button{font:inherit;font-weight:600;padding:.55rem 1.2rem;border-radius:8px;cursor:pointer;}" +
      "#opm-consent .opm-accept{background:#1a4d7a;color:#fff;border:2px solid #1a4d7a;}" +
      "#opm-consent .opm-decline{background:#fff;color:#1a4d7a;border:2px solid #1a4d7a;}" +
      "@media (max-width:600px){#opm-consent{left:12px;right:12px;bottom:12px;max-width:none;}}";
    document.head.appendChild(css);
  }

  function show() {
    if (banner) return;
    injectStyles();
    banner = document.createElement("div");
    banner.id = "opm-consent";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Cookie consent");
    banner.innerHTML =
      "<p>We'd like to use cookies from Google and Meta to measure site visits and our advertising. " +
      "They only load if you accept. See our <a href=\"privacy.html\">Privacy Policy</a>.</p>" +
      "<div class=\"opm-consent-actions\">" +
      "<button type=\"button\" class=\"opm-accept\">Accept</button>" +
      "<button type=\"button\" class=\"opm-decline\">Decline</button>" +
      "</div>";
    banner.querySelector(".opm-accept").addEventListener("click", function () { save("granted"); });
    banner.querySelector(".opm-decline").addEventListener("click", function () { save("denied"); });
    document.body.appendChild(banner);
  }

  function hide() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    banner = null;
  }

  function request() {
    if (status() === null) show();
  }

  function open() {
    if (gpcEnabled()) {
      alert("Your browser is sending a Global Privacy Control signal, so analytics and advertising cookies stay off.");
      return;
    }
    show();
  }

  // Footer / privacy page links: <a data-opm-privacy-choices>. The footer is
  // injected after load, so listen at the document level.
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("[data-opm-privacy-choices]");
    if (!link) return;
    e.preventDefault();
    open();
  });

  window.opmConsent = {
    status: status,
    request: request,
    open: open,
    onChange: function (fn) { listeners.push(fn); }
  };
})();
