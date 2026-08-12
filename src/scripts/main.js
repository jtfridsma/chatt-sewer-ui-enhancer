// src/scripts/main.js

import { getChattContext } from './utilities/context.js';
import { applyThemeClasses } from './utilities/theme.js';
import { addThemeToggle } from './components/theme-toggle.js';
import { setupModernDashboardIntegration } from './modern/dashboard.js';

function init() {
    try {
        const ctx = getChattContext(window.location);

        if (!ctx.isRelevant) return;

        applyThemeClasses(ctx);
        addThemeToggle();
        setupModernDashboardIntegration(ctx);
    } catch (err) {
        // Fail silently in production so we don't break the host page.
        // Uncomment for dev:
        // console.warn('[Chatt Sewer UI] init failed:', err);
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
}
