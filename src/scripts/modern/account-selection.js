export function getDefaultAccount(state) {
    const accounts = Array.isArray(state?.accounts) ? state.accounts : [];
    const selected = state?.selectedAccount;
    // Intentional product behavior: `pastInactive` includes the documented zero-due/low-activity
    // inference. Prefer a more active account on initial load so likely payment work is foregrounded.
    const preferred = accounts.find((account) => account && !account.pastInactive);

    if (!preferred) return null;
    if (!selected) return preferred;
    if (selected.pastInactive) return preferred;
    return null;
}
