import test from 'node:test';
import assert from 'node:assert/strict';

import { applyPageChrome, restorePageChrome } from '../src/scripts/utilities/chrome.js';

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
        assert.equal(head.children.length, 4);

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
