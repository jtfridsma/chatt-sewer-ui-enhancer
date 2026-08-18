import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { JSDOM } from 'jsdom';
import { setupLandingPageEnhancements } from '../src/scripts/templates/landing-page.js';

const fixtureUrl = new URL('./fixtures/landing-page.html', import.meta.url);

test('landing enhancements are idempotent and restore the sanitized host fixture', async () => {
    const html = await readFile(fixtureUrl, 'utf8');
    const dom = new JSDOM(html, { url: 'https://www.sewerpayments.com/chattanooga' });
    const previousGlobals = installDomGlobals(dom.window);
    const context = { isSewerPaymentsChatt: true };

    try {
        document.documentElement.setAttribute('data-csui-enabled', 'true');
        const originalBody = document.body.innerHTML;

        setupLandingPageEnhancements(context);
        const generatedContactCount = document.querySelectorAll(
            '[data-csui-generated="contact-link"]'
        ).length;

        assert.equal(document.querySelectorAll('#csui-sidebar').length, 1);
        assert.ok(generatedContactCount >= 3);
        assert.equal(document.querySelectorAll('.csui-notice').length, 1);

        setupLandingPageEnhancements(context);
        assert.equal(document.querySelectorAll('#csui-sidebar').length, 1);
        assert.equal(
            document.querySelectorAll('[data-csui-generated="contact-link"]').length,
            generatedContactCount
        );

        window.dispatchEvent(
            new window.CustomEvent('csui-theme-toggle', { detail: { enabled: false } })
        );

        assert.equal(document.querySelector('#csui-sidebar'), null);
        assert.equal(document.querySelector('.csui-layout'), null);
        assert.equal(document.querySelector('[data-csui-generated]'), null);
        assert.equal(document.querySelector('.csui-hidden'), null);
        assert.equal(document.body.innerHTML, originalBody);
    } finally {
        restoreDomGlobals(previousGlobals);
        dom.window.close();
    }
});

function installDomGlobals(window) {
    const names = ['window', 'document', 'Node', 'NodeFilter', 'Element', 'CustomEvent'];
    const previous = new Map(names.map((name) => [name, globalThis[name]]));

    names.forEach((name) => {
        globalThis[name] = name === 'window' ? window : window[name];
    });

    return previous;
}

function restoreDomGlobals(previous) {
    previous.forEach((value, name) => {
        if (value === undefined) delete globalThis[name];
        else globalThis[name] = value;
    });
}
