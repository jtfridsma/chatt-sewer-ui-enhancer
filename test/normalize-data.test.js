import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getAccountStatus,
    normalizeAccount,
    normalizeMeterSeries,
    numberValue,
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
    assert.equal(account.totalAmountDue, 100.25);
    assert.equal(account.paperlessBilling, true);
    assert.equal(account.statusType, 'due');
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
