export const THEME_ENABLED_STORAGE_KEY = 'csui-theme-enabled';
export const THEME_ENABLED_ATTRIBUTE = 'data-csui-enabled';
export const THEME_TOGGLE_EVENT = 'csui-theme-toggle';

export function readThemeEnabled() {
    try {
        return localStorage.getItem(THEME_ENABLED_STORAGE_KEY) !== 'false';
    } catch {
        return true;
    }
}

export function persistThemeEnabled(enabled) {
    try {
        localStorage.setItem(THEME_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
        // Storage can be unavailable in restricted browsing contexts.
    }
}

export function setThemeEnabled(enabled) {
    const root = document.documentElement;
    if (!root) return;
    if (enabled) root.setAttribute(THEME_ENABLED_ATTRIBUTE, 'true');
    else root.removeAttribute(THEME_ENABLED_ATTRIBUTE);
}

export function isThemeEnabled() {
    return document.documentElement?.hasAttribute(THEME_ENABLED_ATTRIBUTE) === true;
}

export function dispatchThemeToggle(enabled) {
    window.dispatchEvent(new CustomEvent(THEME_TOGGLE_EVENT, { detail: { enabled } }));
}

export function subscribeToThemeToggle(listener) {
    window.addEventListener(THEME_TOGGLE_EVENT, listener);
    return () => window.removeEventListener(THEME_TOGGLE_EVENT, listener);
}
