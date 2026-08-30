// src/scripts/main.js

import { getChattContext } from './utilities/context.js';
import { applyThemeClasses } from './utilities/theme.js';
import { addThemeToggle } from './components/theme-toggle.js';
import { setupModernDashboardIntegration } from './modern/dashboard.js';

function init() {
    try {
        const ctx = getChattContext(window.location);

        if (!ctx.isRelevant) return;

        addThemeToggle(ctx);
        applyThemeClasses(ctx);
        setupModernDashboardIntegration(ctx);
    } catch (err) {
        window.__CSUI__?.reportError?.(err);
        try {
            if (localStorage.getItem('csui-modern-debug') === 'true') {
                console.warn('[Chatt Sewer UI] initialization failed:', err);
            }
        } catch {
            // Keep host-page initialization failures isolated.
        }
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
}
