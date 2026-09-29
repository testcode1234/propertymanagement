// Load header and footer components
(function() {
    // Function to load HTML content
    function loadComponent(elementId, file, onLoad) {
        fetch(file)
            .then(response => response.text())
            .then(data => {
                const element = document.getElementById(elementId);
                if (element) {
                    element.innerHTML = data;
                    if (onLoad) onLoad(element);
                }
            })
            .catch(error => console.error('Error loading component:', error));
    }

    // Keep the footer copyright year current.
    function setYear(root) {
        root.querySelectorAll('[data-current-year]').forEach(function (el) {
            el.textContent = new Date().getFullYear();
        });
    }

    // Consent banner + tracking (GA4, Google Ads, Meta Pixel, UTM capture).
    // async=false keeps them executing in order: consent.js first.
    function loadTracking() {
        ['js/consent.js', 'js/tracking.js'].forEach(function (src) {
            if (document.querySelector('script[src="' + src + '"]')) return;
            var s = document.createElement('script');
            s.src = src;
            s.async = false;
            document.body.appendChild(s);
        });
    }

    // Load the chat widget site-wide. A dynamically created <script> executes,
    // whereas a <script> placed inside injected innerHTML would not.
    function loadChatbot() {
        if (document.getElementById('opm-chatbot-script')) return;
        var s = document.createElement('script');
        s.id = 'opm-chatbot-script';
        s.src = 'chatbot.js';
        s.defer = true;
        document.body.appendChild(s);
    }

    // Cloudflare Web Analytics (privacy-friendly, no cookies). Loads site-wide.
    function loadAnalytics() {
        if (document.getElementById('cf-beacon-script')) return;
        var s = document.createElement('script');
        s.id = 'cf-beacon-script';
        s.defer = true;
        s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
        s.setAttribute('data-cf-beacon', '{"token": "64f9445bf54145f890b2a0c32aa6acb6"}');
        document.head.appendChild(s);
    }

    // Submit Formspree forms via AJAX so the visitor stays on our site and sees
    // an inline thank-you, instead of being redirected to Formspree's page.
    // If JavaScript is disabled, the form still works as a normal POST.
    function initForms() {
        var forms = document.querySelectorAll('form[action*="formspree.io"]');
        Array.prototype.forEach.call(forms, function (form) {
            if (form.dataset.ajaxBound) return;
            form.dataset.ajaxBound = '1';
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var btn = form.querySelector('[type="submit"]') || form.querySelector('button');
                var label = btn ? btn.textContent : '';
                if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
                var data = new FormData(form);
                appendAttribution(data);
                fetch(form.action, {
                    method: 'POST',
                    body: data,
                    headers: { 'Accept': 'application/json' }
                }).then(function (resp) {
                    if (resp.ok) {
                        // Only forms marked with a lead type count as leads
                        // (not the newsletter or portal-access forms).
                        if (form.dataset.leadType && window.opmTrack) {
                            window.opmTrack('lead_form_submit', {
                                form_id: form.dataset.formId || '',
                                lead_type: form.dataset.leadType
                            });
                        }
                        showThanks(form);
                    } else {
                        if (btn) { btn.disabled = false; btn.textContent = label; }
                        showError(form);
                    }
                }).catch(function () {
                    if (btn) { btn.disabled = false; btn.textContent = label; }
                    showError(form);
                });
            });
        });
    }

    // Attach first-touch / latest campaign data (see js/tracking.js) so the
    // lead email shows where the visitor came from.
    function appendAttribution(data) {
        if (!window.opmAttribution) return;
        var a = window.opmAttribution();
        data.append('page_url', a.page_url);
        [['first', a.first_touch], ['last', a.last_touch]].forEach(function (pair) {
            if (!pair[1]) return;
            Object.keys(pair[1]).forEach(function (key) {
                data.append(pair[0] + '_touch_' + key, pair[1][key]);
            });
        });
    }

    function showThanks(form) {
        var isNewsletter = form.classList.contains('newsletter-form');
        var msg = document.createElement('div');
        msg.setAttribute('role', 'status');
        msg.style.cssText = 'text-align:center;padding:1.25rem;color:#1a4d7a;font-family:inherit;line-height:1.6;';
        msg.innerHTML = isNewsletter
            ? '<strong style="font-size:1.05rem;">✅ Thanks for subscribing!</strong><br>' +
              '<span style="color:#6b7280;">You\'re on the list.</span>'
            : '<strong style="font-size:1.15rem;">✅ Thank you! Your message has been sent.</strong><br>' +
              '<span style="color:#6b7280;">We\'ll be in touch soon.</span>';
        form.parentNode.replaceChild(msg, form);
    }

    function showError(form) {
        if (form.querySelector('.opm-form-error')) return;
        var err = document.createElement('div');
        err.className = 'opm-form-error';
        err.style.cssText = 'margin-top:0.75rem;color:#dc2626;font-weight:600;text-align:center;';
        err.textContent = 'Sorry, something went wrong. Please try again or call (760) 651-2271.';
        form.appendChild(err);
    }

    // Load components when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            loadComponent('header-placeholder', 'header.html');
            loadComponent('footer-placeholder', 'footer.html', setYear);
            loadTracking();
            loadChatbot();
            loadAnalytics();
            initForms();
        });
    } else {
        loadComponent('header-placeholder', 'header.html');
        loadComponent('footer-placeholder', 'footer.html', setYear);
        loadTracking();
        loadChatbot();
        loadAnalytics();
        initForms();
    }
})();
