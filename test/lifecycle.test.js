import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { addThemeToggle } from '../src/scripts/components/theme-toggle.js';
import { createLegacyDataAdapter } from '../src/scripts/modern/adapters/legacy-data.js';
import { MODERN_BRIDGE_EVENTS } from '../src/scripts/modern/bridge/events.js';
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

test('theme toggle shows diagnostics and extension version', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
        url: 'https://share.dwcorp.com/WebShare/',
    });
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalLocalStorage = globalThis.localStorage;
    const originalChrome = globalThis.chrome;

    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.localStorage = dom.window.localStorage;
    globalThis.chrome = {
        runtime: {
            getManifest() {
                return { version: '1.2.3' };
            },
        },
    };

    try {
        addThemeToggle();
        const root = document.getElementById('csui-ui');
        const diagnostics = document.getElementById('csui-diagnostics');
        const badge = document.getElementById('csui-error-badge');
        const badgeIcon = document.getElementById('csui-diagnostic-badge-icon');

        assert.match(root.textContent, /v1\.2\.3/);
        window.__CSUI__.reportWarning('The legacy meter data was unavailable.');

        assert.equal(badge.getAttribute('data-visible'), 'true');
        assert.equal(badge.getAttribute('data-severity'), 'warning');
        assert.equal(badgeIcon.textContent, 'warning');
        assert.equal(diagnostics.hidden, false);
        assert.match(diagnostics.textContent, /Warning/);
        assert.match(diagnostics.textContent, /legacy meter data was unavailable/);

        window.__CSUI__.reportError('The dashboard could not load.');
        assert.equal(badge.getAttribute('data-severity'), 'error');
        assert.equal(badgeIcon.textContent, 'error');
    } finally {
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
        globalThis.localStorage = originalLocalStorage;
        globalThis.chrome = originalChrome;
    }
});

test('theme toggle keeps diagnostics scoped to the current page type', () => {
    const dashboardDom = new JSDOM('<!doctype html><html><body></body></html>', {
        url: 'https://share.dwcorp.com/WebShare/AccountOverview.aspx?clientKey=3652&viewID=3',
    });
    const loginDom = new JSDOM('<!doctype html><html><body></body></html>', {
        url: 'https://share.dwcorp.com/WebShare/Login.aspx?clientKey=3652&viewID=3',
    });
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalLocalStorage = globalThis.localStorage;

    try {
        globalThis.window = dashboardDom.window;
        globalThis.document = dashboardDom.window.document;
        globalThis.localStorage = dashboardDom.window.localStorage;
        addThemeToggle();
        window.__CSUI__.reportWarning('Modern dashboard data was not available in time.');

        const dashboardDiagnostics = localStorage.getItem('csui-diagnostics:webshare:dashboard');
        assert.ok(dashboardDiagnostics);

        globalThis.window = loginDom.window;
        globalThis.document = loginDom.window.document;
        globalThis.localStorage = loginDom.window.localStorage;
        localStorage.setItem('csui-diagnostics:webshare:dashboard', dashboardDiagnostics);
        addThemeToggle();

        const diagnostics = document.getElementById('csui-diagnostics');
        assert.equal(diagnostics.hidden, true);

        window.__CSUI__.reportWarning('The sign-in form took longer than expected.');
        assert.match(diagnostics.textContent, /Sign-in page Warning/);
        assert.equal(localStorage.getItem('csui-diagnostics:webshare:login') !== null, true);
    } finally {
        globalThis.window = originalWindow;
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

test('legacy data adapter times out only while valid state is still unavailable', () => {
    const listeners = new Map();
    const timeouts = new Map();
    const intervals = new Map();
    let nextTimerId = 1;
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
            (listeners.get(event.type) || []).forEach((listener) => listener(event));
        },
        setTimeout(callback) {
            const id = nextTimerId++;
            timeouts.set(id, callback);
            return id;
        },
        clearTimeout(id) {
            timeouts.delete(id);
        },
        setInterval(callback) {
            const id = nextTimerId++;
            intervals.set(id, callback);
            return id;
        },
        clearInterval(id) {
            intervals.delete(id);
        },
    };

    try {
        let unavailableCount = 0;
        const unavailableAdapter = createLegacyDataAdapter({
            onUnavailable() {
                unavailableCount += 1;
            },
        });
        unavailableAdapter.start();
        runPendingTimeouts(timeouts);
        assert.equal(unavailableCount, 1);
        unavailableAdapter.stop();

        let receivedCount = 0;
        const receivingAdapter = createLegacyDataAdapter({
            onState() {
                receivedCount += 1;
            },
            onUnavailable() {
                unavailableCount += 1;
            },
        });
        receivingAdapter.start();
        window.dispatchEvent(new CustomEvent(MODERN_BRIDGE_EVENTS.state, { detail: { ok: true } }));
        runPendingTimeouts(timeouts);
        assert.equal(receivedCount, 1);
        assert.equal(unavailableCount, 1);
        receivingAdapter.stop();

        const stoppedAdapter = createLegacyDataAdapter({
            onUnavailable() {
                unavailableCount += 1;
            },
        });
        stoppedAdapter.start();
        stoppedAdapter.stop();
        runPendingTimeouts(timeouts);
        assert.equal(unavailableCount, 1);
    } finally {
        globalThis.window = originalWindow;
        globalThis.CustomEvent = originalCustomEvent;
    }
});

function runPendingTimeouts(timeouts) {
    const callbacks = [...timeouts.values()];
    timeouts.clear();
    callbacks.forEach((callback) => callback());
}
