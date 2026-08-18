// src/scripts/utilities/chrome.js
//
// Browser chrome tweaks (title + favicon) for supported pages.

const BASE_TITLE = 'Chattanooga Sewer Payment Portal';
const OWNED_FAVICON_ATTR = 'data-csui-owned-favicon';
const FAVICON_IDS = ['csui-favicon-16', 'csui-favicon-32', 'csui-favicon-shortcut'];

let baseFaviconApplied = false;
let originalDocumentTitle;

export function getExtensionUrl(path) {
    try {
        // Chrome MV3 content scripts
        if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
            return chrome.runtime.getURL(path);
        }
    } catch {
        // ignore
    }

    try {
        // Firefox/Safari (if applicable)
        if (typeof browser !== 'undefined' && browser?.runtime?.getURL) {
            return browser.runtime.getURL(path);
        }
    } catch {
        // ignore
    }

    // Fallback (may not work on host pages, but harmless)
    return path;
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

    const href16 = getExtensionUrl('public/icons/icon-16.png');
    const href32 = getExtensionUrl('public/icons/icon-32.png');

    // Most browsers will pick the best match; ordering helps (last wins in some cases).
    upsertFaviconLink({ id: 'csui-favicon-16', rel: 'icon', href: href16, sizes: '16x16' });
    upsertFaviconLink({ id: 'csui-favicon-32', rel: 'icon', href: href32, sizes: '32x32' });
    upsertFaviconLink({ id: 'csui-favicon-shortcut', rel: 'shortcut icon', href: href32 });
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
        dashboard: 'Account Dashboard',
    };

    return defaults[ctx.pageType] ?? null;
}
