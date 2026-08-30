import { MODERN_BRIDGE_EVENTS } from '../bridge/events.js';

const FIRST_STATE_TIMEOUT_MS = 6000;
const REQUEST_RETRY_MS = 500;

export function createLegacyDataAdapter({ onState, onUnavailable, logger } = {}) {
    let active = false;
    let timeoutId = null;
    let retryId = null;
    let receivedState = false;

    function start() {
        if (active) return;
        active = true;
        receivedState = false;
        window.addEventListener(MODERN_BRIDGE_EVENTS.state, handleState);
        startBridgeWithRetries();

        timeoutId = window.setTimeout(() => {
            if (!active || receivedState) return;
            logger?.log?.('modern dashboard data was not available in time');
            onUnavailable?.(new Error('Modern dashboard data was not available in time.'));
        }, FIRST_STATE_TIMEOUT_MS);
    }

    function stop() {
        if (!active) return;
        active = false;
        if (timeoutId) window.clearTimeout(timeoutId);
        if (retryId) window.clearInterval(retryId);
        timeoutId = null;
        retryId = null;
        window.removeEventListener(MODERN_BRIDGE_EVENTS.state, handleState);
        dispatch(MODERN_BRIDGE_EVENTS.stop);
    }

    function selectAccount(account) {
        if (!active || !account) return;
        logger?.log?.('selected account changed');
        dispatch(MODERN_BRIDGE_EVENTS.selectAccount, {
            accountNumber: account.accountNumber,
            accountKey: account.accountKey,
        });
    }

    function performLegacyAction(action, detail = {}) {
        if (!active || !action) return;
        dispatch(MODERN_BRIDGE_EVENTS.legacyAction, { action, ...detail });
    }

    function refresh() {
        if (!active) return;
        dispatch(MODERN_BRIDGE_EVENTS.requestState);
    }

    function handleState(event) {
        if (!active) return;
        const detail = event?.detail;
        if (!detail?.ok) return;

        receivedState = true;
        if (timeoutId) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (retryId) {
            window.clearInterval(retryId);
            retryId = null;
        }

        onState?.(detail);
    }

    function startBridgeWithRetries() {
        dispatch(MODERN_BRIDGE_EVENTS.start);
        retryId = window.setInterval(() => {
            if (!active || receivedState) return;
            dispatch(MODERN_BRIDGE_EVENTS.start);
        }, REQUEST_RETRY_MS);
    }

    return {
        start,
        stop,
        refresh,
        selectAccount,
        performLegacyAction,
    };
}

function dispatch(name, detail = {}) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
}
