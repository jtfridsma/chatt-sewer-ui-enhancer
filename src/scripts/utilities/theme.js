// src/scripts/theme.js
import { setupLandingPageEnhancements } from '../templates/landing-page.js';
import { setupWebShareEnhancements } from '../templates/webshare.js';
import {
    applyPageChrome,
    applyWebShareChrome,
    captureOriginalPageChrome,
    restorePageChrome,
} from './chrome.js';
import { readThemeEnabled, setThemeEnabled, subscribeToThemeToggle } from './theme-state.js';

let currentChromeContext = null;
let hasChromeToggleListener = false;

export function applyThemeClasses(ctx) {
    if (!ctx?.isRelevant) return;
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    if (!root || !root.classList) return;

    // Establish enabled/disabled state as early as possible so downstream scripts can rely on it.
    // Default is enabled unless explicitly set to "false".
    const enabled = ensureEnabledState();
    ensureFontsLoaded();
    setupPageChrome(ctx, enabled);

    root.classList.add('csui-theme');

    if (ctx.isSewerPaymentsChatt) {
        root.classList.add('csui-landing-page');
        setupLandingPageEnhancements(ctx);
    }

    if (ctx.isChattWebShare) {
        root.classList.add('csui-webshare');

        switch (ctx.pageType) {
            case 'login':
                root.classList.add('csui-webshare-login');
                break;
            case 'forgot-username':
                root.classList.add('csui-webshare-forgot-username');
                break;
            case 'new-user':
                root.classList.add('csui-webshare-new-user');
                break;
            case 'guest-pay':
                root.classList.add('csui-webshare-guest-pay');
                break;
            case 'dashboard':
            default:
                root.classList.add('csui-webshare-dashboard');
                break;
        }

        addWebShareHeading(ctx);
        setupWebShareEnhancements(ctx);
    }
}

function ensureEnabledState() {
    const enabled = readThemeEnabled();
    setThemeEnabled(enabled);
    return enabled;
}

function setupPageChrome(ctx, enabled) {
    currentChromeContext = ctx;
    captureOriginalPageChrome();
    syncPageChrome(ctx, enabled);

    if (hasChromeToggleListener || typeof window === 'undefined') return;

    hasChromeToggleListener = true;
    subscribeToThemeToggle((event) => {
        syncPageChrome(currentChromeContext, !!event?.detail?.enabled);
    });
}

function syncPageChrome(ctx, enabled) {
    if (!enabled) {
        restorePageChrome();
        return;
    }

    if (ctx?.isSewerPaymentsChatt) applyPageChrome(ctx);
    if (ctx?.isChattWebShare) applyWebShareChrome(ctx);
}

function ensureFontsLoaded() {
    // Best-effort: inject Google Fonts stylesheet once per page.
    // Note: host-page CSP may block external font loads; in that case fallbacks will be used.
    // These resource hints/stylesheets intentionally remain loaded when the visual theme is off.
    if (typeof document === 'undefined') return;

    const head = document.head || document.getElementsByTagName('head')[0];
    if (!head) return;

    ensureHeadLink(head, {
        id: 'csui-google-fonts-preconnect-1',
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
    });
    ensureHeadLink(head, {
        id: 'csui-google-fonts-preconnect-2',
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
    });
    ensureHeadLink(head, {
        id: 'csui-google-fonts',
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Gabarito:wght@400;500;600;700&display=swap',
    });
    ensureHeadLink(head, {
        id: 'csui-google-symbols',
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded&icon_names=account_circle,autorenew,block,check_circle,close,description,edit_note,gas_meter,info,keyboard_arrow_down,lock,logout,payments,receipt_long,warning&display=block',
    });
}

function ensureHeadLink(head, attrs) {
    if (!head || !attrs?.id || document.getElementById(attrs.id)) return;

    const link = document.createElement('link');
    Object.entries(attrs).forEach(([name, value]) => {
        if (value === undefined || value === null) return;
        link[name] = value;
    });
    head.appendChild(link);
}

function addWebShareHeading(ctx) {
    try {
        if (!ctx?.isChattWebShare) return;
        if (typeof document === 'undefined') return;

        const text = getWebShareHeadingText(ctx);
        if (!text) return; // no heading requested

        const logo = document.getElementById('masterLogo');
        if (!logo || !logo.parentNode) return;

        // Ensure a header wrapper exists
        const parent = logo.parentNode;
        let header = document.getElementById('csui-webshare-header');
        let eyebrow = null;
        let heading = null;

        if (!header) {
            header = document.createElement('header');
            header.id = 'csui-webshare-header';
            header.className = 'csui-webshare-header';

            if (logo.nextSibling) {
                parent.insertBefore(header, logo.nextSibling);
            } else {
                parent.appendChild(header);
            }

            eyebrow = document.createElement('p');
            eyebrow.className = 'csui-webshare-eyebrow';
            eyebrow.textContent = 'Chattanooga Sewer Web Payment Portal';
            header.appendChild(eyebrow);

            heading = document.createElement('h1');
            heading.id = 'csui-webshare-heading';
            heading.className = 'csui-webshare-heading';
            heading.textContent = text;
            header.appendChild(heading);
        } else {
            eyebrow = header.querySelector('.csui-webshare-eyebrow');
            if (!eyebrow) {
                eyebrow = document.createElement('p');
                eyebrow.className = 'csui-webshare-eyebrow';
                eyebrow.textContent = 'Chattanooga Sewer Web Payment Portal';
                header.insertBefore(eyebrow, header.firstChild || null);
            }

            heading = header.querySelector('#csui-webshare-heading');
            if (!heading) {
                heading = document.createElement('h1');
                heading.id = 'csui-webshare-heading';
                heading.className = 'csui-webshare-heading';
                header.appendChild(heading);
            }
            heading.textContent = text;
        }
    } catch {
        // silent fail in production
    }
}

function getWebShareHeadingText(ctx) {
    // Allow runtime overrides via window.csuiHeadingOverrides = { [pageType]: 'Custom Heading' }
    try {
        const overrides = typeof window !== 'undefined' ? window.csuiHeadingOverrides : undefined;
        if (overrides && overrides[ctx.pageType]) return overrides[ctx.pageType];
    } catch {
        // ignore
    }

    const defaults = {
        login: 'Sign In to Your Account',
        'forgot-username': 'Forgot Your Username?',
        'new-user': 'Create a New Account',
        'guest-pay': 'Pay as a Guest',
    };
    return defaults[ctx.pageType] ?? null;
}
