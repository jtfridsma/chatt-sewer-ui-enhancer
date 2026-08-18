import { isThemeEnabled, subscribeToThemeToggle } from '../utilities/theme-state.js';

// WebShare-specific DOM enhancements.

const LABEL_SNIPPET = 'Enter the account number you wish to pay below.';
const WRAP_CLASS = 'csui-guestpay-label-text';
const MAX_WRAP_ATTEMPTS = 20;
const WRAP_RETRY_MS = 250;

let errorLabelsTrimmed = false;
let toggleListenerInstalled = false;
let wrapRetryId = null;
let wrapAttempts = 0;

export function setupWebShareEnhancements(ctx) {
    if (typeof document === 'undefined') return;
    if (!ctx?.isChattWebShare) return;

    trimErrorLabelsOnce();

    if (ctx.pageType === 'guest-pay') {
        if (isThemeEnabled()) attemptWrapWithRetries();

        if (toggleListenerInstalled) return;
        toggleListenerInstalled = true;
        subscribeToThemeToggle((event) => {
            if (event?.detail?.enabled) attemptWrapWithRetries();
            else cancelWrapRetries();
        });
    }
}

function trimErrorLabelsOnce() {
    if (errorLabelsTrimmed) return;
    if (!document.body) return;
    errorLabelsTrimmed = true;

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
    if (wrapRetryId !== null) return;
    wrapAttempts = 0;

    const tick = () => {
        wrapRetryId = null;
        if (!isThemeEnabled()) return;
        wrapAttempts += 1;
        const done = applyGuestPayLabelWrap();
        if (done || wrapAttempts >= MAX_WRAP_ATTEMPTS) return;
        wrapRetryId = window.setTimeout(tick, WRAP_RETRY_MS);
    };
    tick();
}

function cancelWrapRetries() {
    if (wrapRetryId !== null) window.clearTimeout(wrapRetryId);
    wrapRetryId = null;
    wrapAttempts = 0;
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
