import { createLegacyActions } from './adapters/legacy-actions.js';
import { createLegacyDataAdapter } from './adapters/legacy-data.js';
import { createDashboardView } from './components/dashboard-view.js';
import { setupModernModalIntegration } from './modal-integration.js';

const MODERN_ROOT_ID = 'csui-modern-dashboard';
const MODERN_READY_ATTR = 'data-csui-modern-dashboard';
const MODERN_CLASS = 'csui-modern-dashboard';
const DEBUG_STORAGE_KEY = 'csui-modern-debug';
const RELATED_DATA_LOADING_MS = 6500;

let instance = null;

export function setupModernDashboardIntegration(ctx) {
    if (!ctx?.isChattWebShare || ctx.pageType !== 'dashboard') return;

    syncModernDashboard();

    window.addEventListener('csui-theme-toggle', () => syncModernDashboard());
}

export function initializeModernDashboard() {
    if (instance) return instance;

    const logger = createLogger();
    let defaultSelectionApplied = false;
    let selectedAccountIdentity = '';
    let selectedAccountChangedAt = 0;
    let loadingRefreshId = null;
    const host = ensureModernRoot();
    const modalIntegration = setupModernModalIntegration();
    const view = createDashboardView({
        host,
        actions: {
            selectAccount(account) {
                dataAdapter.selectAccount(account);
            },
            setPaperlessBilling(enabled) {
                dataAdapter.performLegacyAction('set-paperless-billing', { enabled });
            },
            setAutoPay(enabled) {
                dataAdapter.performLegacyAction('set-auto-pay', { enabled });
            },
            showAllStatements() {
                dataAdapter.performLegacyAction('show-all-statements');
            },
            showInitialStatements() {
                dataAdapter.performLegacyAction('show-initial-statements');
            },
            openPayment() {
                try {
                    legacyActions.openPayment();
                } catch (err) {
                    failModernDashboard(err);
                }
            },
            openProfile() {
                try {
                    legacyActions.openProfile();
                } catch (err) {
                    failModernDashboard(err);
                }
            },
            openChangePassword() {
                try {
                    legacyActions.openChangePassword();
                } catch (err) {
                    failModernDashboard(err);
                }
            },
            signOut() {
                try {
                    legacyActions.signOut();
                } catch (err) {
                    failModernDashboard(err);
                }
            },
        },
    });
    const legacyActions = createLegacyActions({ logger });
    const dataAdapter = createLegacyDataAdapter({
        logger,
        onState(state) {
            try {
                logger.log(`acquired ${state.accounts?.length || 0} accounts`);
                if (!defaultSelectionApplied) {
                    defaultSelectionApplied = true;
                    const preferredAccount = getDefaultAccount(state);
                    if (
                        preferredAccount &&
                        !isSameAccount(preferredAccount, state.selectedAccount)
                    ) {
                        dataAdapter.selectAccount(preferredAccount);
                        return;
                    }
                }
                const displayState = withRelatedLoadingState(state);
                view.render(displayState);
                scheduleLoadingRefresh(displayState);
                hideLegacyDashboard();
            } catch (err) {
                failModernDashboard(err);
            }
        },
        onUnavailable(err) {
            failModernDashboard(err);
        },
    });

    instance = {
        host,
        view,
        dataAdapter,
        destroy() {
            if (loadingRefreshId) window.clearTimeout(loadingRefreshId);
            modalIntegration.destroy();
            dataAdapter.stop();
            view.destroy();
            host.remove();
            showLegacyDashboard();
            instance = null;
        },
    };

    try {
        view.renderLoading();
        dataAdapter.start();
        logger.log('initialized');
    } catch (err) {
        failModernDashboard(err);
    }

    return instance;

    function withRelatedLoadingState(state) {
        const identity = getAccountIdentity(state?.selectedAccount);
        const now = Date.now();

        if (identity && identity !== selectedAccountIdentity) {
            selectedAccountIdentity = identity;
            selectedAccountChangedAt = now;
        }

        const withinLoadingWindow =
            selectedAccountChangedAt > 0 &&
            now - selectedAccountChangedAt < RELATED_DATA_LOADING_MS;
        const statements = Array.isArray(state?.statements) ? state.statements : [];
        const waterMeters = Array.isArray(state?.waterMeters) ? state.waterMeters : [];
        const flags = state?.flags || {};
        const expectedWaterMeterCount = Number(flags.expectedWaterMeterCount) || 0;
        const isWaitingForWaterMeters =
            expectedWaterMeterCount > 0
                ? waterMeters.length < expectedWaterMeterCount
                : waterMeters.length === 0;

        return {
            ...state,
            loading: {
                statements:
                    flags.statementsPending === true ||
                    (withinLoadingWindow && statements.length === 0),
                waterMeters:
                    flags.waterMetersPending === true ||
                    (withinLoadingWindow &&
                        flags.showWaterConsumptionGraph !== false &&
                        isWaitingForWaterMeters),
            },
        };
    }

    function scheduleLoadingRefresh(state) {
        if (loadingRefreshId) {
            window.clearTimeout(loadingRefreshId);
            loadingRefreshId = null;
        }

        if (!state?.loading?.statements && !state?.loading?.waterMeters) return;

        const elapsed = Date.now() - selectedAccountChangedAt;
        const remaining = Math.max(250, RELATED_DATA_LOADING_MS - elapsed + 50);
        loadingRefreshId = window.setTimeout(() => {
            loadingRefreshId = null;
            dataAdapter.refresh();
        }, remaining);
    }
}

export function destroyModernDashboard() {
    if (!instance) {
        showLegacyDashboard();
        return;
    }
    instance.destroy();
}

export function hideLegacyDashboard() {
    setModernDashboardReady(true);
}

export function showLegacyDashboard() {
    setModernDashboardReady(false);
}

function syncModernDashboard() {
    if (isEnhancementsEnabled()) {
        initializeModernDashboard();
    } else {
        destroyModernDashboard();
    }
}

function ensureModernRoot() {
    let host = document.getElementById(MODERN_ROOT_ID);
    if (host) {
        moveModernRootToBody(host);
        return host;
    }

    host = document.createElement('div');
    host.id = MODERN_ROOT_ID;
    moveModernRootToBody(host);

    return host;
}

function moveModernRootToBody(host) {
    if (!document.body) return;
    const control = document.getElementById('csui-ui');

    if (control?.parentNode === document.body) {
        control.insertAdjacentElement('afterend', host);
        return;
    }

    document.body.insertBefore(host, document.body.firstChild || null);
}

function failModernDashboard(err) {
    createLogger().warn('initialization failed; reverting to legacy mode', err);
    try {
        window.__CSUI__?.reportError?.(err);
    } catch {
        // ignore
    }
    destroyModernDashboard();
}

function setModernDashboardReady(ready) {
    const root = document.documentElement;
    if (!root) return;

    if (ready) {
        root.setAttribute(MODERN_READY_ATTR, 'true');
        root.classList.add(MODERN_CLASS);
    } else {
        root.removeAttribute(MODERN_READY_ATTR);
        root.classList.remove(MODERN_CLASS);
    }
}

function isEnhancementsEnabled() {
    return document.documentElement?.hasAttribute('data-csui-enabled') === true;
}

function getDefaultAccount(state) {
    const accounts = Array.isArray(state?.accounts) ? state.accounts : [];
    const selected = state?.selectedAccount;
    const preferred = accounts.find((account) => account && !account.pastInactive);

    if (!preferred) return null;
    if (!selected) return preferred;
    if (selected.pastInactive) return preferred;
    return null;
}

function isSameAccount(a, b) {
    if (!a || !b) return false;
    if (a.accountKey && b.accountKey) return a.accountKey === b.accountKey;
    return a.accountNumber === b.accountNumber;
}

function getAccountIdentity(account) {
    if (!account) return '';
    return account.accountKey || account.accountNumber || '';
}

function createLogger() {
    const enabled = isDebugEnabled();
    return {
        log(message, ...args) {
            if (enabled) console.info(`[CSUI Modern] ${message}`, ...args);
        },
        warn(message, ...args) {
            if (enabled) console.warn(`[CSUI Modern] ${message}`, ...args);
        },
    };
}

function isDebugEnabled() {
    try {
        return localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}
