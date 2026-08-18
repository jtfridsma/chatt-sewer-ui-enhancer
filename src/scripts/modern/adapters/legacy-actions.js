const ACTION_LABELS = {
    openPayment: 'Pay Now',
    openProfile: 'Update Profile',
    openChangePassword: 'Change Password',
    signOut: 'Sign Out',
};

export function createLegacyActions({ logger } = {}) {
    return Object.fromEntries(
        Object.entries(ACTION_LABELS).map(([action, label]) => [
            action,
            () => {
                logger?.log?.(`delegating ${label} to legacy application`);
                clickLegacyButton(label);
            },
        ])
    );
}

function clickLegacyButton(label) {
    const normalizedLabel = normalize(label);
    const buttons = Array.from(document.querySelectorAll('button, input[type="button"]'));
    const button = buttons.find(
        (item) => normalize(item.textContent || item.value) === normalizedLabel
    );
    if (!button) throw new Error(`Legacy action button not found: ${label}`);
    button.click();
}

function normalize(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}
