export function createLegacyActions({ logger } = {}) {
    return {
        openPayment() {
            logger?.log?.('delegating Pay Now to legacy application');
            clickLegacyButton('Pay Now');
        },
        openProfile() {
            logger?.log?.('delegating Update Profile to legacy application');
            clickLegacyButton('Update Profile');
        },
        openChangePassword() {
            logger?.log?.('delegating Change Password to legacy application');
            clickLegacyButton('Change Password');
        },
        signOut() {
            logger?.log?.('delegating Sign Out to legacy application');
            clickLegacyButton('Sign Out');
        },
    };
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
