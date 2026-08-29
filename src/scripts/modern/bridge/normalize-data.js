export function normalizeAccount(raw) {
    if (!raw || typeof raw !== 'object') return null;
    // TotalAmtDue is a customer-level total in the WebShare account list. Use the
    // per-account balance first so one account's debt cannot make another account
    // appear due or active.
    const accountAmountDue = raw.PTntvfBalance ?? raw.AmtToPay;
    const currentBalance = numberValue(accountAmountDue);
    const totalAmountDue = currentBalance;
    const lastPaymentDate = stringValue(raw.LastPayDate);
    const explicitInactive = raw.PTntActive === 0 || raw.PTntActive === '0';
    const lastPaymentIsVeryOld = isVeryOldDate(lastPaymentDate);
    // Product decision: low-activity, zero-due accounts are treated as inactive even when the
    // portal does not explicitly mark them that way. The dashboard uses this to prioritize a
    // more active default account; the UI discloses the inference on inactive account details.
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
        inactiveStatusInferred: isPastInactive && !explicitInactive,
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

export function normalizeMeterSeries(rawSeries) {
    if (!Array.isArray(rawSeries)) return [];

    return rawSeries
        .map((series) => {
            const values = Array.isArray(series?.values) ? series.values : [];
            const readings = values
                .map((reading) => ({
                    date: stringValue(reading?.PMRdEndDate || reading?.date),
                    consumption: numberValue(reading?.Consumption ?? reading?.consumption),
                }))
                .filter((reading) => reading.date);

            return {
                meterNumber: normalizeMeterNumber(
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

export function reconcileStatements(angularStatements, fallbackStatements) {
    const merged = mergeCompleteCollections(
        [angularStatements, fallbackStatements],
        (statement) => statement?.statementKey || statement?.url || statement?.label
    );
    const angularByKey = indexByKey(
        angularStatements,
        (statement) => statement?.statementKey || statement?.url || statement?.label
    );

    return merged.map((statement) => {
        const key = statement?.statementKey || statement?.url || statement?.label;
        return angularByKey.get(String(key || '')) || statement;
    });
}

export function reconcileMeterSeries(angularMeters, fallbackMeters) {
    const getMeterKey = (meter) => normalizeMeterNumber(meter?.meterNumber);
    const merged = mergeCompleteCollections([angularMeters, fallbackMeters], getMeterKey);
    const angularByMeter = indexByKey(angularMeters, getMeterKey);
    const fallbackByMeter = indexByKey(fallbackMeters, getMeterKey);

    return merged.map((meter) => {
        const key = String(getMeterKey(meter) || '');
        const angularMeter = angularByMeter.get(key);
        const fallbackMeter = fallbackByMeter.get(key);
        const readings = mergeCompleteCollections(
            [angularMeter?.readings, fallbackMeter?.readings],
            (reading) => reading?.date
        );
        const angularReadingsByDate = indexByKey(
            angularMeter?.readings,
            (reading) => reading?.date
        );

        return {
            ...(fallbackMeter || {}),
            ...(angularMeter || {}),
            meterNumber: key,
            readings: readings.map(
                (reading) => angularReadingsByDate.get(String(reading?.date || '')) || reading
            ),
        };
    });
}

function indexByKey(collection, getKey) {
    return new Map(
        (Array.isArray(collection) ? collection : [])
            .map((item) => [String(getKey(item) || ''), item])
            .filter(([key]) => key)
    );
}

function mergeCompleteCollections(collections, getKey, chooseItem = (current) => current) {
    const available = collections.filter(Array.isArray);
    const base = available.reduce(
        (best, collection) => (collection.length > best.length ? collection : best),
        []
    );
    const orderedSources = [base, ...available.filter((collection) => collection !== base)];
    const merged = [];
    const indexesByKey = new Map();

    orderedSources.forEach((collection) => {
        collection.forEach((item) => {
            if (!item) return;
            const key = String(getKey(item) || '');
            if (!key) {
                merged.push(item);
                return;
            }

            const existingIndex = indexesByKey.get(key);
            if (existingIndex === undefined) {
                indexesByKey.set(key, merged.length);
                merged.push(item);
                return;
            }

            merged[existingIndex] = chooseItem(merged[existingIndex], item);
        });
    });

    return merged;
}

export function stringValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function normalizeMeterNumber(value) {
    return stringValue(value).replace(/^Mtr\s+Number:\s*/i, '');
}

export function numberValue(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(String(value).replace(/[$,]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

export function optionalNumber(value) {
    if (value === null || value === undefined || value === '') return undefined;
    return numberValue(value);
}

export function booleanValue(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
}

export function isVeryOldDate(value, now = Date.now()) {
    const timestamp = parseDateTime(value);
    if (!timestamp) return false;
    return (now - timestamp) / 86400000 > 548;
}

export function parseDateTime(value) {
    if (!value) return 0;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function getAccountStatus({ isPastInactive, explicitPastDue, hasPaymentDue }) {
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
    if (explicitPastDue) return 'Portal indicates a past-due or delinquent amount.';
    if (hasPaymentDue) return 'Amount due is greater than zero.';
    if (lastPaymentIsVeryOld)
        return 'No balance or amount due and no payment for roughly 18 months.';
    return '';
}
