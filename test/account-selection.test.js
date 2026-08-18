import test from 'node:test';
import assert from 'node:assert/strict';

import { getDefaultAccount } from '../src/scripts/modern/account-selection.js';

const inactive = { accountKey: 'inactive', pastInactive: true };
const active = { accountKey: 'active', pastInactive: false };

test('prefers an active account when the initial selection is inferred inactive', () => {
    assert.equal(
        getDefaultAccount({ accounts: [inactive, active], selectedAccount: inactive }),
        active
    );
});

test('keeps an active selection and does not force a choice when all accounts are inactive', () => {
    assert.equal(
        getDefaultAccount({ accounts: [inactive, active], selectedAccount: active }),
        null
    );
    assert.equal(
        getDefaultAccount({
            accounts: [inactive, { accountKey: 'inactive-2', pastInactive: true }],
            selectedAccount: inactive,
        }),
        null
    );
});
