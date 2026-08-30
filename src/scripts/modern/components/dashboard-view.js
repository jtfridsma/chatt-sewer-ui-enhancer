import { mountConsumptionCharts } from './lazy-consumption-chart.js';
import { DASHBOARD_STYLES } from '../styles/dashboard-styles.js';
import {
    escapeAttr,
    escapeHtml,
    extractStreetAddress,
    formatCurrency,
    formatDate,
    formatOptionalCurrency,
    formatShortDate,
    normalizeReadings,
} from './dashboard-format.js';
import {
    renderDashboardHelper,
    renderHeader,
    renderIcon,
    renderSettingsToggles,
} from './dashboard-fragments.js';
import { replaceChildrenFromSanitizedMarkup } from './safe-dom.js';

export function createDashboardView({ host, actions }) {
    const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
    let currentState = null;
    let currentAccountValue = '';
    let selectedWaterMeterKey = '';
    let selectedDetailTab = 'summary';
    let chartInstances = [];
    let detachActionMenuEvents = () => {};
    let sidebarLayoutFrame = null;
    let renderGeneration = 0;

    const style = document.createElement('style');
    style.textContent = DASHBOARD_STYLES;
    const content = document.createElement('div');
    shadow.replaceChildren(style, content);
    content.addEventListener('click', handleContentClick);
    content.addEventListener('change', handleContentChange);
    content.addEventListener('keydown', handleContentKeydown);

    const scheduleSidebarLayout = () => {
        if (sidebarLayoutFrame !== null) return;
        sidebarLayoutFrame = window.requestAnimationFrame(() => {
            sidebarLayoutFrame = null;
            syncSidebarHeight();
        });
    };

    const syncSidebarHeight = () => {
        const sidebar = shadow.querySelector('.dashboard-sidebar');
        if (!sidebar || window.innerWidth <= 900) return;

        const viewportInset = 16;
        const top = Math.max(viewportInset, sidebar.getBoundingClientRect().top);
        const height = Math.max(0, window.innerHeight - top - viewportInset);
        const nextHeight = `${height}px`;
        if (sidebar.style.getPropertyValue('--dashboard-sidebar-height') !== nextHeight) {
            sidebar.style.setProperty('--dashboard-sidebar-height', nextHeight);
        }
    };

    window.addEventListener('scroll', scheduleSidebarLayout, { passive: true });
    window.addEventListener('resize', scheduleSidebarLayout);

    function renderLoading() {
        renderGeneration += 1;
        detachActionMenuEvents();
        detachActionMenuEvents = () => {};
        destroyCharts();
        replaceChildrenFromSanitizedMarkup(
            content,
            `
            <main class="shell" aria-busy="true">
                <section class="panel">
                    <div class="empty">${renderInlineLoading('Loading account dashboard...')}</div>
                </section>
            </main>
        `
        );
    }

    function render(state) {
        const generation = ++renderGeneration;
        const focusTarget = captureFocusTarget(shadow.activeElement);
        destroyCharts();
        currentState = state;
        const accounts = Array.isArray(state?.accounts) ? state.accounts.filter(Boolean) : [];
        const selected = state?.selectedAccount || accounts[0] || null;
        const accountValue = getAccountValue(selected);

        if (accountValue !== currentAccountValue) {
            currentAccountValue = accountValue;
            selectedWaterMeterKey = '';
        }

        replaceChildrenFromSanitizedMarkup(
            content,
            `
            <main class="shell" aria-label="Account dashboard">
                ${renderHeader()}
                ${
                    selected
                        ? renderDashboardGrid({
                              state,
                              accounts,
                              selected,
                              selectedWaterMeterKey,
                              selectedDetailTab,
                          })
                        : `<section class="panel"><div class="empty">No account data is available.</div></section>`
                }
            </main>
        `
        );

        bindEvents();
        restoreFocusTarget(focusTarget);
        mountConsumptionCharts(content)
            .then((charts) => {
                if (generation !== renderGeneration) {
                    charts.forEach((chart) => chart.destroy());
                    return;
                }
                chartInstances = charts;
            })
            .catch(logConsumptionChartFailure);
        scheduleSidebarLayout();
    }

    function destroy() {
        renderGeneration += 1;
        detachActionMenuEvents();
        detachActionMenuEvents = () => {};
        window.removeEventListener('scroll', scheduleSidebarLayout);
        window.removeEventListener('resize', scheduleSidebarLayout);
        content.removeEventListener('click', handleContentClick);
        content.removeEventListener('change', handleContentChange);
        content.removeEventListener('keydown', handleContentKeydown);
        if (sidebarLayoutFrame !== null) window.cancelAnimationFrame(sidebarLayoutFrame);
        sidebarLayoutFrame = null;
        destroyCharts();
        content.replaceChildren();
        currentState = null;
        currentAccountValue = '';
        selectedWaterMeterKey = '';
        selectedDetailTab = 'summary';
    }

    function destroyCharts() {
        chartInstances.forEach((chart) => chart.destroy());
        chartInstances = [];
    }

    function bindEvents() {
        detachActionMenuEvents();
        detachActionMenuEvents = bindActionMenuEvents();
    }

    function handleContentClick(event) {
        if (!(event.target instanceof Element)) return;

        const accountControl = event.target.closest('[data-account-option]');
        if (accountControl) {
            const value = accountControl.getAttribute('data-account-option') || '';
            const account = currentState?.accounts?.find((item) => getAccountValue(item) === value);
            if (account) actions?.selectAccount?.(account);
            return;
        }

        const detailTab = event.target.closest('[data-detail-tab]');
        if (detailTab) {
            selectedDetailTab = detailTab.getAttribute('data-detail-tab') || 'summary';
            if (currentState) render(currentState);
            return;
        }

        const actionControl = event.target.closest('[data-action]');
        if (actionControl) {
            const action = actionControl.getAttribute('data-action');
            if (action === 'pay-now') actions?.openPayment?.();
            if (action === 'profile') actions?.openProfile?.();
            if (action === 'password') actions?.openChangePassword?.();
            if (action === 'sign-out') actions?.signOut?.();
            closeActionMenus();
            event.preventDefault();
            return;
        }

        const meterTab = event.target.closest('[data-meter-tab]');
        if (meterTab) {
            selectedWaterMeterKey = meterTab.getAttribute('data-meter-tab') || '';
            if (currentState) render(currentState);
        }
    }

    function handleContentChange(event) {
        if (!(event.target instanceof HTMLInputElement)) return;
        const setting = event.target.getAttribute('data-toggle-setting');
        if (setting === 'paperless') actions?.setPaperlessBilling?.(event.target.checked);
        if (setting === 'autopay') actions?.setAutoPay?.(event.target.checked);
    }

    function handleContentKeydown(event) {
        if (!(event.target instanceof Element)) return;
        const control = event.target.closest(
            '[data-account-option], [data-detail-tab], [data-meter-tab]'
        );
        if (!control) return;

        const attribute = control.hasAttribute('data-account-option')
            ? 'data-account-option'
            : control.hasAttribute('data-detail-tab')
              ? 'data-detail-tab'
              : 'data-meter-tab';
        const controls = Array.from(content.querySelectorAll(`[${attribute}]`));
        const nextIndex = getNextTabIndex(event, controls.indexOf(control), controls.length);
        if (nextIndex < 0) return;
        event.preventDefault();
        const nextControl = controls[nextIndex];
        nextControl?.focus();
        if (attribute !== 'data-account-option') nextControl?.click();
    }

    function bindActionMenuEvents() {
        const menus = Array.from(shadow.querySelectorAll('[data-action-menu]'));
        if (!menus.length) return () => {};

        const closeMenusOutside = (event) => {
            const path = event.composedPath();
            menus.forEach((menu) => {
                if (menu.open && !path.includes(menu)) menu.open = false;
            });
        };
        const closeMenusOnEscape = (event) => {
            if (event.key !== 'Escape') return;
            const openMenu = menus.find((menu) => menu.open);
            if (!openMenu) return;
            openMenu.open = false;
            openMenu.querySelector('summary')?.focus();
        };
        const keepOneMenuOpen = (event) => {
            const openedMenu = event.currentTarget;
            if (!openedMenu.open) return;
            menus.forEach((menu) => {
                if (menu !== openedMenu) menu.open = false;
            });
        };

        document.addEventListener('click', closeMenusOutside);
        document.addEventListener('keydown', closeMenusOnEscape);
        menus.forEach((menu) => menu.addEventListener('toggle', keepOneMenuOpen));
        return () => {
            document.removeEventListener('click', closeMenusOutside);
            document.removeEventListener('keydown', closeMenusOnEscape);
            menus.forEach((menu) => menu.removeEventListener('toggle', keepOneMenuOpen));
        };
    }

    function closeActionMenus() {
        shadow.querySelectorAll('[data-action-menu][open]').forEach((menu) => {
            menu.open = false;
        });
    }

    function restoreFocusTarget(target) {
        if (!target) return;
        if (target.id) {
            content.querySelector(`#${CSS.escape(target.id)}`)?.focus();
            return;
        }
        const match = Array.from(content.querySelectorAll(`[${target.attribute}]`)).find(
            (element) => element.getAttribute(target.attribute) === target.value
        );
        match?.focus();
    }

    return {
        renderLoading,
        render,
        destroy,
    };
}

function captureFocusTarget(element) {
    if (!(element instanceof Element)) return null;
    if (element.id) return { id: element.id };

    const attribute = [
        'data-account-option',
        'data-detail-tab',
        'data-meter-tab',
        'data-action',
    ].find((name) => element.hasAttribute(name));
    return attribute ? { attribute, value: element.getAttribute(attribute) } : null;
}

function getNextTabIndex(event, index, length) {
    if (!length) return -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') return (index + 1) % length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') return (index - 1 + length) % length;
    if (event.key === 'Home') return 0;
    if (event.key === 'End') return length - 1;
    return -1;
}

function renderDashboardGrid({
    state,
    accounts,
    selected,
    selectedWaterMeterKey,
    selectedDetailTab,
}) {
    const flags = state.flags || {};
    const loading = state.loading || {};
    const statements = Array.isArray(state.statements) ? state.statements : [];
    const messages = Array.isArray(state.messages) ? state.messages : [];
    const waterMeters = Array.isArray(state.waterMeters) ? state.waterMeters : [];

    return `
        <div class="dashboard-layout">
            <div class="dashboard-sidebar">
                ${renderAccountSidebar({ accounts, selected })}
                ${renderDashboardHelper()}
            </div>
            <div class="dashboard-content">
                ${renderAccountOverview({ account: selected, flags })}
                ${renderDetailTabs({
                    selected,
                    flags,
                    statements,
                    messages,
                    waterMeters,
                    loading,
                    selectedDetailTab,
                    selectedWaterMeterKey,
                })}
            </div>
        </div>
    `;
}

function renderAccountSidebar({ accounts, selected }) {
    const activeAccounts = accounts.filter((account) => !isInactiveAccount(account));
    const inactiveAccounts = accounts.filter(isInactiveAccount);

    return `
        <aside class="account-sidebar" aria-labelledby="csui-modern-accounts-heading">
            <div class="account-sidebar__header">
                <h2 id="csui-modern-accounts-heading">All Accounts (${escapeHtml(accounts.length)})</h2>
            </div>
            <div class="account-list">
                ${renderAccountSidebarGroup('Active', activeAccounts, selected)}
                ${renderAccountSidebarGroup('Inactive', inactiveAccounts, selected)}
            </div>
        </aside>
    `;
}

function renderAccountSidebarGroup(label, accounts, selected) {
    if (!accounts.length) return '';
    return `
        <section class="account-group" aria-label="${escapeAttr(label)} accounts">
            <h3>${escapeHtml(label)} (${escapeHtml(accounts.length)})</h3>
            <div class="account-group__items">
                ${accounts.map((account) => renderAccountSidebarItem(account, selected)).join('')}
            </div>
        </section>
    `;
}

function renderAccountSidebarItem(account, selected) {
    const isSelected = isSameAccount(account, selected);

    return `
        <button
            type="button"
            class="account-nav-item ${isSelected ? 'is-selected' : ''}"
            data-account-option="${escapeAttr(getAccountValue(account))}"
            aria-current="${isSelected ? 'true' : 'false'}"
        >
            <span class="account-nav-item__top">
                <span class="account-nav-item__address">${escapeHtml(extractStreetAddress(account.serviceAddress) || 'Service address unavailable')}</span>
                ${renderStatusPill(account)}
            </span>
            <span class="account-nav-item__details account-nav-item__label">
                <span>${escapeHtml(account.accountNumber || 'Account')}</span>
                <span aria-hidden="true">•</span>
                <span>Balance ${escapeHtml(formatCurrency(account.currentBalance))}</span>
            </span>
        </button>
    `;
}

function renderAccountOverview({ account, flags }) {
    const canPay = flags.showPaymentButton !== false;
    const streetAddress =
        extractStreetAddress(account.serviceAddress) || 'Service address unavailable';
    const lastPayment = [
        formatOptionalCurrency(account.lastPaymentAmount),
        formatDate(account.lastPaymentDate),
    ]
        .filter(Boolean)
        .join(' · ');
    return `
        <section class="panel account-overview" aria-labelledby="csui-modern-overview-heading">
            <div class="account-overview__body">
                <div class="account-overview__identity">
                    <p class="account-overview__label">Account</p>
                    <h2 id="csui-modern-overview-heading">${escapeHtml(streetAddress)}</h2>
                </div>
                <dl class="account-overview__facts">
                    <div>
                        <dt>Account Number</dt>
                        <dd>${escapeHtml(account.accountNumber || 'Account')}</dd>
                    </div>
                    <div>
                        <dt class="account-status-label">
                            <span>Account Status</span>
                            ${renderInactiveStatusInfo(account)}
                        </dt>
                        <dd>${renderStatusPill(account)}</dd>
                    </div>
                    <div>
                        <dt>Current Balance</dt>
                        <dd>${formatCurrency(account.currentBalance)}</dd>
                    </div>
                    <div>
                        <dt>Last Payment</dt>
                        <dd>${escapeHtml(lastPayment || 'Not available')}</dd>
                    </div>
                </dl>
                <div class="account-overview__amount" aria-label="Amount due">
                    <div class="account-overview__amount-primary">
                        <span class="account-overview__label">Amount Due</span>
                        <strong>${formatCurrency(account.totalAmountDue)}</strong>
                    </div>
                    ${
                        canPay
                            ? `<button class="primary-action" type="button" data-action="pay-now">Pay Now</button>`
                            : ''
                    }
                </div>
            </div>
        </section>
    `;
}

function renderDetailTabs({
    selected,
    flags,
    statements,
    messages,
    waterMeters,
    loading,
    selectedDetailTab,
    selectedWaterMeterKey,
}) {
    const tabs = [
        ['summary', 'Summary'],
        ['statements', 'Statements'],
        ['messages', 'Messages'],
        ['billing', 'Preferences'],
    ];
    const activeTab = tabs.some(([id]) => id === selectedDetailTab) ? selectedDetailTab : 'summary';

    return `
        <section class="detail-tabs" aria-label="Account details">
            <div class="detail-tabs__list" role="tablist" aria-label="Account detail sections">
                ${tabs
                    .map(([id, label]) => {
                        const selected = id === activeTab;
                        return `
                            <button
                                type="button"
                                class="detail-tab ${selected ? 'is-selected' : ''}"
                                role="tab"
                                id="csui-modern-tab-${id}"
                                aria-selected="${selected ? 'true' : 'false'}"
                                aria-controls="csui-modern-tab-panel"
                                data-detail-tab="${escapeAttr(id)}"
                            >
                                ${escapeHtml(label)}
                            </button>
                        `;
                    })
                    .join('')}
            </div>
            <div
                id="csui-modern-tab-panel"
                class="detail-tabs__panel ${activeTab === 'summary' ? 'detail-tabs__panel--summary' : 'panel'}"
                role="tabpanel"
                aria-labelledby="csui-modern-tab-${escapeAttr(activeTab)}"
            >
                ${renderActiveDetailPanel({
                    activeTab,
                    selected,
                    flags,
                    statements,
                    messages,
                    waterMeters,
                    loading,
                    selectedWaterMeterKey,
                })}
            </div>
        </section>
    `;
}

function renderActiveDetailPanel({
    activeTab,
    selected,
    flags,
    statements,
    messages,
    waterMeters,
    loading,
    selectedWaterMeterKey,
}) {
    if (activeTab === 'statements') {
        return renderStatementsPanel({ statements, loading: loading.statements });
    }
    if (activeTab === 'messages') return renderMessagesPanel(messages);
    if (activeTab === 'billing') return renderBillingPanel({ selected, flags });
    return renderAccountSummaryTab({
        account: selected,
        waterMeters,
        flags,
        loading: loading.waterMeters,
        selectedWaterMeterKey,
    });
}

function renderStatusPill(account) {
    return `
        <span class="status-pill status-pill--${escapeAttr(account.statusType || (account.pastInactive ? 'inactive' : 'current'))}" title="${escapeAttr(account.statusReason || '')}">
            ${renderIcon(getStatusIconName(account), 'status-pill__icon')}
            ${escapeHtml(account.statusLabel || (account.pastInactive ? 'Inactive' : 'Current'))}
        </span>
    `;
}

function renderInactiveStatusInfo(account) {
    if (!isInactiveAccount(account)) {
        return '<span class="account-status-info account-status-info--placeholder" aria-hidden="true"></span>';
    }

    const explanation = account.inactiveStatusInferred
        ? 'Inactive account status inferred due to no balance or amount due and no payment activity for roughly 18 months.'
        : 'Inactive account status provided by the payment portal.';

    return `
        <button
            class="account-status-info"
            type="button"
            aria-label="About inactive account status"
            aria-describedby="csui-modern-inactive-status-tooltip"
        >
            ${renderIcon('info', 'account-status-info__icon')}
            <span id="csui-modern-inactive-status-tooltip" class="account-status-tooltip" role="tooltip">
                ${escapeHtml(explanation)}
            </span>
        </button>
    `;
}

function renderAccountSummaryTab({ account, waterMeters, flags, loading, selectedWaterMeterKey }) {
    const fields = [
        ['Name', account.name],
        ['Service Address', account.serviceAddress],
        ['Account Number', account.accountNumber],
        ['Last Statement Balance', formatOptionalCurrency(account.lastStatementBalance)],
        ['Last Payment', formatOptionalCurrency(account.lastPaymentAmount)],
        ['Last Payment Date', formatDate(account.lastPaymentDate)],
        ['Current Balance', formatCurrency(account.currentBalance)],
    ];

    return `
        <div class="summary-tab">
            <section class="panel summary-card" aria-labelledby="csui-modern-account-information-heading">
                <div class="panel__body">
                    <h2 id="csui-modern-account-information-heading">Account Information</h2>
                    <dl class="summary-grid">
                        ${fields.map(([label, value]) => renderSummaryField(label, value)).join('')}
                    </dl>
                </div>
            </section>
            <section class="panel summary-card" aria-labelledby="csui-modern-water-heading">
                <div class="panel__body">
                    ${renderConsumptionPanel({
                        waterMeters,
                        flags,
                        loading,
                        selectedWaterMeterKey,
                    })}
                </div>
            </section>
        </div>
    `;
}

function renderStatementsPanel({ statements, loading }) {
    const hasStatements = statements.length > 0;

    return `
        <div class="tab-list-panel">
            ${
                loading
                    ? renderInlineLoading('Loading statement history...')
                    : hasStatements
                      ? `<ul class="statement-list">${statements.map(renderStatement).join('')}</ul>`
                      : `<p class="empty-inline">No statements are available for this account.</p>`
            }
        </div>
    `;
}

function renderStatement(statement) {
    const label = statement.label || statement.url || 'Statement';
    return `
        <li>
            ${
                statement.url
                    ? `<a href="${escapeAttr(statement.url)}">${renderIcon('description', 'statement-list__icon')}<span class="statement-list__label">${escapeHtml(label)}</span></a>`
                    : `<span>${renderIcon('description', 'statement-list__icon')}<span class="statement-list__label">${escapeHtml(label)}</span></span>`
            }
        </li>
    `;
}

function renderConsumptionPanel({ waterMeters, flags, loading, selectedWaterMeterKey }) {
    const orderedMeters = getOrderedMeterSeries(waterMeters);
    const activeMeterKey = getActiveMeterKey(orderedMeters, selectedWaterMeterKey);
    return `
        <section class="summary-section" aria-labelledby="csui-modern-water-heading">
            <h2 id="csui-modern-water-heading">Water Consumption</h2>
            ${
                flags.moreMeters
                    ? `<p class="notice-inline">The portal reported additional meters; only the meters loaded by the legacy dashboard are shown.</p>`
                    : ''
            }
            ${
                loading
                    ? renderInlineLoading('Loading water meter data...')
                    : orderedMeters.length
                      ? renderMeterTabs(orderedMeters, activeMeterKey)
                      : `<p class="empty-inline">No water consumption data is available for this account.</p>`
            }
        </section>
    `;
}

function renderMeterTabs(meters, activeMeterKey) {
    const activeMeter = meters.find((meter) => meter.key === activeMeterKey) || meters[0];
    const tabIdBase = 'csui-modern-water-meter';

    if (meters.length === 1) {
        return `<div class="meter-list">${renderMeterSeries(activeMeter)}</div>`;
    }

    return `
        <div class="meter-tabs">
            <div class="meter-tabs__list" role="tablist" aria-label="Water meters">
                ${meters
                    .map((meter, index) => {
                        const selected = meter.key === activeMeter.key;
                        return `
                            <button
                                type="button"
                                class="meter-tab ${selected ? 'is-selected' : ''}"
                                role="tab"
                                id="${tabIdBase}-tab-${index}"
                                aria-selected="${selected ? 'true' : 'false'}"
                                aria-controls="${tabIdBase}-panel"
                                data-meter-tab="${escapeAttr(meter.key)}"
                            >
                                ${renderIcon('gas_meter', 'meter-tab__icon')}
                                <span class="meter-tab__label">${escapeHtml(formatMeterLabel(meter.series.meterNumber, index))}</span>
                                <small>
                                    <span>Last Read</span>
                                    ${escapeHtml(formatShortDate(meter.latestDate) || 'No reads')}
                                </small>
                            </button>
                        `;
                    })
                    .join('')}
            </div>
            <div
                id="${tabIdBase}-panel"
                class="meter-tabs__panel"
                role="tabpanel"
                aria-labelledby="${tabIdBase}-tab-${meters.indexOf(activeMeter)}"
            >
                ${renderMeterSeries(activeMeter, { showTitle: false })}
            </div>
        </div>
    `;
}

function renderMeterSeries(meter, { showTitle = true } = {}) {
    const series = meter.series || meter;
    const readings = normalizeReadings(series.readings);
    return `
        <article class="meter-series">
            ${showTitle ? `<h3>${escapeHtml(series.meterNumber || 'Meter')}</h3>` : ''}
            ${readings.length ? renderBarChart(readings, series.meterNumber) : '<p class="empty-inline">No readings available.</p>'}
        </article>
    `;
}

function renderInlineLoading(label) {
    return `
        <div class="loading-inline" role="status" aria-live="polite">
            <span class="spinner" aria-hidden="true"></span>
            <span>${escapeHtml(label)}</span>
        </div>
    `;
}

function renderBarChart(readings, meterNumber) {
    const chartData = readings.map((reading) => ({
        label: formatShortDate(reading.date),
        consumption: Number(reading.consumption) || 0,
    }));
    const encodedReadings = encodeURIComponent(JSON.stringify(chartData));
    const latestDate = formatShortDate(readings[readings.length - 1]?.date);

    return `
        <figure class="chart">
            <dl class="chart__summary">
                ${renderField('Meter Number', cleanMeterNumber(meterNumber) || 'Unknown')}
                ${renderField('Readings', readings.length)}
                ${renderField('Last Read', latestDate || 'Not available')}
            </dl>
            <div class="chart__canvas-wrap">
                <canvas
                    data-consumption-chart
                    data-readings="${escapeAttr(encodedReadings)}"
                    role="img"
                    aria-label="Water consumption for ${escapeAttr(meterNumber || 'meter')}"
                ></canvas>
            </div>
        </figure>
    `;
}

function renderMessagesPanel(messages) {
    return `
        <div class="tab-list-panel">
            ${
                messages.length
                    ? `<div class="message-list">${messages.map((message) => `<p>${escapeHtml(message)}</p>`).join('')}</div>`
                    : `<p class="empty-inline">No messages for this account.</p>`
            }
        </div>
    `;
}

function renderBillingPanel({ selected, flags }) {
    return `
        <div class="billing-panel">
            <div class="billing-panel__header">
                <h2>Billing</h2>
            </div>
            <div class="billing-settings">
                ${renderSettingsToggles({ selected, flags })}
            </div>
        </div>
    `;
}

function renderField(label, value) {
    return `
        <div class="field">
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value || 'Not available')}</dd>
        </div>
    `;
}

function renderSummaryField(label, value) {
    return `
        <div class="summary-field">
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value || 'Not available')}</dd>
        </div>
    `;
}

function getOrderedMeterSeries(waterMeters) {
    return waterMeters
        .map((series, index) => {
            const readings = normalizeReadings(series.readings);
            const latest = readings[readings.length - 1] || null;
            return {
                key: getMeterSeriesKey(series, index),
                series: {
                    ...series,
                    readings,
                },
                latestDate: latest?.date || '',
                latestTime: latest?.time || 0,
            };
        })
        .sort((a, b) => b.latestTime - a.latestTime);
}

function getActiveMeterKey(meters, selectedKey) {
    if (selectedKey && meters.some((meter) => meter.key === selectedKey)) return selectedKey;
    return meters[0]?.key || '';
}

function getMeterSeriesKey(series, index) {
    return `${series?.meterNumber || 'meter'}-${index}`;
}

function formatMeterLabel(meterNumber, fallbackIndex = 0) {
    const value = cleanMeterNumber(meterNumber);
    if (!value) return `Meter ${fallbackIndex + 1}`;
    const shortNumber = value.length > 8 ? value.slice(-8) : value;
    return `Meter ...${shortNumber}`;
}

function cleanMeterNumber(meterNumber) {
    return String(meterNumber || '')
        .replace(/^Mtr\s+Number:\s*/i, '')
        .trim();
}

function getStatusIconName(account) {
    const statusType = account?.statusType || (account?.pastInactive ? 'inactive' : 'current');
    if (statusType === 'due') return 'payments';
    if (statusType === 'past-due') return 'warning';
    if (statusType === 'inactive') return 'block';
    return 'check_circle';
}

function isSameAccount(a, b) {
    if (!a || !b) return false;
    if (a.accountKey && b.accountKey) return a.accountKey === b.accountKey;
    return a.accountNumber === b.accountNumber;
}

function logConsumptionChartFailure(error) {
    try {
        if (localStorage.getItem('csui-modern-debug') !== 'true') return;
    } catch {
        return;
    }

    console.debug('[CSUI Modern] consumption chart module was unavailable', error);
}

function getAccountValue(account) {
    return account?.accountKey || account?.accountNumber || '';
}

function isInactiveAccount(account) {
    return account?.statusType === 'inactive' || account?.pastInactive === true;
}
