const MODAL_OPEN_CLASS = 'csui-modern-modal-open';

export function setupModernModalIntegration() {
    let observer = null;
    let syncFrame = null;
    let modalOpen = null;

    function sync() {
        const modals = getOpenModals();
        modals.forEach(tagModal);
        const nextOpen = modals.length > 0;
        if (nextOpen !== modalOpen) {
            modalOpen = nextOpen;
            setModalOpenState(nextOpen);
        }
    }

    function scheduleSync(records) {
        if (!records.some(canAffectModal) || syncFrame !== null) return;
        syncFrame = window.requestAnimationFrame(() => {
            syncFrame = null;
            sync();
        });
    }

    observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
        characterData: true,
    });
    sync();

    return {
        destroy() {
            observer?.disconnect();
            observer = null;
            if (syncFrame !== null) window.cancelAnimationFrame(syncFrame);
            syncFrame = null;
            modalOpen = false;
            setModalOpenState(false);
            document.querySelectorAll('.modal[data-csui-modern-modal]').forEach((modal) => {
                modal.removeAttribute('data-csui-modern-modal');
                modal.removeAttribute('data-csui-modal-kind');
                modal.removeAttribute('data-csui-modal-variant');
                modal
                    .querySelectorAll("[data-csui-generated='payment-amount-due']")
                    .forEach((detail) => detail.remove());
                modal
                    .querySelectorAll("[data-csui-generated='payment-total-due']")
                    .forEach((detail) => detail.remove());
                modal
                    .querySelectorAll("[data-csui-generated='payment-total-notice']")
                    .forEach((notice) => notice.remove());
                modal
                    .querySelectorAll("[data-csui-generated='payment-account-value']")
                    .forEach((value) => {
                        value.before(...value.childNodes);
                        value.remove();
                    });
                modal
                    .querySelectorAll("[data-csui-generated='payment-totals']")
                    .forEach((summary) => {
                        const total = summary.querySelector(':scope > p');
                        if (total) summary.before(total);
                        summary.remove();
                    });
                modal
                    .querySelectorAll("[data-csui-generated='payment-actions']")
                    .forEach((actions) => {
                        actions.before(...actions.querySelectorAll('.btn'));
                        actions.remove();
                    });
                modal.querySelectorAll('[data-csui-payment-form]').forEach((table) => {
                    table.removeAttribute('data-csui-payment-form');
                    table.querySelectorAll('[data-csui-payment-row]').forEach((row) => {
                        row.removeAttribute('data-csui-payment-row');
                        row.removeAttribute('data-csui-payment-due');
                    });
                });
            });
            document
                .querySelectorAll('.modal-title[data-csui-modal-icon]')
                .forEach((title) => title.removeAttribute('data-csui-modal-icon'));
        },
    };
}

function canAffectModal(record) {
    const target = record.target;
    if (target instanceof Element && target.closest('.modal')) return true;
    if (record.type === 'characterData') return target.parentElement?.closest('.modal') !== null;
    if (record.type !== 'childList') return false;
    return [...record.addedNodes, ...record.removedNodes].some(
        (node) =>
            node instanceof Element && (node.matches('.modal') || node.querySelector('.modal'))
    );
}

function getOpenModals() {
    return Array.from(document.querySelectorAll('.modal')).filter((modal) => {
        const style = window.getComputedStyle(modal);
        return modal.classList.contains('in') && style.display !== 'none';
    });
}

function tagModal(modal) {
    if (!modal.hasAttribute('data-csui-modern-modal')) {
        modal.setAttribute('data-csui-modern-modal', 'true');
    }

    const title = modal.querySelector('.modal-title');
    const titleText = title?.textContent?.trim() || '';
    const kind = getModalKind(titleText);
    const variant = getModalVariant(titleText);
    if (modal.getAttribute('data-csui-modal-kind') !== kind) {
        modal.setAttribute('data-csui-modal-kind', kind);
    }
    if (variant) modal.setAttribute('data-csui-modal-variant', variant);
    else modal.removeAttribute('data-csui-modal-variant');

    if (title && title.getAttribute('data-csui-modal-icon') !== getModalIcon(kind)) {
        title.setAttribute('data-csui-modal-icon', getModalIcon(kind));
    }

    if (kind === 'payment') enhancePaymentModal(modal);
}

function enhancePaymentModal(modal) {
    const totalDue = enhancePaymentForm(modal);

    const footer = modal.querySelector('.modal-footer');
    const total = footer?.querySelector('p');
    const amount = total?.textContent?.match(/\d[\d,]*(?:\.\d{1,2})?/)?.[0];
    if (amount) {
        setAttributeIfChanged(total, 'data-csui-payment-total', amount);
    } else {
        total?.removeAttribute('data-csui-payment-total');
    }
    syncPaymentTotalDue(footer, total, totalDue, amount);

    const actions = ensurePaymentActionGroup(footer);
    const labels = [
        ['payToken()', 'Pay with stored method'],
        ['payNonToken()', 'Pay with new method'],
        ['forgetToken()', 'Forget stored method'],
    ];
    labels.forEach(([action, label]) => {
        const button = actions?.querySelector(`.btn[ng-click='${action}']`);
        if (button) setAttributeIfChanged(button, 'data-csui-payment-label', label);
    });

    reorderPaymentActions(actions);
}

function enhancePaymentForm(modal) {
    const table = modal.querySelector('form > table');
    if (!table) return null;

    setAttributeIfChanged(table, 'data-csui-payment-form', 'true');
    let totalDue = 0;
    let hasDue = false;
    table.querySelectorAll('tr[ng-repeat]').forEach((row) => {
        setAttributeIfChanged(row, 'data-csui-payment-row', 'true');
        const input = row.querySelector("input[name='amtToPay']");
        const initialDue = row.getAttribute('data-csui-payment-due') || input?.value || '';
        const amount = parseCurrencyAmount(initialDue);
        if (amount === null) return;

        const formattedAmount = formatCurrency(amount);
        setAttributeIfChanged(row, 'data-csui-payment-due', formattedAmount);
        ensurePaymentAmountDue(row, formattedAmount);
        totalDue += amount;
        hasDue = true;
    });

    return hasDue ? formatCurrency(totalDue) : null;
}

function ensurePaymentAmountDue(row, amount) {
    const accountCell = row.querySelector(':scope > td:first-child');
    if (!accountCell) return;

    ensurePaymentAccountValue(accountCell);

    let detail = accountCell.querySelector("[data-csui-generated='payment-amount-due']");
    if (!detail) {
        detail = document.createElement('span');
        detail.className = 'csui-payment-amount-due';
        detail.setAttribute('data-csui-generated', 'payment-amount-due');

        const label = document.createElement('span');
        label.className = 'csui-payment-amount-due__label';
        label.textContent = 'Amount Due';
        const value = document.createElement('span');
        value.className = 'csui-payment-amount-due__value';
        detail.append(label, value);
        accountCell.append(detail);
    }

    const value = detail.querySelector('.csui-payment-amount-due__value');
    if (value) setTextIfChanged(value, `$${amount}`);
}

function ensurePaymentAccountValue(accountCell) {
    if (accountCell.querySelector("[data-csui-generated='payment-account-value']")) return;

    const value = document.createElement('span');
    value.className = 'csui-payment-account-value';
    value.setAttribute('data-csui-generated', 'payment-account-value');

    Array.from(accountCell.childNodes)
        .filter((node) => !(node instanceof Element && node.matches('.csui-payment-amount-due')))
        .forEach((node) => value.append(node));
    accountCell.prepend(value);
}

function syncPaymentTotalDue(footer, total, amount, paymentAmount) {
    if (!footer) return;

    let detail = footer.querySelector("[data-csui-generated='payment-total-due']");
    if (!amount) {
        detail?.remove();
        footer.querySelector("[data-csui-generated='payment-total-notice']")?.remove();
        return;
    }

    let summary = footer.querySelector("[data-csui-generated='payment-totals']");
    if (!summary) {
        summary = document.createElement('div');
        summary.className = 'csui-payment-totals';
        summary.setAttribute('data-csui-generated', 'payment-totals');
        footer.insertBefore(summary, total || footer.firstChild);
    }

    if (!detail) {
        detail = document.createElement('span');
        detail.className = 'csui-payment-total-due';
        detail.setAttribute('data-csui-generated', 'payment-total-due');

        const label = document.createElement('span');
        label.className = 'csui-payment-total-due__label';
        label.textContent = 'Total Due';
        const value = document.createElement('span');
        value.className = 'csui-payment-total-due__value';
        detail.append(label, value);
    }

    placePaymentSummaryItem(summary, total);
    placePaymentSummaryItem(summary, detail, total);
    syncPaymentDifferenceNotice(summary, amount, paymentAmount, detail);

    const value = detail.querySelector('.csui-payment-total-due__value');
    if (value) setTextIfChanged(value, `$${amount}`);
}

function syncPaymentDifferenceNotice(summary, totalDue, totalPayment, previous) {
    let notice = summary.querySelector("[data-csui-generated='payment-total-notice']");
    const due = parseCurrencyAmount(totalDue);
    const payment = parseCurrencyAmount(totalPayment);
    const difference = payment === null || due === null ? null : payment - due;

    if (difference === null || Math.abs(difference) < 0.005) {
        notice?.remove();
        return;
    }

    if (!notice) {
        notice = document.createElement('span');
        notice.className = 'csui-payment-total-notice';
        notice.setAttribute('data-csui-generated', 'payment-total-notice');
    }

    const direction = difference > 0 ? 'more than' : 'less than';
    setTextIfChanged(
        notice,
        `Amount to pay is $${formatCurrency(Math.abs(difference))} ${direction} total due.`
    );
    placePaymentSummaryItem(summary, notice, previous);
}

function placePaymentSummaryItem(parent, item, previous = null) {
    if (!item) return;

    const reference = previous ? previous.nextSibling : parent.firstChild;
    if (item.parentNode === parent && item === reference) return;
    parent.insertBefore(item, reference);
}

function setAttributeIfChanged(element, name, value) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function setTextIfChanged(element, value) {
    if (element.textContent !== value) element.textContent = value;
}

function parseCurrencyAmount(value) {
    const normalized = String(value).replace(/[^\d.-]/g, '');
    if (!normalized) return null;

    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
}

function formatCurrency(value) {
    return Number(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function ensurePaymentActionGroup(footer) {
    if (!footer) return null;

    let actions = footer.querySelector("[data-csui-generated='payment-actions']");
    if (!actions) {
        const buttons = footer.querySelectorAll(':scope > .btn');
        if (!buttons.length) return null;

        actions = document.createElement('div');
        actions.className = 'csui-payment-actions';
        actions.setAttribute('data-csui-generated', 'payment-actions');
        footer.append(actions);
        buttons.forEach((button) => actions.append(button));
    }
    return actions;
}

function reorderPaymentActions(actionContainer) {
    if (!actionContainer) return;

    const actionOrder = ['payToken()', 'cancel()', 'payNonToken()', 'forgetToken()'];
    const orderedActions = actionOrder
        .map((action) => actionContainer.querySelector(`.btn[ng-click='${action}']`))
        .filter(Boolean);
    if (!orderedActions.length) return;

    const primary = ensurePaymentActionRow(actionContainer, 'primary');
    const secondary = ensurePaymentActionRow(actionContainer, 'secondary');
    const knownActions = new Set(orderedActions);
    const additionalActions = Array.from(actionContainer.querySelectorAll('.btn')).filter(
        (action) => !knownActions.has(action)
    );

    syncPaymentActionRow(primary, orderedActions.slice(0, 2));
    syncPaymentActionRow(secondary, [...orderedActions.slice(2), ...additionalActions]);
}

function syncPaymentActionRow(row, actions) {
    const currentActions = Array.from(row.querySelectorAll(':scope > .btn'));
    const isCurrentOrder =
        currentActions.length === actions.length &&
        actions.every((action, index) => currentActions[index] === action);
    if (isCurrentOrder) return;

    row.replaceChildren(...actions);
}

function ensurePaymentActionRow(actionContainer, name) {
    const selector = `:scope > [data-csui-generated='payment-action-row-${name}']`;
    let row = actionContainer.querySelector(selector);
    if (row) return row;

    row = document.createElement('div');
    row.className = `csui-payment-actions__row csui-payment-actions__row--${name}`;
    row.setAttribute('data-csui-generated', `payment-action-row-${name}`);
    actionContainer.append(row);
    return row;
}

function getModalKind(title) {
    const normalized = title.toLowerCase();
    if (normalized.includes('password')) return 'password';
    if (normalized.includes('profile')) return 'profile';
    if (normalized.includes('pay')) {
        return 'payment';
    }
    return 'generic';
}

function getModalVariant(title) {
    return title.trim().toLowerCase() === 'remember payment' ? 'remember-payment' : '';
}

function getModalIcon(kind) {
    if (kind === 'password') return 'lock';
    if (kind === 'profile') return 'account_circle';
    if (kind === 'payment') return 'payments';
    return 'edit_note';
}

function setModalOpenState(open) {
    document.documentElement.classList.toggle(MODAL_OPEN_CLASS, open);

    const modernRoot = document.getElementById('csui-modern-dashboard');
    if (!modernRoot) return;

    if (open) {
        modernRoot.setAttribute('aria-hidden', 'true');
        modernRoot.inert = true;
    } else {
        modernRoot.removeAttribute('aria-hidden');
        modernRoot.inert = false;
    }
}
