// src/scripts/utilities/chrome.js
//
// Browser chrome tweaks (title + favicon) for supported pages.

const BASE_TITLE = 'Chattanooga Sewer Payment Portal';
const OWNED_FAVICON_ATTR = 'data-csui-owned-favicon';
const FAVICON_LINKS = [
    { id: 'csui-favicon-16', rel: 'icon', path: 'public/favicons/favicon-16.png', sizes: '16x16' },
    { id: 'csui-favicon-32', rel: 'icon', path: 'public/favicons/favicon-32.png', sizes: '32x32' },
    { id: 'csui-favicon-48', rel: 'icon', path: 'public/favicons/favicon-48.png', sizes: '48x48' },
    {
        id: 'csui-favicon-180',
        rel: 'apple-touch-icon',
        path: 'public/favicons/favicon-180.png',
        sizes: '180x180',
    },
    {
        id: 'csui-favicon-192',
        rel: 'icon',
        path: 'public/favicons/favicon-192.png',
        sizes: '192x192',
    },
    {
        id: 'csui-favicon-512',
        rel: 'icon',
        path: 'public/favicons/favicon-512.png',
        sizes: '512x512',
    },
    {
        id: 'csui-favicon-shortcut',
        rel: 'shortcut icon',
        path: 'public/favicons/favicon-32.png',
    },
];
const FAVICON_IDS = FAVICON_LINKS.map(({ id }) => id);

let baseFaviconApplied = false;
let originalDocumentTitle;
let extensionOrigin = '';

export function getExtensionUrl(path) {
    try {
        // Chrome MV3 content scripts
        if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
            return rememberExtensionOrigin(chrome.runtime.getURL(path));
        }
    } catch {
        // ignore
    }

    try {
        // Firefox/Safari (if applicable)
        if (typeof browser !== 'undefined' && browser?.runtime?.getURL) {
            return rememberExtensionOrigin(browser.runtime.getURL(path));
        }
    } catch {
        // ignore
    }

    // A page can keep an old content script alive while its extension reloads.
    // runtime.getURL() then throws, but a URL acquired earlier in that same
    // page session still points at the extension's stable origin.
    if (extensionOrigin) {
        try {
            return new URL(path, `${extensionOrigin}/`).href;
        } catch {
            // Fall through to the legacy fallback below.
        }
    }

    // Callers that need a module URL must validate this fallback first.
    return path;
}

function rememberExtensionOrigin(url) {
    try {
        const parsed = new URL(url);
        extensionOrigin = `${parsed.protocol}//${parsed.host}`;
    } catch {
        // Keep the successfully returned runtime URL even if it cannot be parsed.
    }
    return url;
}

function upsertFaviconLink({ id, rel = 'icon', href, sizes, type = 'image/png' }) {
    if (typeof document === 'undefined') return;

    const head = document.head || document.getElementsByTagName('head')[0];
    if (!head) return;

    let link = document.getElementById(id);
    if (!link) {
        link = document.createElement('link');
        link.id = id;
        head.appendChild(link);
    } else if (link.parentNode !== head) {
        head.appendChild(link);
    }

    link.rel = rel;
    link.type = type;
    link.setAttribute(OWNED_FAVICON_ATTR, 'true');
    if (sizes) link.sizes = sizes;
    link.href = href;
}

export function captureOriginalPageChrome() {
    if (typeof document === 'undefined') return;
    if (originalDocumentTitle === undefined) originalDocumentTitle = document.title;
}

export function applyWebShareChrome(ctx, opts = {}) {
    if (typeof document === 'undefined') return;
    if (!ctx?.isChattWebShare) return;

    captureOriginalPageChrome();
    applyBaseFaviconOnce();

    const suffix = opts.titleSuffix ?? getWebShareTitleSuffix(ctx);
    setDocumentTitle({ baseTitle: BASE_TITLE, suffix });
}

export function applyPageChrome(ctx) {
    if (typeof document === 'undefined') return;
    if (!ctx?.isSewerPaymentsChatt) return;

    captureOriginalPageChrome();

    // Landing page: base title only, no suffix.
    applyBaseFaviconOnce();
    setDocumentTitle({ baseTitle: BASE_TITLE, suffix: null });
}

export function restorePageChrome() {
    if (typeof document === 'undefined') return;

    if (originalDocumentTitle !== undefined && document.title !== originalDocumentTitle) {
        document.title = originalDocumentTitle;
    }
    originalDocumentTitle = undefined;

    FAVICON_IDS.forEach((id) => {
        const link = document.getElementById(id);
        if (link?.getAttribute(OWNED_FAVICON_ATTR) === 'true') link.remove();
    });

    baseFaviconApplied = false;
}

function setDocumentTitle({ baseTitle, suffix, separator = ' — ' }) {
    if (typeof document === 'undefined') return;
    if (!baseTitle) return;

    const next = suffix ? `${baseTitle}${separator}${suffix}` : baseTitle;
    if (document.title !== next) document.title = next;
}

function applyBaseFaviconOnce() {
    if (baseFaviconApplied) return;
    baseFaviconApplied = true;

    FAVICON_LINKS.forEach(({ path, ...link }) => {
        upsertFaviconLink({ ...link, href: getExtensionUrl(path) });
    });
}

function getWebShareTitleSuffix(ctx) {
    // Allow runtime overrides via window.csuiTitleSuffixOverrides = { [pageType]: 'Custom Suffix' }
    try {
        const overrides =
            typeof window !== 'undefined' ? window.csuiTitleSuffixOverrides : undefined;
        if (overrides && overrides[ctx.pageType]) return overrides[ctx.pageType];
    } catch {
        // ignore
    }

    const defaults = {
        login: 'Sign In',
        'forgot-username': 'Forgot Username',
        'new-user': 'Create Account',
        'guest-pay': 'Guest Pay',
        dashboard: 'Dashboard',
    };

    return defaults[ctx.pageType] ?? null;
}
