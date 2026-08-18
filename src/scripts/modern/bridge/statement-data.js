import { stringValue } from './normalize-data.js';

const STATEMENT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
});

export function parseStatementKey(value) {
    const text = stringValue(value);
    if (!text) return '';
    if (/^\d+$/.test(text)) return text;

    const decoded = safeDecodeURIComponent(text);
    const keyMatch = decoded.match(/[?&]StmtKey=([^&]+)/i) || decoded.match(/\bStmtKey=([^&]+)/i);
    if (keyMatch) return safeDecodeURIComponent(keyMatch[1]);

    try {
        return stringValue(
            new URL(decoded, 'https://share.dwcorp.com/').searchParams.get('StmtKey')
        );
    } catch {
        return '';
    }
}

export function formatStatementLabel(value) {
    const parsedDate = parseStatementDate(value);
    if (!parsedDate) return stringValue(value) || 'Statement';
    return `${STATEMENT_DATE_FORMATTER.format(parsedDate)} Statement`;
}

export function parseStatementDate(value) {
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
