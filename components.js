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

    // Load components when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            loadComponent('header-placeholder', 'header.html');
            loadComponent('footer-placeholder', 'footer.html');
        });
    } else {
        loadComponent('header-placeholder', 'header.html');
        loadComponent('footer-placeholder', 'footer.html');
    }
})();
