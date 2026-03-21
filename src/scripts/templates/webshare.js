// src/scripts/templates/webshare.js
//
// WebShare-specific DOM enhancements.
// Currently: GuestPay label text wrapping for styling hooks (one-time, no revert).

const LABEL_SNIPPET = 'Enter the account number you wish to pay below.';
const WRAP_CLASS = 'csui-guestpay-label-text';

export function setupWebShareEnhancements(ctx) {
    if (typeof document === 'undefined') return;
    if (!ctx?.isChattWebShare) return;

    const root = document.documentElement;
    if (!root) return;

    trimErrorLabelsOnce();

    if (ctx.pageType === 'guest-pay') {
        // Try immediately (covers "toggle already on" once theme.js sets data-csui-enabled early)
        if (root.hasAttribute('data-csui-enabled')) {
            attemptWrapWithRetries();
        }

        // Also try once when the user enables later
        window.addEventListener('csui-theme-toggle', (ev) => {
            if (!ev?.detail?.enabled) return;
            attemptWrapWithRetries();
        });
    }
}

function trimErrorLabelsOnce() {
    if (trimErrorLabelsOnce._done) return;
    trimErrorLabelsOnce._done = true;
    if (!document.body) return;

    const labels = document.querySelectorAll('.error_label');
    labels.forEach((el) => {
        if (!el) return;
        const trimmed = (el.textContent || '').trim();
        if (el.textContent !== trimmed) {
            el.textContent = trimmed;
        }
    });
}

function applyGuestPayLabelWrap() {
    if (!document.body) return;

    // Search likely label containers on GuestPay
    const candidates = document.querySelectorAll('#Main_AccountPanel .label, label, .label');
    for (const el of candidates) {
        if (!el || el.querySelector(`span.${WRAP_CLASS}`)) continue;
        const fullText = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!fullText.includes(LABEL_SNIPPET)) continue;

        wrapFromPhrase(el, 'Enter the account number', WRAP_CLASS);
        return true;
    }
    return false;
}

function attemptWrapWithRetries() {
    // Avoid overlapping retry loops
    if (attemptWrapWithRetries._running) return;
    attemptWrapWithRetries._running = true;

    let tries = 0;
    const maxTries = 20; // ~5s at 250ms
    const tick = () => {
        tries += 1;
        const done = applyGuestPayLabelWrap();
        if (done || tries >= maxTries) {
            attemptWrapWithRetries._running = false;
            return;
        }
        window.setTimeout(tick, 250);
    };
    tick();
}

function wrapFromPhrase(container, phrase, className) {
    // Find the first text node containing the phrase (case-insensitive) and wrap from that point
    // to the end of that text node. This is intentionally lenient vs exact full-sentence matching.
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let foundNode = null;
    let startIdx = -1;

    while (walker.nextNode()) {
        const tn = walker.currentNode;
        if (!tn?.nodeValue) continue;
        const idx = tn.nodeValue.toLowerCase().indexOf(phrase.toLowerCase());
        if (idx !== -1) {
            foundNode = tn;
            startIdx = idx;
            break;
        }
    }
    if (!foundNode || startIdx < 0) return;

    const before = foundNode.nodeValue.slice(0, startIdx);
    const tail = foundNode.nodeValue.slice(startIdx);

    const parent = foundNode.parentNode;
    if (!parent) return;

    if (before) parent.insertBefore(document.createTextNode(before), foundNode);

    const span = document.createElement('span');
    span.className = className;
    span.textContent = tail;
    parent.insertBefore(span, foundNode);

    parent.removeChild(foundNode);
}
