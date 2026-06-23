// Load header and footer components
(function() {
    // Function to load HTML content
    function loadComponent(elementId, file) {
        fetch(file)
            .then(response => response.text())
            .then(data => {
                const element = document.getElementById(elementId);
                if (element) {
                    element.innerHTML = data;
                }
            })
            .catch(error => console.error('Error loading component:', error));
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

    // Load components when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            loadComponent('header-placeholder', 'header.html');
            loadComponent('footer-placeholder', 'footer.html');
            loadChatbot();
        });
    } else {
        loadComponent('header-placeholder', 'header.html');
        loadComponent('footer-placeholder', 'footer.html');
        loadChatbot();
    }
})();
