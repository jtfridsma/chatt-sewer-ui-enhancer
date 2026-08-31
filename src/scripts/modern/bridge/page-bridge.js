// Runs in the page's MAIN world so it can read AngularJS scope data.
// Do not add chrome.* access or privileged extension behavior here.

import { MODERN_BRIDGE_EVENTS as EVENTS } from './events.js';
import {
    excludeForeignMeterSeries,
    normalizeAccount,
    normalizeMeterSeries,
    reconcileMeterSeries,
    reconcileStatements,
    stringValue,
} from './normalize-data.js';
import { formatStatementLabel, parseStatementDate, parseStatementKey } from './statement-data.js';

const BRIDGE_KEY = '__CSUIModernDashboardBridge__';
// Most updates are detected from Angular and the legacy panel DOM. This poll is only a
// recovery path for changes made outside those mechanisms (for example, a legacy
// controller mutating an object in place without a digest notification).
const SAFETY_POLL_MS = 15000;
const CHANGE_DEBOUNCE_MS = 50;
const FALLBACK_DELAY_MS = 2000;
const MAX_FALLBACK_ATTEMPTS = 3;

if (!window[BRIDGE_KEY]) {
    window[BRIDGE_KEY] = installBridge();
}

function installBridge() {
    let active = false;
    let timer = null;
    let publishTimeoutId = null;
    let revision = 0;
    let lastStateFingerprint = '';
    let observedScope = null;
    let observedDomRoot = null;
    let domObserver = null;
    let unwatchScope = [];
    const followUpTimeoutIds = new Set();
    const fallbackData = createFallbackDataStore();

    function start() {
        active = true;
        publishState({ force: true });
        if (!timer) {
            timer = window.setInterval(() => publishState({ force: false }), SAFETY_POLL_MS);
        }
    }

    function stop() {
        active = false;
        revision = 0;
        lastStateFingerprint = '';
        if (timer) {
            window.clearInterval(timer);
            timer = null;
        }
        if (publishTimeoutId) {
            window.clearTimeout(publishTimeoutId);
            publishTimeoutId = null;
        }
        stopObservingStateSources();
        followUpTimeoutIds.forEach((id) => window.clearTimeout(id));
        followUpTimeoutIds.clear();
        fallbackData.scheduled.forEach((id) => window.clearTimeout(id));
        fallbackData.scheduled.clear();
        fallbackData.angularWaterMetersByAccount.clear();
    }

    function requestState() {
        if (!active) return;
        publishState({ force: false });
    }

    function publishState({ force }) {
        if (!active && !force) return;

        const scope = getAccountScope();
        if (!scope) {
            dispatchState({
                ok: false,
                reason: 'account-scope-unavailable',
            });
            return;
        }

        observeStateSources(scope);
        const selectedRaw = getSelectedRawAccount(scope);
        ensureRelatedData(scope, selectedRaw, fallbackData);

        const state = buildDashboardState(scope, fallbackData);
        const fingerprint = getStateFingerprint(state);
        if (!force && fingerprint === lastStateFingerprint) return;

        lastStateFingerprint = fingerprint;
        // A monotonically increasing revision makes change handling explicit without
        // serializing the complete (and potentially very large) readings collection.
        dispatchState({ ...state, revision: (revision += 1) });
    }

    function queueStatePublish() {
        if (!active || publishTimeoutId) return;
        publishTimeoutId = window.setTimeout(() => {
            publishTimeoutId = null;
            publishState({ force: false });
        }, CHANGE_DEBOUNCE_MS);
    }

    function observeStateSources(scope) {
        if (scope !== observedScope) {
            stopObservingStateSources();
            observedScope = scope;
            observeAngularState(scope);
        }

        const domRoot = getLegacyPanelRoot();
        if (domRoot && domRoot !== observedDomRoot && window.MutationObserver) {
            domObserver?.disconnect();
            observedDomRoot = domRoot;
            domObserver = new window.MutationObserver(() => queueStatePublish());
            domObserver.observe(domRoot, {
                childList: true,
                characterData: true,
                subtree: true,
            });
        }
    }

    function observeAngularState(scope) {
        if (typeof scope.$watchCollection !== 'function') return;

        const watchCollections = [
            () => scope.displayAccounts,
            () => scope.userSelections,
            () => scope.statements,
            () => scope.waterMeterData,
            () => scope.electricMeterData,
            () => scope.waterMeters,
        ];
        const watchFlags = () => [
            scope.showPaymentButton,
            scope.allowPaperlessChange,
            scope.allowRecurring,
            scope.moreMeters,
            scope.maxNumberOfMeters,
            scope.showWaterConsumptionGraph,
            scope.accountMessage,
            scope.messageText,
        ];

        for (const getValue of watchCollections) {
            addScopeWatch(() => scope.$watchCollection(getValue, queueStatePublish));
        }
        if (typeof scope.$watch === 'function') {
            addScopeWatch(() => scope.$watch(watchFlags, queueStatePublish, true));
        }
    }

    function addScopeWatch(createWatch) {
        try {
            const unwatch = createWatch();
            if (typeof unwatch === 'function') unwatchScope.push(unwatch);
        } catch {
            // Some legacy Angular scopes expose only a partial watcher API.
        }
    }

    function stopObservingStateSources() {
        unwatchScope.forEach((unwatch) => {
            try {
                unwatch();
            } catch {
                // A destroyed legacy scope can reject watcher teardown.
            }
        });
        unwatchScope = [];
        observedScope = null;
        domObserver?.disconnect();
        domObserver = null;
        observedDomRoot = null;
    }

    function selectAccount(event) {
        const detail = event?.detail || {};
        const accountNumber = String(detail.accountNumber || '');
        const accountKey = String(detail.accountKey || '');
        if (!accountNumber && !accountKey) return;

        const scope = getAccountScope();
        if (!scope) return;

        const accounts = Array.isArray(scope.displayAccounts) ? scope.displayAccounts : [];
        const account = accounts.find((item) => {
            return (
                String(item?.PTntvfFmtPremTenant || '') === accountNumber ||
                String(item?.PNALKey || '') === accountKey
            );
        });
        if (!account) return;

        const applySelection = () => {
            try {
                if (scope.gridApi?.selection?.clearSelectedRows) {
                    scope.gridApi.selection.clearSelectedRows();
                }
                if (scope.gridApi?.selection?.selectRow) {
                    scope.gridApi.selection.selectRow(account);
                } else {
                    scope.userSelections = [account];
                }
            } catch {
                scope.userSelections = [account];
            }

            scope.currentAutoPay = account.AutoPay;
        };

        try {
            const phase = scope.$root?.$$phase;
            if (phase) applySelection();
            else scope.$apply(applySelection);
        } catch {
            try {
                applySelection();
                scope.$applyAsync?.();
            } catch {
                // Leave the legacy app in control if selection cannot be applied.
            }
        }

        scheduleFollowUpPublishes();
    }

    function performLegacyAction(event) {
        const detail = event?.detail || {};
        const action = String(detail.action || '');
        const scope = getAccountScope();
        if (!scope || !action) return;

        const selected = Array.isArray(scope.userSelections) ? scope.userSelections[0] : null;

        try {
            runInAngular(scope, () => {
                if (action === 'set-paperless-billing' && selected) {
                    selected.NameEBillConsent = detail.enabled === true;
                    scope.changePaperless?.();
                    return;
                }

                if (action === 'set-auto-pay' && selected) {
                    selected.AutoPay = detail.enabled === true;
                    scope.setAutoPayment?.();
                    return;
                }
            });
        } catch {
            // Legacy behavior owns the workflow; failures are surfaced by the isolated client timeout.
        }

        scheduleFollowUpPublishes();
    }

    function scheduleFollowUpPublishes() {
        [0, 350, 800, 1600, 3000, 5000].forEach((delay) => {
            const timeoutId = window.setTimeout(() => {
                followUpTimeoutIds.delete(timeoutId);
                if (active) publishState({ force: false });
            }, delay);
            followUpTimeoutIds.add(timeoutId);
        });
    }

    function ensureRelatedData(scope, selectedRaw, store) {
        if (!selectedRaw) return;
        const accountKey = getRawAccountKey(selectedRaw);
        if (!accountKey) return;

        if (!store.statementsByAccount.has(accountKey)) {
            requestStatements(scope, selectedRaw, accountKey, store);
        }

        if (scope.showWaterConsumptionGraph === false) return;

        if (!store.waterMetersByAccount.has(accountKey)) {
            requestWaterMeters(scope, selectedRaw, accountKey, scope.maxNumberOfMeters, store);
        }
    }

    window.addEventListener(EVENTS.start, start);
    window.addEventListener(EVENTS.stop, stop);
    window.addEventListener(EVENTS.requestState, requestState);
    window.addEventListener(EVENTS.selectAccount, selectAccount);
    window.addEventListener(EVENTS.legacyAction, performLegacyAction);

    return {
        destroy() {
            stop();
            window.removeEventListener(EVENTS.start, start);
            window.removeEventListener(EVENTS.stop, stop);
            window.removeEventListener(EVENTS.requestState, requestState);
            window.removeEventListener(EVENTS.selectAccount, selectAccount);
            window.removeEventListener(EVENTS.legacyAction, performLegacyAction);
            delete window[BRIDGE_KEY];
        },
    };
}

function createFallbackDataStore() {
    return {
        statementsByAccount: new Map(),
        waterMetersByAccount: new Map(),
        waterMeterCountsByAccount: new Map(),
        angularWaterMetersByAccount: new Map(),
        pending: new Set(),
        scheduled: new Map(),
        availableFromAngular: new Set(),
        failedAttempts: new Map(),
        retryAfter: new Map(),
    };
}

function requestStatements(scope, account, accountKey, store) {
    const requestKey = `statements:${accountKey}`;
    if (!canScheduleFallback(store, requestKey)) return;

    try {
        if (typeof scope.getStatementData === 'function') {
            // The modern dashboard renders the complete history, so request the legacy app's
            // expanded collection up front instead of recreating its client-side "More" state.
            runInAngular(scope, () => scope.getStatementData(true));
        }
    } catch {
        // The fetch fallback below is intentionally independent of Angular's promise chain.
    }

    scheduleFallbackRequest(
        store,
        requestKey,
        () => hasCurrentAccountData(scope, accountKey, 'statements'),
        async () => {
            const items = await fetchSearchArray([
                ['format', 'json'],
                ['viewID', '4'],
                ['PremiseID', account.PTntPremiseID],
                ['TenantCounter', account.PTntTenantCounter],
                ['clientID', getClientID()],
                ['clientID2', getClientID()],
                ['NumberOfStatements', scope.numberOfExpandedStatements || 20],
            ]);
            store.statementsByAccount.set(accountKey, items);
        }
    );
}

function requestWaterMeters(scope, account, accountKey, maxMeters, store) {
    const requestKey = `water-meters:${accountKey}`;
    if (!canScheduleFallback(store, requestKey)) return;

    scheduleFallbackRequest(
        store,
        requestKey,
        () => hasCurrentAccountData(scope, accountKey, 'waterMeterData'),
        async () => {
            const meters = await fetchSearchArray([
                ['format', 'json'],
                ['viewID', '5'],
                ['PremiseID', account.PTntPremiseID],
                ['clientID', getClientID()],
                ['MeterKind', 1],
            ]);
            const limit = getMeterFetchLimit(meters, maxMeters);
            store.waterMeterCountsByAccount.set(accountKey, limit);

            const series = await Promise.all(
                meters.slice(0, limit).map(async (meter) => {
                    const readings = await fetchSearchArray([
                        ['format', 'json'],
                        ['viewID', '6'],
                        ['PremiseID', account.PTntPremiseID],
                        ['TenantCounter', account.PTntTenantCounter],
                        ['MeterID', meter.MetrMeterID],
                        ['NumberOfReads', getNumberOfReadsToDisplay()],
                        ['clientID', getClientID()],
                    ]);
                    return createFallbackMeterSeries(meter, meters, readings);
                })
            );

            store.waterMetersByAccount.set(accountKey, series.filter(Boolean));
        }
    );
}

function canScheduleFallback(store, key) {
    if (store.pending.has(key) || store.scheduled.has(key)) return false;
    if (store.availableFromAngular.has(key)) return false;
    if ((store.failedAttempts.get(key) || 0) >= MAX_FALLBACK_ATTEMPTS) return false;
    return Date.now() >= (store.retryAfter.get(key) || 0);
}

function scheduleFallbackRequest(store, key, hasAngularData, task) {
    const timeoutId = window.setTimeout(() => {
        store.scheduled.delete(key);
        if (hasAngularData()) {
            store.availableFromAngular.add(key);
            return;
        }
        runFallbackRequest(store, key, task);
    }, FALLBACK_DELAY_MS);
    store.scheduled.set(key, timeoutId);
}

function hasCurrentAccountData(scope, accountKey, property) {
    if (getRawAccountKey(getSelectedRawAccount(scope)) !== accountKey) return false;
    return Array.isArray(scope[property]) && scope[property].length > 0;
}

function runFallbackRequest(store, key, task) {
    if (store.pending.has(key)) return;
    store.pending.add(key);
    window.dispatchEvent(new CustomEvent(EVENTS.requestState));

    Promise.resolve()
        .then(task)
        .then(() => {
            store.failedAttempts.delete(key);
            store.retryAfter.delete(key);
        })
        .catch(() => {
            const failures = (store.failedAttempts.get(key) || 0) + 1;
            store.failedAttempts.set(key, failures);
            store.retryAfter.set(key, Date.now() + 1000 * 2 ** (failures - 1));
        })
        .finally(() => {
            store.pending.delete(key);
            window.dispatchEvent(new CustomEvent(EVENTS.requestState));
        });
}

async function fetchSearchArray(additionalParams) {
    const response = await window.fetch(
        getServiceUrl('/Services/WebShareService.svc/searchArray'),
        {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                additionalParams: additionalParams.map(([name, value]) => ({ name, value })),
            }),
        }
    );

    if (!response.ok) throw new Error(`CSUI modern fallback request failed: ${response.status}`);

    const data = await response.json();
    return Array.isArray(data?.items) ? data.items : [];
}

function getServiceUrl(endpoint) {
    const root = getUrlRoot();
    return `${root}${endpoint}`;
}

function getUrlRoot() {
    try {
        return stringValue(window.urlRoot).replace(/\/$/, '');
    } catch {
        return '';
    }
}

function getMeterFetchLimit(meters, maxMeters) {
    if (!Array.isArray(meters)) return 0;
    const limit = Number(maxMeters);
    if (!Number.isFinite(limit) || limit <= 0) return meters.length;
    return Math.min(meters.length, limit);
}

function getNumberOfReadsToDisplay() {
    const isWide = window.matchMedia('(min-width: 992px)').matches;
    return isWide ? 13 : 8;
}

function createFallbackMeterSeries(meter, meters, readings) {
    if (!Array.isArray(readings) || !readings.length) return null;
    const values = readings.slice().reverse();
    const meterNumber = stringValue(values[0]?.MetrMeterNumber || meter?.MetrMeterNumber);
    return {
        key: meters.length <= 2 ? `Mtr Number: ${meterNumber}` : meterNumber,
        meterNumber,
        values,
    };
}

function getAccountScope() {
    const angular = window.angular;
    if (!angular?.element) return null;

    const candidates = [
        document.querySelector('[ng-controller="accountController"]'),
        document.querySelector('.container-fluid[ng-controller]'),
        document.body,
    ].filter(Boolean);

    for (const element of candidates) {
        try {
            const scope =
                angular.element(element).scope() || angular.element(element).isolateScope();
            if (isAccountScope(scope)) return scope;
        } catch {
            // Try the next candidate.
        }
    }

    return null;
}

function getLegacyPanelRoot() {
    return (
        document.querySelector('[ng-controller="accountController"]') ||
        document.querySelector('.container-fluid[ng-controller]') ||
        null
    );
}

function isAccountScope(scope) {
    return !!(scope && Array.isArray(scope.displayAccounts) && Array.isArray(scope.userSelections));
}

function buildDashboardState(scope, fallbackData) {
    const rawAccounts = Array.isArray(scope.displayAccounts) ? scope.displayAccounts : [];
    const selectedRaw = getSelectedRawAccount(scope);
    const selectedRawKey = getRawAccountKey(selectedRaw);
    const accounts = rawAccounts.map(normalizeAccount);
    const selectedAccount =
        normalizeAccount(selectedRaw) || accounts.find((account) => account.accountNumber) || null;

    const scopeStatements = Array.isArray(scope.statements)
        ? normalizeStatements(scope.statements)
        : [];
    const hasFallbackStatements =
        !!selectedRawKey && fallbackData?.statementsByAccount?.has(selectedRawKey);
    const fallbackStatements = normalizeStatements(
        fallbackData?.statementsByAccount?.get(selectedRawKey)
    );
    const reconciledStatements = reconcileStatements(scopeStatements, fallbackStatements);
    const statements = reconciledStatements.length
        ? reconciledStatements
        : normalizeStatementLinks();

    const rawScopeWaterMeters = normalizeMeterSeries(scope.waterMeterData);
    const accountScopedWaterMeters = excludeForeignMeterSeries(
        rawScopeWaterMeters,
        selectedRawKey,
        fallbackData?.angularWaterMetersByAccount
    );
    const scopeWaterMeters = limitCurrentAccountMeters(
        accountScopedWaterMeters,
        scope.maxNumberOfMeters
    );
    rememberAngularWaterMeters(fallbackData, selectedRawKey, scopeWaterMeters);
    const hasFallbackWaterMeters =
        !!selectedRawKey && fallbackData?.waterMetersByAccount?.has(selectedRawKey);
    const fallbackWaterMeters = normalizeMeterSeries(
        fallbackData?.waterMetersByAccount?.get(selectedRawKey)
    );
    // The Angular collection is the portal's current-meter set. The fallback service
    // also returns retired installations, so it may enrich matching readings but must
    // not add extra meter cards once Angular has supplied a collection.
    const waterMeters = reconcileMeterSeries(scopeWaterMeters, fallbackWaterMeters, {
        includeFallbackMeters: scopeWaterMeters.length === 0,
    });
    const electricMeters = normalizeMeterSeries(scope.electricMeterData);
    const expectedWaterMeterCount = scopeWaterMeters.length
        ? scopeWaterMeters.length
        : Math.max(
              getExpectedMeterCount(scope.waterMeters, scope.maxNumberOfMeters),
              fallbackData?.waterMeterCountsByAccount?.get(selectedRawKey) || 0
          );

    return {
        ok: true,
        accounts,
        selectedAccount,
        selectedAccountNumber: selectedAccount?.accountNumber || '',
        statements,
        waterMeters,
        electricMeters,
        flags: {
            showPaymentButton: scope.showPaymentButton === true,
            allowPaperlessChange: scope.allowPaperlessChange === true,
            allowRecurring: scope.allowRecurring === true,
            moreMeters: scope.moreMeters === true,
            expectedWaterMeterCount,
            showWaterConsumptionGraph: scope.showWaterConsumptionGraph === true,
            statementsPending:
                selectedRawKey && fallbackData?.pending?.has(`statements:${selectedRawKey}`),
            waterMetersPending:
                selectedRawKey && fallbackData?.pending?.has(`water-meters:${selectedRawKey}`),
        },
        messages: normalizeMessages(scope, selectedRaw),
        diagnostics: {
            accountCount: accounts.length,
            hasStatements: Array.isArray(scope.statements),
            hasWaterMeterData: Array.isArray(scope.waterMeterData),
            waterMeterCount: waterMeters.length,
            expectedWaterMeterCount,
            statementSource:
                hasFallbackStatements && scopeStatements.length
                    ? 'reconciled'
                    : hasFallbackStatements
                      ? 'fallback'
                      : scopeStatements.length
                        ? 'angular'
                        : 'dom',
            waterMeterSource:
                hasFallbackWaterMeters && scopeWaterMeters.length
                    ? 'reconciled'
                    : hasFallbackWaterMeters
                      ? 'fallback'
                      : 'angular',
        },
    };
}

function getStateFingerprint(state) {
    let hash = 2166136261;
    let fieldCount = 0;

    const add = (value) => {
        const text = String(value ?? '');
        for (let index = 0; index < text.length; index += 1) {
            hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
        }
        hash = Math.imul(hash ^ 0xff, 16777619);
        fieldCount += 1;
    };
    const addReadings = (meters) => {
        (Array.isArray(meters) ? meters : []).forEach((meter) => {
            add(meter?.meterNumber);
            (Array.isArray(meter?.readings) ? meter.readings : []).forEach((reading) => {
                add(reading?.date);
                add(reading?.consumption);
            });
        });
    };

    const addAccount = (account) => {
        [
            account?.accountKey,
            account?.accountNumber,
            account?.serviceAddress,
            account?.name,
            account?.currentBalance,
            account?.totalAmountDue,
            account?.lastPaymentAmount,
            account?.lastPaymentDate,
            account?.lastStatementBalance,
            account?.paperlessBilling,
            account?.autoPay,
            account?.active,
            account?.pastInactive,
            account?.inactiveStatusInferred,
            account?.statusType,
            account?.statusLabel,
            account?.statusReason,
        ].forEach(add);
    };

    add(state?.selectedAccountNumber);
    addAccount(state?.selectedAccount);
    (Array.isArray(state?.accounts) ? state.accounts : []).forEach(addAccount);
    (Array.isArray(state?.statements) ? state.statements : []).forEach((statement) => {
        add(statement?.statementKey);
        add(statement?.label);
        add(statement?.url);
    });
    addReadings(state?.waterMeters);
    addReadings(state?.electricMeters);
    Object.entries(state?.flags || {}).forEach(([key, value]) => {
        add(key);
        add(value);
    });
    (Array.isArray(state?.messages) ? state.messages : []).forEach(add);

    return `${fieldCount}:${hash >>> 0}`;
}

function getSelectedRawAccount(scope) {
    return Array.isArray(scope?.userSelections) ? scope.userSelections[0] : null;
}

function getRawAccountKey(raw) {
    if (!raw || typeof raw !== 'object') return '';
    return (
        stringValue(raw.PNALKey) ||
        stringValue(raw.PTntvfFmtPremTenant) ||
        [raw.PTntPremiseID, raw.PTntTenantCounter].map(stringValue).filter(Boolean).join(':')
    );
}

function normalizeStatements(rawStatements) {
    if (!Array.isArray(rawStatements)) return [];

    const legacyLinksByKey = getStatementLinksByKey();

    return rawStatements
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const statementKey = getStatementKey(item);
            const legacyLink = statementKey ? legacyLinksByKey.get(statementKey) : null;
            const url = getStatementUrl(item, statementKey) || legacyLink?.url || '';
            const legacyLabel =
                getStatementLabel(item) || legacyLink?.label || getStatementDateSource(item) || url;
            const label = formatStatementLabel(legacyLabel || url);
            return {
                label,
                url,
                statementKey,
            };
        })
        .filter((item) => item && (item.label || item.url));
}

function getStatementLinksByKey() {
    return new Map(
        normalizeStatementLinks()
            .filter((statement) => statement.statementKey)
            .map((statement) => [statement.statementKey, statement])
    );
}

function normalizeStatementLinks() {
    const links = Array.from(document.querySelectorAll('a[href*="StatementView.aspx?StmtKey"]'));
    return links
        .map((link) => {
            const legacyLabel = stringValue(
                link.textContent || link.getAttribute('ng-bind-template')
            );
            return {
                label: formatStatementLabel(legacyLabel),
                url: stringValue(link.getAttribute('href')),
                statementKey: stringValue(
                    new URL(link.href, window.location.href).searchParams.get('StmtKey')
                ),
            };
        })
        .filter((item) => item.label || item.url);
}

function getStatementKey(item) {
    const candidates = [
        item.StatementKey,
        item.StmtKey,
        item.statementKey,
        item.KEY,
        item.Key,
        item.PDFKey,
        item.URL,
        item.Url,
        item.url,
        item.StatementURL,
        item.StatementUrl,
        item.Link,
    ];

    for (const candidate of candidates) {
        const statementKey = parseStatementKey(candidate);
        if (statementKey) return statementKey;
    }

    return '';
}

function getStatementUrl(item, statementKey) {
    if (statementKey) {
        return `StatementView.aspx?StmtKey=${encodeURIComponent(statementKey)}&clientKey=${encodeURIComponent(
            getClientID()
        )}`;
    }

    return stringValue(
        item.URL || item.Url || item.url || item.StatementURL || item.StatementUrl || item.Link
    );
}

function getStatementLabel(item) {
    return stringValue(
        item.StatementDate ||
            item.StatementDateText ||
            item.BillDate ||
            item.StmtDate ||
            item.StatementName ||
            item.StmtDescription ||
            item.Description ||
            item.label ||
            item.Label ||
            item.Name
    );
}

function getStatementDateSource(item) {
    return (
        Object.values(item)
            .map(stringValue)
            .find((value) => !isStatementUrl(value) && parseStatementDate(value)) || ''
    );
}

function isStatementUrl(value) {
    return /StatementView\.aspx|StmtKey=/i.test(stringValue(value));
}

function limitCurrentAccountMeters(meters, maxMeters) {
    if (!Array.isArray(meters)) return [];
    // Apply the same selected-account ceiling the fallback service uses. This
    // prevents an Angular collection retained from another account from
    // bypassing the portal's own display limit.
    const limit = Number(maxMeters);
    if (!Number.isFinite(limit) || limit <= 0 || meters.length <= limit) return meters;
    return meters.slice(0, limit);
}

function rememberAngularWaterMeters(store, accountKey, meters) {
    if (!store?.angularWaterMetersByAccount || !accountKey || !meters.length) return;
    store.angularWaterMetersByAccount.set(accountKey, meters);
}

function getExpectedMeterCount(rawMeters, maxMeters) {
    if (!Array.isArray(rawMeters)) return 0;
    const limit = Number(maxMeters);
    if (!Number.isFinite(limit) || limit <= 0) return rawMeters.length;
    return Math.min(rawMeters.length, limit);
}

function normalizeMessages(scope, rawAccount) {
    const candidates = [
        rawAccount?.MobileMessage,
        rawAccount?.AccountMessage,
        rawAccount?.CustomerMessage,
        rawAccount?.Message,
        scope?.accountMessage,
        scope?.messageText,
    ]
        .map(stringValue)
        .filter(Boolean);

    const domMessage = findPanelText('Messages');
    if (domMessage) candidates.push(domMessage);

    return Array.from(new Set(candidates));
}

function findPanelText(title) {
    const panels = Array.from(document.querySelectorAll('.panel'));
    for (const panel of panels) {
        const heading = stringValue(panel.querySelector('.panel-title')?.textContent);
        if (heading.toLowerCase() !== title.toLowerCase()) continue;
        const bodyText = stringValue(panel.querySelector('.panel-body')?.textContent);
        return bodyText === title ? '' : bodyText;
    }
    return '';
}

function getClientID() {
    try {
        if (window.clientID) return String(window.clientID);
    } catch {
        // ignore
    }
    return new URL(window.location.href).searchParams.get('clientKey') || '';
}

function runInAngular(scope, fn) {
    const phase = scope.$root?.$$phase;
    if (phase) fn();
    else scope.$apply(fn);
}

function dispatchState(detail) {
    window.dispatchEvent(new CustomEvent(EVENTS.state, { detail }));
}
