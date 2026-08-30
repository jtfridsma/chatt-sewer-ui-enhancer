import { escapeAttr, escapeHtml } from './dashboard-format.js';

export function renderHeader() {
    const logo = getPortalLogo();
    return `
        <header class="modern-header">
            <div class="modern-header__content">
                <div class="modern-header__identity">
                    ${logo ? renderHeaderLogo(logo) : ''}
                    <div class="modern-header__text">
                        <p class="eyebrow">Chattanooga Sewer Payment Portal</p>
                        <h1>Dashboard</h1>
                    </div>
                </div>
                <nav class="modern-header__actions" aria-label="Account actions">
                    <details class="action-menu action-menu--account action-menu--desktop" data-action-menu>
                        <summary>
                            <span>Account</span>
                            ${renderIcon('keyboard_arrow_down', 'action-menu__icon')}
                        </summary>
                        <div class="action-menu__panel">
                            <button type="button" class="menu-button" data-action="profile">
                                ${renderIcon('account_circle', 'button-icon')}
                                <span>Update Profile</span>
                            </button>
                            <button type="button" class="menu-button" data-action="password">
                                ${renderIcon('lock', 'button-icon')}
                                <span>Change Password</span>
                            </button>
                        </div>
                    </details>
                    <button type="button" class="ghost-action action-menu--desktop" data-action="sign-out">
                        ${renderIcon('logout', 'button-icon')}
                        <span>Sign Out</span>
                    </button>
                    <details class="action-menu action-menu--mobile" data-action-menu>
                        <summary aria-label="Open account menu" title="Account menu">
                            ${renderIcon('menu', 'action-menu__icon')}
                        </summary>
                        <div class="action-menu__panel">
                            <button type="button" class="menu-button" data-action="profile">
                                ${renderIcon('account_circle', 'button-icon')}
                                <span>Update Profile</span>
                            </button>
                            <button type="button" class="menu-button" data-action="password">
                                ${renderIcon('lock', 'button-icon')}
                                <span>Change Password</span>
                            </button>
                            <div class="menu-divider" role="separator"></div>
                            <button type="button" class="menu-button" data-action="sign-out">
                                ${renderIcon('logout', 'button-icon')}
                                <span>Sign Out</span>
                            </button>
                        </div>
                    </details>
                </nav>
            </div>
        </header>
    `;
}

export function renderSettingsToggles({ selected, flags }) {
    const account = selected || {};
    const paperlessDisabled = flags.allowPaperlessChange === false;
    const autoPayDisabled = flags.allowRecurring === false;

    return `
        <label class="setting-toggle ${paperlessDisabled ? 'is-disabled' : ''}">
            ${renderIcon('receipt_long', 'setting-toggle__icon')}
            <span>
                <span class="setting-toggle__title">Paperless Billing</span>
                <span class="setting-toggle__hint">${account.paperlessBilling ? 'On' : 'Off'}</span>
            </span>
            <input type="checkbox" data-toggle-setting="paperless" ${account.paperlessBilling ? 'checked' : ''} ${paperlessDisabled ? 'disabled' : ''} />
            <span class="switch-ui" aria-hidden="true"></span>
        </label>
        <label class="setting-toggle ${autoPayDisabled ? 'is-disabled' : ''}">
            ${renderIcon('autorenew', 'setting-toggle__icon')}
            <span>
                <span class="setting-toggle__title">Automatic Payment Plan</span>
                <span class="setting-toggle__hint">${account.autoPay ? 'On' : 'Off'}</span>
            </span>
            <input type="checkbox" data-toggle-setting="autopay" ${account.autoPay ? 'checked' : ''} ${autoPayDisabled ? 'disabled' : ''} />
            <span class="switch-ui" aria-hidden="true"></span>
        </label>
    `;
}

export function renderDashboardHelper() {
    return `
        <aside class="dashboard-helper" aria-label="Dashboard help and service contacts">
            <p>
                Trouble with this enhanced dashboard? Try disabling the plugin, or
                <a href="https://github.com/jtfridsma/chatt-sewer-ui-enhancer/issues/new" target="_blank" rel="noopener noreferrer">report an issue</a>.
            </p>
            <p>
                For sewer service or payment issues, contact 311 at
                <a href="tel:+14236436311">(423) 643-6311</a> or
                <a href="mailto:311@chattanooga.gov">311@chattanooga.gov</a>.
            </p>
        </aside>
    `;
}

export function renderIcon(name, className = '') {
    return `<span class="material-symbols-rounded icon ${escapeAttr(className)}" aria-hidden="true">${escapeHtml(name)}</span>`;
}

function getPortalLogo() {
    const logoImage =
        document.querySelector('#masterLogo img') ||
        document.querySelector('#masterLogo[src]') ||
        document.querySelector('img[src*="logo" i]');
    const src = logoImage?.currentSrc || logoImage?.src || logoImage?.getAttribute?.('src') || '';
    if (!src) return null;

    return {
        src,
        alt: logoImage.getAttribute?.('alt') || 'Chattanooga',
    };
}

function renderHeaderLogo(logo) {
    return `<img class="modern-header__logo" src="${escapeAttr(logo.src)}" alt="${escapeAttr(logo.alt)}" />`;
}
