const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
});
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
});
const STREET_ABBREVIATIONS = new Set(['st', 'rd', 'ave', 'dr', 'ln', 'ct', 'pl', 'blvd']);

export function extractStreetAddress(value) {
    const address = String(value || '').trim();
    if (!address) return '';

    return address
        .replace(/\s+Chattanooga,\s*TN\s+\d{5}(?:-\d{4})?$/i, '')
        .replace(/\s+\d{5}(?:-\d{4})?$/, '')
        .split(/\s+/)
        .map((part) => {
            const normalized = part.toLowerCase();
            if (!STREET_ABBREVIATIONS.has(normalized)) return part;
            return normalized.charAt(0).toUpperCase() + normalized.slice(1);
        })
        .join(' ');
}

export function normalizeReadings(readings) {
    if (!Array.isArray(readings)) return [];
    return readings
        .map((item) => ({
            date: item.date,
            consumption: Number(item.consumption) || 0,
            time: parseDateTime(item.date),
        }))
        .filter((item) => item.date)
        .sort((a, b) => a.time - b.time);
}

export function formatCurrency(value) {
    const number = Number(value);
    return CURRENCY_FORMATTER.format(Number.isFinite(number) ? number : 0);
}

export function formatOptionalCurrency(value) {
    if (value === undefined || value === null || value === '') return '';
    return formatCurrency(value);
}

export function formatDate(value) {
    return formatDateWith(value, DATE_FORMATTER);
}

export function formatShortDate(value) {
    return formatDateWith(value, SHORT_DATE_FORMATTER);
}

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function escapeAttr(value) {
    return escapeHtml(value);
}

function formatDateWith(value, formatter) {
    if (!value) return '';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : formatter.format(parsed);
}

function parseDateTime(value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}
