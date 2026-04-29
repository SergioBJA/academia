/**
 * ThemeManager.js - Centralized theme switcher for Academia Admin
 * Handles persistence and immediate class application for Dark Mode.
 */
(function() {
    // 1. Detect and apply theme immediately (prevents flickering)
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
    }

    // 2. Define global utility functions
    window.ThemeManager = {
        isDark: function() {
            return document.documentElement.classList.contains('dark');
        },
        
        setTheme: function(theme) {
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.classList.remove('dark');
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
            }
            // Dispatch event for reactive components (like Alpine.js)
            window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }));
        },
        
        toggle: function() {
            const newTheme = this.isDark() ? 'light' : 'dark';
            this.setTheme(newTheme);
            return this.isDark(); // Returns TRUE if dark, FALSE if light
        }
    };
})();
