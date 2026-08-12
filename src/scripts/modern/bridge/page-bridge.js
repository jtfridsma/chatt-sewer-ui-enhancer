// Runs in the page's MAIN world so it can read AngularJS scope data.
// Do not add chrome.* access or privileged extension behavior here.

const EVENTS = {
    start: 'csui-modern-dashboard:start',
    stop: 'csui-modern-dashboard:stop',
    requestState: 'csui-modern-dashboard:request-state',
    state: 'csui-modern-dashboard:state',
    selectAccount: 'csui-modern-dashboard:select-account',
    legacyAction: 'csui-modern-dashboard:legacy-action',
};

const BRIDGE_KEY = '__CSUIModernDashboardBridge__';
const POLL_MS = 800;

if (!window[BRIDGE_KEY]) {
    window[BRIDGE_KEY] = installBridge();
}

function installBridge() {
    let active = false;
    let timer = null;
    let lastStateJson = '';
    const fallbackData = createFallbackDataStore();

    function start() {
        active = true;
        publishState({ force: true });
        if (!timer) {
            timer = window.setInterval(() => publishState({ force: false }), POLL_MS);
        }
    }

    function stop() {
        active = false;
        lastStateJson = '';
        if (timer) {
            window.clearInterval(timer);
            timer = null;
        }
    }

    function requestState() {
        publishState({ force: true });
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

        const selectedRaw = getSelectedRawAccount(scope);
        ensureRelatedData(scope, selectedRaw, fallbackData);

        const payload = buildDashboardState(scope, fallbackData);
        const nextJson = safeStringify(payload);
        if (!force && nextJson === lastStateJson) return;
        lastStateJson = nextJson;
        dispatchState(payload);
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

                if (action === 'show-all-statements') {
                    scope.getStatementData?.(true);
                    return;
                }

                if (action === 'show-initial-statements') {
                    scope.getStatementData?.(false);
                }
            });
        } catch {
            // Legacy behavior owns the workflow; failures are surfaced by the isolated client timeout.
        }

        scheduleFollowUpPublishes();
    }

    function scheduleFollowUpPublishes() {
        [0, 350, 800, 1600, 3000, 5000].forEach((delay) => {
            window.setTimeout(() => publishState({ force: true }), delay);
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
            requestWaterMeters(selectedRaw, accountKey, scope.maxNumberOfMeters, store);
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
        pending: new Set(),
        attempted: new Set(),
    };
}

function requestStatements(scope, account, accountKey, store) {
    const requestKey = `statements:${accountKey}`;
    if (store.pending.has(requestKey) || store.attempted.has(requestKey)) return;

    try {
        if (typeof scope.getStatementData === 'function') {
            runInAngular(scope, () => scope.getStatementData(false));
        }
    } catch {
        // The fetch fallback below is intentionally independent of Angular's promise chain.
    }

    runFallbackRequest(store, requestKey, async () => {
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
    });
}

function requestWaterMeters(account, accountKey, maxMeters, store) {
    runFallbackRequest(store, `water-meters:${accountKey}`, async () => {
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
    });
}

function runFallbackRequest(store, key, task) {
    if (store.pending.has(key) || store.attempted.has(key)) return;
    store.pending.add(key);
    store.attempted.add(key);

    Promise.resolve()
        .then(task)
        .catch(() => {
            // The modern client can continue with Angular or DOM-derived state.
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
    const statements = hasFallbackStatements
        ? fallbackStatements
        : scopeStatements.length
          ? scopeStatements
          : normalizeStatementLinks();

    const scopeWaterMeters = normalizeMeterSeries(scope.waterMeterData);
    const hasFallbackWaterMeters =
        !!selectedRawKey && fallbackData?.waterMetersByAccount?.has(selectedRawKey);
    const fallbackWaterMeters = normalizeMeterSeries(
        fallbackData?.waterMetersByAccount?.get(selectedRawKey)
    );
    const waterMeters = hasFallbackWaterMeters ? fallbackWaterMeters : scopeWaterMeters;
    const electricMeters = normalizeMeterSeries(scope.electricMeterData);
    const expectedWaterMeterCount = Math.max(
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
            moreStatementsShow: scope.moreStatementsShow === true,
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
            statementSource: hasFallbackStatements
                ? 'fallback'
                : scopeStatements.length
                  ? 'angular'
                  : 'dom',
            waterMeterSource: hasFallbackWaterMeters ? 'fallback' : 'angular',
        },
    };
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

function normalizeAccount(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const currentBalance = numberValue(raw.PTntvfBalance);
    const totalAmountDue = numberValue(raw.TotalAmtDue ?? raw.AmtToPay ?? raw.PTntvfBalance);
    const lastPaymentDate = stringValue(raw.LastPayDate);
    const explicitInactive = raw.PTntActive === 0 || raw.PTntActive === '0';
    const lastPaymentIsVeryOld = isVeryOldDate(lastPaymentDate);
    const isPastInactive =
        explicitInactive || (currentBalance === 0 && totalAmountDue === 0 && lastPaymentIsVeryOld);
    const pastDueAmount = optionalNumber(
        raw.PastDueAmount ??
            raw.PastDue ??
            raw.PastDueAmt ??
            raw.PTntPastDue ??
            raw.PTntPastDueAmt ??
            raw.PastDueBalance ??
            raw.DelqBalance ??
            raw.DelinquentAmount
    );
    const explicitPastDue =
        booleanValue(raw.PastDue) ||
        booleanValue(raw.IsPastDue) ||
        booleanValue(raw.Delinq) ||
        booleanValue(raw.Delinquent) ||
        booleanValue(raw.PTntDelinquent) ||
        (pastDueAmount ?? 0) > 0;
    const status = getAccountStatus({
        isPastInactive,
        explicitPastDue,
        hasPaymentDue: totalAmountDue > 0,
    });

    return {
        accountNumber: stringValue(raw.PTntvfFmtPremTenant),
        serviceAddress: stringValue(raw.ServiceAddress || raw.AddrvfFullAddress),
        name: stringValue(raw.NamevfFirstLast),
        currentBalance,
        totalAmountDue,
        lastPaymentAmount: optionalNumber(raw.LastPayAmt),
        lastPaymentDate,
        lastStatementBalance: optionalNumber(raw.PTntPrevBalance),
        paperlessBilling: booleanValue(raw.NameEBillConsent),
        autoPay: booleanValue(raw.AutoPay),
        active: !explicitInactive,
        pastInactive: isPastInactive,
        statusType: status.type,
        statusLabel: status.label,
        statusReason: getAccountStatusReason({
            explicitInactive,
            lastPaymentIsVeryOld,
            explicitPastDue,
            hasPaymentDue: totalAmountDue > 0,
        }),
        premiseId: stringValue(raw.PTntPremiseID),
        tenantCounter: stringValue(raw.PTntTenantCounter),
        accountKey: stringValue(raw.PNALKey),
    };
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

function parseStatementKey(value) {
    const text = stringValue(value);
    if (!text) return '';
    if (/^\d+$/.test(text)) return text;

    const decoded = safeDecodeURIComponent(text);
    const keyMatch = decoded.match(/[?&]StmtKey=([^&]+)/i) || decoded.match(/\bStmtKey=([^&]+)/i);
    if (keyMatch) return safeDecodeURIComponent(keyMatch[1]);

    try {
        const url = new URL(decoded, window.location.href);
        return stringValue(url.searchParams.get('StmtKey'));
    } catch {
        return '';
    }
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

function formatStatementLabel(value) {
    const parsedDate = parseStatementDate(value);
    if (!parsedDate) return stringValue(value) || 'Statement';
    return `${formatStatementDate(parsedDate)} Statement`;
}

function parseStatementDate(value) {
    const text = stringValue(value);
    if (!text) return null;

    const fullYearMatch = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if (fullYearMatch) {
        return createStatementDate(fullYearMatch[1], fullYearMatch[2], fullYearMatch[3]);
    }

    const fullYearCompactMatch = text.match(/\b(20\d{2})[-/](\d{2})(\d{2})\b/);
    if (fullYearCompactMatch) {
        return createStatementDate(
            fullYearCompactMatch[1],
            fullYearCompactMatch[2],
            fullYearCompactMatch[3]
        );
    }

    const compactMatch = text.match(/\b(\d{2})(\d{2})(\d{2})\b/);
    if (compactMatch) {
        return createStatementDate(`20${compactMatch[1]}`, compactMatch[2], compactMatch[3]);
    }

    return null;
}

function safeDecodeURIComponent(value) {
    try {
        return decodeURIComponent(value);
    } catch {
        return stringValue(value);
    }
}

function createStatementDate(year, month, day) {
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== Number(year) ||
        date.getMonth() !== Number(month) - 1 ||
        date.getDate() !== Number(day)
    ) {
        return null;
    }
    return date;
}

function formatStatementDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
}

function normalizeMeterSeries(rawSeries) {
    if (!Array.isArray(rawSeries)) return [];

    return rawSeries
        .map((series) => {
            const values = Array.isArray(series?.values) ? series.values : [];
            const readings = values
                .map((reading) => ({
                    date: stringValue(reading?.PMRdEndDate || reading?.date),
                    consumption: numberValue(reading?.Consumption),
                }))
                .filter((reading) => reading.date || Number.isFinite(reading.consumption));

            return {
                meterNumber: stringValue(
                    series?.meterNumber ||
                        series?.key ||
                        values[0]?.MetrMeterNumber ||
                        values[0]?.MetrMeterID
                ),
                readings,
            };
        })
        .filter((series) => series.meterNumber || series.readings.length);
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

function stringValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function numberValue(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(String(value).replace(/[$,]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value) {
    if (value === null || value === undefined || value === '') return undefined;
    return numberValue(value);
}

function booleanValue(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
}

function isVeryOldDate(value) {
    const timestamp = parseDateTime(value);
    if (!timestamp) return false;
    const ageMs = Date.now() - timestamp;
    const ageDays = ageMs / 86400000;
    return ageDays > 548; // roughly 18 months
}

function parseDateTime(value) {
    if (!value) return 0;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getAccountStatus({ isPastInactive, explicitPastDue, hasPaymentDue }) {
    if (isPastInactive) return { type: 'inactive', label: 'Inactive' };
    if (explicitPastDue) return { type: 'past-due', label: 'Payment past due' };
    if (hasPaymentDue) return { type: 'due', label: 'Payment due' };
    return { type: 'current', label: 'Current' };
}

function getAccountStatusReason({
    explicitInactive,
    lastPaymentIsVeryOld,
    explicitPastDue,
    hasPaymentDue,
}) {
    if (explicitInactive) return 'Portal marks this account inactive.';
    if (lastPaymentIsVeryOld) return 'No balance and very old last payment date.';
    if (explicitPastDue) return 'Portal indicates a past-due or delinquent amount.';
    if (hasPaymentDue) return 'Amount due is greater than zero.';
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

function safeStringify(value) {
    try {
        return JSON.stringify(value);
    } catch {
        return '';
    }
}
