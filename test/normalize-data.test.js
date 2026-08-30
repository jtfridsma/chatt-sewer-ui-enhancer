import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getAccountStatus,
    normalizeAccount,
    normalizeMeterSeries,
    numberValue,
    reconcileMeterSeries,
    reconcileStatements,
} from '../src/scripts/modern/bridge/normalize-data.js';

test('normalizes account balances and payment status', () => {
    const account = normalizeAccount({
        PTntvfFmtPremTenant: ' 123-456 ',
        PTntvfBalance: '$1,234.50',
        TotalAmtDue: '100.25',
        PTntActive: 1,
        NameEBillConsent: '1',
    });

    assert.equal(account.accountNumber, '123-456');
    assert.equal(account.currentBalance, 1234.5);
    assert.equal(account.totalAmountDue, 1234.5);
    assert.equal(account.paperlessBilling, true);
    assert.equal(account.statusType, 'due');
});

test('does not apply a customer-wide total due to a zero-balance account', () => {
    const account = normalizeAccount({
        PTntActive: 1,
        PTntvfBalance: 0,
        TotalAmtDue: 41.89,
        LastPayDate: '2020-03-06',
    });

    assert.equal(account.currentBalance, 0);
    assert.equal(account.totalAmountDue, 0);
    assert.equal(account.statusType, 'inactive');
    assert.equal(account.statusLabel, 'Inactive');
    assert.equal(
        account.statusReason,
        'No balance or amount due and no payment for roughly 18 months.'
    );
});

test('prioritizes inactive and past-due statuses', () => {
    assert.equal(
        getAccountStatus({ isPastInactive: true, explicitPastDue: true, hasPaymentDue: true }).type,
        'inactive'
    );
    assert.equal(
        getAccountStatus({ isPastInactive: false, explicitPastDue: true, hasPaymentDue: true })
            .type,
        'past-due'
    );
});

test('identifies inferred inactivity separately from authoritative portal status', () => {
    const inferred = normalizeAccount({
        PTntActive: 1,
        PTntvfBalance: 0,
        TotalAmtDue: 0,
        LastPayDate: '2020-01-01',
    });
    const authoritative = normalizeAccount({
        PTntActive: 0,
        PTntvfBalance: 0,
        TotalAmtDue: 0,
    });

    assert.equal(inferred.pastInactive, true);
    assert.equal(inferred.inactiveStatusInferred, true);
    assert.equal(authoritative.pastInactive, true);
    assert.equal(authoritative.inactiveStatusInferred, false);
});

test('drops meter readings that cannot be charted without a date', () => {
    const meters = normalizeMeterSeries([
        {
            key: 'Meter 1',
            values: [{ PMRdEndDate: '2026-08-01', Consumption: '12' }, { Consumption: '99' }],
        },
    ]);

    assert.equal(meters.length, 1);
    assert.deepEqual(meters[0].readings, [{ date: '2026-08-01', consumption: 12 }]);
    assert.equal(numberValue('not-a-number'), 0);
});

test('reconciles statement sources without allowing empty fallback data to win', () => {
    const angular = [{ statementKey: 'new', label: 'New statement', url: '/new' }];

    assert.deepEqual(reconcileStatements(angular, []), angular);
    const reconciled = reconcileStatements(angular, [
        { statementKey: 'new', label: 'Fallback duplicate', url: '/new' },
        { statementKey: 'old', label: 'Old statement', url: '/old' },
    ]);

    assert.deepEqual(
        reconciled.map((statement) => statement.statementKey),
        ['new', 'old']
    );
    assert.equal(reconciled[0].label, 'New statement');
});

test('reconciles meters using the most complete readings for each meter', () => {
    const angular = [{ meterNumber: '1', readings: [{ date: '2026-08-01', consumption: 12 }] }];
    const fallback = [
        {
            meterNumber: '1',
            readings: [
                { date: '2026-08-01', consumption: 10 },
                { date: '2026-07-01', consumption: 8 },
            ],
        },
        { meterNumber: '2', readings: [] },
    ];

    const reconciled = reconcileMeterSeries(angular, fallback);

    assert.equal(reconciled.length, 2);
    assert.equal(reconciled[0].readings.length, 2);
    assert.equal(reconciled[0].readings[0].consumption, 12);
});

test('does not add fallback-only meters to the current Angular meter collection', () => {
    const angular = [{ meterNumber: 'current', readings: [{ date: '2026-08-01' }] }];
    const fallback = [
        { meterNumber: 'current', readings: [{ date: '2026-07-01' }] },
        { meterNumber: 'retired', readings: [{ date: '2020-01-31' }] },
    ];

    const reconciled = reconcileMeterSeries(angular, fallback, {
        includeFallbackMeters: false,
    });

    assert.deepEqual(
        reconciled.map((meter) => meter.meterNumber),
        ['current']
    );
    assert.equal(reconciled[0].readings.length, 2);
});

test('reconciles meter labels that differ only by the legacy display prefix', () => {
    const angular = [
        {
            meterNumber: 'Mtr Number: 27025799',
            readings: [{ date: '2020-01-31', consumption: 8 }],
        },
    ];
    const fallback = [
        {
            meterNumber: '27025799',
            readings: [{ date: '2019-12-31', consumption: 7 }],
        },
    ];

    const reconciled = reconcileMeterSeries(angular, fallback);

    assert.deepEqual(reconciled, [
        {
            meterNumber: '27025799',
            readings: [
                { date: '2020-01-31', consumption: 8 },
                { date: '2019-12-31', consumption: 7 },
            ],
        },
    ]);
});
