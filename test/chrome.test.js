import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyPageChrome,
    getExtensionUrl,
    restorePageChrome,
} from '../src/scripts/utilities/chrome.js';

test('page chrome restores the host title and preserves host favicons', () => {
    const originalDocument = globalThis.document;
    const nodesById = new Map();

    const head = {
        children: [],
        appendChild(node) {
            if (!this.children.includes(node)) this.children.push(node);
            node.parentNode = this;
            if (node.id) nodesById.set(node.id, node);
        },
    };

    const createLink = () => {
        const attributes = new Map();
        return {
            parentNode: null,
            setAttribute(name, value) {
                attributes.set(name, String(value));
            },
            getAttribute(name) {
                return attributes.get(name) ?? null;
            },
            remove() {
                const index = head.children.indexOf(this);
                if (index !== -1) head.children.splice(index, 1);
                if (this.id) nodesById.delete(this.id);
                this.parentNode = null;
            },
        };
    };

    const hostFavicon = createLink();
    hostFavicon.id = 'host-favicon';
    hostFavicon.rel = 'icon';
    hostFavicon.href = '/host-icon.png';
    head.appendChild(hostFavicon);

    globalThis.document = {
        title: 'Host payment page',
        head,
        createElement(tagName) {
            assert.equal(tagName, 'link');
            return createLink();
        },
        getElementById(id) {
            return nodesById.get(id) ?? null;
        },
        getElementsByTagName(tagName) {
            return tagName === 'head' ? [head] : [];
        },
    };

    try {
        applyPageChrome({ isSewerPaymentsChatt: true });

        assert.equal(globalThis.document.title, 'Chattanooga Sewer Payment Portal');
        assert.equal(head.children.length, 8);
        assert.deepEqual(
            head.children.slice(1).map((link) => link.href),
            [
                'public/favicons/favicon-16.png',
                'public/favicons/favicon-32.png',
                'public/favicons/favicon-48.png',
                'public/favicons/favicon-180.png',
                'public/favicons/favicon-192.png',
                'public/favicons/favicon-512.png',
                'public/favicons/favicon-32.png',
            ]
        );

        restorePageChrome();

        assert.equal(globalThis.document.title, 'Host payment page');
        assert.deepEqual(head.children, [hostFavicon]);

        globalThis.document.title = 'Updated host payment page';
        applyPageChrome({ isSewerPaymentsChatt: true });
        restorePageChrome();
        assert.equal(globalThis.document.title, 'Updated host payment page');
    } finally {
        globalThis.document = originalDocument;
    }
});

test('extension URLs remain usable after runtime access is invalidated', () => {
    const originalChrome = globalThis.chrome;
    const extensionId = 'abcdefghijklmnopabcdefghijklmnop';

    try {
        globalThis.chrome = {
            runtime: {
                getURL(path) {
                    return `chrome-extension://${extensionId}/${path}`;
                },
            },
        };
        assert.equal(
            getExtensionUrl('public/csui-consumption-chart.js'),
            `chrome-extension://${extensionId}/public/csui-consumption-chart.js`
        );

        globalThis.chrome.runtime.getURL = () => {
            throw new Error('Extension context invalidated.');
        };
        assert.equal(
            getExtensionUrl('public/csui-consumption-chart.js'),
            `chrome-extension://${extensionId}/public/csui-consumption-chart.js`
        );
    } finally {
        globalThis.chrome = originalChrome;
    }
});
