import test from 'node:test';
import assert from 'node:assert/strict';

import { createLegacyDataAdapter } from '../src/scripts/modern/adapters/legacy-data.js';
import {
    isThemeEnabled,
    persistThemeEnabled,
    readThemeEnabled,
    setThemeEnabled,
} from '../src/scripts/utilities/theme-state.js';

test('theme state uses one storage and document contract', () => {
    const attributes = new Map();
    const values = new Map();
    const originalDocument = globalThis.document;
    const originalLocalStorage = globalThis.localStorage;

    globalThis.document = {
        documentElement: {
            hasAttribute(name) {
                return attributes.has(name);
            },
            setAttribute(name, value) {
                attributes.set(name, value);
            },
            removeAttribute(name) {
                attributes.delete(name);
            },
        },
    };
    globalThis.localStorage = {
        getItem(key) {
            return values.get(key) ?? null;
        },
        setItem(key, value) {
            values.set(key, value);
        },
    };

    try {
        assert.equal(readThemeEnabled(), true);
        persistThemeEnabled(false);
        assert.equal(readThemeEnabled(), false);
        setThemeEnabled(true);
        assert.equal(isThemeEnabled(), true);
        setThemeEnabled(false);
        assert.equal(isThemeEnabled(), false);
    } finally {
        globalThis.document = originalDocument;
        globalThis.localStorage = originalLocalStorage;
    }
});

test('legacy data adapter start and stop are idempotent', () => {
    const listeners = new Map();
    const dispatched = [];
    let nextTimerId = 1;
    let intervalCallback = null;
    const originalWindow = globalThis.window;
    const originalCustomEvent = globalThis.CustomEvent;

    globalThis.CustomEvent = class CustomEvent {
        constructor(type, options = {}) {
            this.type = type;
            this.detail = options.detail;
        }
    };
    globalThis.window = {
        addEventListener(type, listener) {
            const entries = listeners.get(type) || [];
            entries.push(listener);
            listeners.set(type, entries);
        },
        removeEventListener(type, listener) {
            listeners.set(
                type,
                (listeners.get(type) || []).filter((entry) => entry !== listener)
            );
        },
        dispatchEvent(event) {
            dispatched.push(event.type);
        },
        setTimeout() {
            return nextTimerId++;
        },
        clearTimeout() {},
        setInterval(callback) {
            intervalCallback = callback;
            return nextTimerId++;
        },
        clearInterval() {},
    };

    try {
        const adapter = createLegacyDataAdapter();
        adapter.start();
        adapter.start();

        assert.equal(listeners.get('csui-modern-dashboard:state').length, 1);
        assert.equal(
            dispatched.filter((event) => event === 'csui-modern-dashboard:start').length,
            1
        );

        intervalCallback();
        assert.equal(
            dispatched.filter((event) => event === 'csui-modern-dashboard:start').length,
            2
        );

        adapter.stop();
        adapter.stop();
        assert.equal(listeners.get('csui-modern-dashboard:state').length, 0);
    } finally {
        globalThis.window = originalWindow;
        globalThis.CustomEvent = originalCustomEvent;
    }
});
