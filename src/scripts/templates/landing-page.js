const GENERATED_ATTR = 'data-csui-generated';
const GENERATED_CONTACT = 'contact-link';
const GENERATED_NOTICE = 'notice-class';

const SIDEBAR_ID = 'csui-sidebar';
const SIDEBAR_TITLE_ID = 'csui-sidebar-title';
const LAYOUT_CLASS = 'csui-layout';
const LAYOUT_MAIN_CLASS = 'csui-layout-main';

const MAIN_TEXT_BLOCK_ID = 'block-yui_3_17_2_1_1559159472532_12338';
const SERVICE_BLOCK_ID = 'block-c35f931c81b99d76a401';

const NOTICE_SNIPPET = 'NOTICE TO CUSTOMERS:';
const NOTICE_CLASS = 'csui-notice';
const ADDRESS_TEXT = '1250 Market Street, Suite 1008, Downtown Chattanooga';
const MAPS_URL = 'https://maps.app.goo.gl/ZNVe8TicMDkF3vkG8';
const PHONE_NUMBERS = ['(423) 643-6311', '(844) 898-3672', '(833) 237-8064'];

let currentContext = null;
let hasToggleListener = false;

export function setupLandingPageEnhancements(ctx) {
    currentContext = ctx;
    syncLandingPageEnhancements(ctx);

    if (hasToggleListener || typeof window === 'undefined') return;

    hasToggleListener = true;
    window.addEventListener('csui-theme-toggle', (ev) => {
        syncLandingPageEnhancements(currentContext, !!ev?.detail?.enabled);
    });
}

export function applyLandingPageEnhancements(ctx) {
    if (typeof document === 'undefined' || !document.body) return;
    if (!ctx?.isSewerPaymentsChatt) return;

    const mainBlock = document.getElementById(MAIN_TEXT_BLOCK_ID);
    const serviceBlock = document.getElementById(SERVICE_BLOCK_ID);

    linkifyContacts(mainBlock);
    linkifyContacts(serviceBlock);
    markNoticeParagraphs(mainBlock);
    restructureMainAndSidebar(mainBlock);
}

export function revertLandingPageEnhancements(ctx) {
    if (typeof document === 'undefined') return;
    if (!ctx?.isSewerPaymentsChatt) return;

    const mainBlock = document.getElementById(MAIN_TEXT_BLOCK_ID);
    const serviceBlock = document.getElementById(SERVICE_BLOCK_ID);

    teardownSidebarLayout(mainBlock);
    unwrapGeneratedContactLinks(mainBlock);
    unwrapGeneratedContactLinks(serviceBlock);
    clearGeneratedNoticeClasses(mainBlock);
}

function syncLandingPageEnhancements(ctx, enabled = isThemeEnabled()) {
    if (!ctx?.isSewerPaymentsChatt) return;

    if (enabled) {
        applyLandingPageEnhancements(ctx);
    } else {
        revertLandingPageEnhancements(ctx);
    }
}

function isThemeEnabled() {
    return document.documentElement?.hasAttribute('data-csui-enabled') ?? false;
}

function linkifyContacts(rootEl) {
    if (!rootEl) return;

    wrapExactText(rootEl, ADDRESS_TEXT, (text) => {
        const link = document.createElement('a');
        link.href = MAPS_URL;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = text;
        link.setAttribute(GENERATED_ATTR, GENERATED_CONTACT);
        return link;
    });

    PHONE_NUMBERS.forEach((number) => {
        wrapExactText(rootEl, number, (text) => {
            const digits = text.replace(/\D+/g, '');
            const href = digits.length === 10 ? `tel:+1${digits}` : `tel:${digits}`;
            const link = document.createElement('a');
            link.href = href;
            link.textContent = text;
            link.setAttribute(GENERATED_ATTR, GENERATED_CONTACT);
            return link;
        });
    });
}

function wrapExactText(container, targetText, createNode) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const textNodes = [];

    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    for (const textNode of textNodes) {
        if (!textNode.nodeValue || isInsideAnchor(textNode)) continue;

        const startIndex = textNode.nodeValue.indexOf(targetText);
        if (startIndex === -1) continue;

        const before = textNode.nodeValue.slice(0, startIndex);
        const match = textNode.nodeValue.slice(startIndex, startIndex + targetText.length);
        const after = textNode.nodeValue.slice(startIndex + targetText.length);
        const parent = textNode.parentNode;

        if (!parent) continue;

        if (before) {
            parent.insertBefore(document.createTextNode(before), textNode);
        }

        parent.insertBefore(createNode(match), textNode);

        if (after) {
            parent.insertBefore(document.createTextNode(after), textNode);
        }

        parent.removeChild(textNode);
    }
}

function isInsideAnchor(node) {
    let current = node.parentNode;

    while (current) {
        if (current.nodeType === Node.ELEMENT_NODE && current.tagName === 'A') {
            return true;
        }
        current = current.parentNode;
    }

    return false;
}

function unwrapGeneratedContactLinks(rootEl) {
    if (!rootEl) return;

    const links = rootEl.querySelectorAll(`a[${GENERATED_ATTR}="${GENERATED_CONTACT}"]`);
    links.forEach((link) => {
        const parent = link.parentNode;
        if (!parent) return;

        parent.replaceChild(document.createTextNode(link.textContent || ''), link);
        parent.normalize();
    });
}

function markNoticeParagraphs(mainBlock) {
    if (!mainBlock) return;

    const paragraphs = mainBlock.querySelectorAll('p');
    paragraphs.forEach((paragraph) => {
        const text = paragraph.textContent?.toUpperCase() || '';
        if (!text.includes(NOTICE_SNIPPET)) return;
        if (paragraph.classList.contains(NOTICE_CLASS)) return;

        paragraph.classList.add(NOTICE_CLASS);
        paragraph.setAttribute(GENERATED_ATTR, GENERATED_NOTICE);
    });
}

function clearGeneratedNoticeClasses(mainBlock) {
    if (!mainBlock) return;

    const notices = mainBlock.querySelectorAll(`[${GENERATED_ATTR}="${GENERATED_NOTICE}"]`);
    notices.forEach((notice) => {
        notice.classList.remove(NOTICE_CLASS);
        notice.removeAttribute(GENERATED_ATTR);
    });
}

function restructureMainAndSidebar(mainBlock) {
    if (!mainBlock) return;
    if (mainBlock.closest(`.${LAYOUT_CLASS}`)) return;

    const paragraphs = Array.from(mainBlock.querySelectorAll('p'));
    if (!paragraphs.length) return;

    const firstSidebarIndex = paragraphs.findIndex((paragraph) =>
        paragraph.textContent.includes('Make your life easier')
    );
    if (firstSidebarIndex === -1) return;

    const sidebarCandidates = paragraphs
        .slice(firstSidebarIndex)
        .filter((paragraph) => !paragraph.textContent.toUpperCase().includes(NOTICE_SNIPPET));
    if (!sidebarCandidates.length) return;

    const wrapper = document.createElement('div');
    wrapper.className = LAYOUT_CLASS;

    const mainWrapper = document.createElement('div');
    mainWrapper.className = LAYOUT_MAIN_CLASS;

    const parent = mainBlock.parentNode;
    if (!parent) return;

    parent.insertBefore(wrapper, mainBlock);
    wrapper.appendChild(mainWrapper);
    mainWrapper.appendChild(mainBlock);

    const sidebar = document.createElement('aside');
    sidebar.id = SIDEBAR_ID;
    sidebar.className = 'csui-sidebar';
    sidebar.setAttribute('aria-labelledby', SIDEBAR_TITLE_ID);

    const title = document.createElement('h2');
    title.id = SIDEBAR_TITLE_ID;
    title.className = 'csui-sidebar__title';
    title.textContent = 'Online Account & Auto-Pay';
    sidebar.appendChild(title);

    sidebarCandidates.forEach((paragraph) => {
        const clone = paragraph.cloneNode(true);
        sidebar.appendChild(clone);
        paragraph.classList.add('csui-hidden');
    });

    wrapper.appendChild(sidebar);

    trimSidebarNbsp(sidebar);
    markPaymentNoticeInSidebar(sidebar);
}

function teardownSidebarLayout(mainBlock) {
    if (!mainBlock) return;

    const sidebar = document.getElementById(SIDEBAR_ID);
    if (sidebar?.parentNode) {
        sidebar.parentNode.removeChild(sidebar);
    }

    const wrapper = mainBlock.closest(`.${LAYOUT_CLASS}`);
    if (wrapper?.parentNode) {
        wrapper.parentNode.insertBefore(mainBlock, wrapper);
        wrapper.parentNode.removeChild(wrapper);
    }

    const hiddenParagraphs = mainBlock.querySelectorAll('.csui-hidden');
    hiddenParagraphs.forEach((paragraph) => paragraph.classList.remove('csui-hidden'));
}

function trimSidebarNbsp(sidebarEl) {
    if (!sidebarEl) return;

    const blocks = sidebarEl.querySelectorAll('p, li, a, div, span');
    blocks.forEach((element) => {
        let textNode = getLastTextNode(element);

        while (textNode?.nodeValue && /[\u00A0\s]$/.test(textNode.nodeValue)) {
            textNode.nodeValue = textNode.nodeValue.replace(/[\u00A0\s]+$/g, '');

            if (textNode.nodeValue !== '') continue;

            const previousSibling = textNode.previousSibling;
            textNode.parentNode?.removeChild(textNode);
            textNode = findPreviousTextNode(previousSibling);
        }
    });
}

function getLastTextNode(node) {
    let current = node;

    while (current) {
        if (current.nodeType === Node.TEXT_NODE) {
            return current;
        }

        current = current.lastChild;
    }

    return null;
}

function findPreviousTextNode(node) {
    let current = node;

    while (current) {
        if (current.nodeType === Node.TEXT_NODE) {
            return current;
        }

        current = current.lastChild || current.previousSibling;
    }

    return null;
}

function markPaymentNoticeInSidebar(sidebarEl) {
    if (!sidebarEl) return;

    const paragraphs = sidebarEl.querySelectorAll('p');
    paragraphs.forEach((paragraph) => {
        if (paragraph.querySelector('span.csui-notice')) return;

        const match = findTextNodeMatch(paragraph, 'if you wish to make a payment');
        if (!match) return;

        const { node, index } = match;

        try {
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(paragraph, paragraph.childNodes.length);

            const notice = document.createElement('span');
            notice.className = NOTICE_CLASS;
            range.surroundContents(notice);
        } catch {
            const before = node.nodeValue.slice(0, index);
            const after = node.nodeValue.slice(index);
            const parent = node.parentNode;
            if (!parent) return;

            if (before) {
                parent.insertBefore(document.createTextNode(before), node);
            }

            const notice = document.createElement('span');
            notice.className = NOTICE_CLASS;
            notice.textContent = after;
            parent.insertBefore(notice, node);
            parent.removeChild(node);
        }
    });
}

function findTextNodeMatch(container, phrase) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
        const textNode = walker.currentNode;
        const value = textNode.nodeValue || '';
        const index = value.toLowerCase().indexOf(phrase.toLowerCase());

        if (index !== -1) {
            return { node: textNode, index };
        }
    }

    return null;
}
