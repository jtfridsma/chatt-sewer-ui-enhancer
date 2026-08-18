export function normalizeAccount(raw) {
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

export function stringValue(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
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
    if (lastPaymentIsVeryOld) return 'No balance and very old last payment date.';
    if (explicitPastDue) return 'Portal indicates a past-due or delinquent amount.';
    if (hasPaymentDue) return 'Amount due is greater than zero.';
    return '';
}
