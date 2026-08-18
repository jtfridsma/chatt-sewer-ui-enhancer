import test from 'node:test';
import assert from 'node:assert/strict';

import {
    formatStatementLabel,
    parseStatementDate,
    parseStatementKey,
} from '../src/scripts/modern/bridge/statement-data.js';
import {
    escapeHtml,
    extractStreetAddress,
    normalizeReadings,
} from '../src/scripts/modern/components/dashboard-format.js';

test('parses statement keys and supported date formats', () => {
    assert.equal(parseStatementKey('StatementView.aspx?StmtKey=12345&clientKey=3652'), '12345');
    assert.equal(parseStatementKey('StmtKey=abc%20123'), 'abc 123');
    assert.equal(parseStatementDate('2026-02-29'), null);
    assert.equal(formatStatementLabel('2026-08-17'), 'August 17, 2026 Statement');
});

test('formats dashboard display data safely', () => {
    assert.equal(extractStreetAddress('1250 MARKET ST Chattanooga, TN 37402'), '1250 MARKET St');
    assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
    assert.deepEqual(
        normalizeReadings([
            { date: '2026-08-02', consumption: 2 },
            { date: '2026-08-01', consumption: 1 },
            { consumption: 3 },
        ]).map(({ date, consumption }) => ({ date, consumption })),
        [
            { date: '2026-08-01', consumption: 1 },
            { date: '2026-08-02', consumption: 2 },
        ]
    );
});
