const ALLOWED_ELEMENTS = new Set([
    'a',
    'article',
    'aside',
    'button',
    'canvas',
    'details',
    'div',
    'dl',
    'dt',
    'dd',
    'figure',
    'h1',
    'h2',
    'h3',
    'header',
    'img',
    'input',
    'label',
    'li',
    'main',
    'nav',
    'p',
    'section',
    'small',
    'span',
    'strong',
    'summary',
    'ul',
]);

const ALLOWED_ATTRIBUTES = new Set([
    'alt',
    'checked',
    'class',
    'disabled',
    'href',
    'id',
    'rel',
    'role',
    'src',
    'target',
    'title',
    'type',
]);

const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const ALLOWED_IMAGE_PROTOCOLS = new Set(['http:', 'https:']);

export function replaceChildrenFromSanitizedMarkup(container, markup) {
    const parsed = new DOMParser().parseFromString(String(markup), 'text/html');
    sanitizeElements(parsed.body);
    container.replaceChildren(...parsed.body.childNodes);
}

function sanitizeElements(root) {
    for (const element of Array.from(root.querySelectorAll('*'))) {
        if (!ALLOWED_ELEMENTS.has(element.localName)) {
            element.remove();
            continue;
        }

        for (const attribute of Array.from(element.attributes)) {
            const name = attribute.name.toLowerCase();
            const isExtendedAttribute = name.startsWith('aria-') || name.startsWith('data-');
            if (!ALLOWED_ATTRIBUTES.has(name) && !isExtendedAttribute) {
                element.removeAttribute(attribute.name);
            }
        }

        sanitizeUrlAttribute(element, 'href', ALLOWED_LINK_PROTOCOLS);
        sanitizeUrlAttribute(element, 'src', ALLOWED_IMAGE_PROTOCOLS);

        if (element.getAttribute('target') === '_blank') {
            const rel = new Set((element.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
            rel.add('noopener');
            rel.add('noreferrer');
            element.setAttribute('rel', Array.from(rel).join(' '));
        }
    }
}

function sanitizeUrlAttribute(element, name, allowedProtocols) {
    if (!element.hasAttribute(name)) return;

    try {
        const url = new URL(element.getAttribute(name), document.baseURI);
        if (!allowedProtocols.has(url.protocol)) element.removeAttribute(name);
    } catch {
        element.removeAttribute(name);
    }
}
