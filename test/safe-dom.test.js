import test from 'node:test';
import assert from 'node:assert/strict';

import { JSDOM } from 'jsdom';
import { replaceChildrenFromSanitizedMarkup } from '../src/scripts/modern/components/safe-dom.js';

test('renders dashboard markup without retaining executable content', () => {
    const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.com/dashboard' });
    const previousDocument = globalThis.document;
    const previousDOMParser = globalThis.DOMParser;

    try {
        globalThis.document = dom.window.document;
        globalThis.DOMParser = dom.window.DOMParser;
        const root = document.querySelector('#root');

        replaceChildrenFromSanitizedMarkup(
            root,
            `<main class="shell" onclick="alert(1)">
                <script>alert(1)</script>
                <a id="unsafe" href="javascript:alert(1)">Unsafe link</a>
                <a id="safe" href="/statement.pdf" target="_blank">Statement</a>
                <img src="https://example.com/logo.png" onerror="alert(1)" />
            </main>`
        );

        assert.equal(root.querySelector('script'), null);
        assert.equal(root.querySelector('main').hasAttribute('onclick'), false);
        assert.equal(root.querySelector('#unsafe').hasAttribute('href'), false);
        assert.equal(root.querySelector('img').hasAttribute('onerror'), false);
        assert.equal(root.querySelector('#safe').getAttribute('href'), '/statement.pdf');
        assert.equal(root.querySelector('#safe').getAttribute('rel'), 'noopener noreferrer');
    } finally {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        if (previousDOMParser === undefined) delete globalThis.DOMParser;
        else globalThis.DOMParser = previousDOMParser;
        dom.window.close();
    }
});
