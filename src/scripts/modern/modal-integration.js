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
        total.setAttribute('data-csui-payment-total', amount);
    } else {
        total?.removeAttribute('data-csui-payment-total');
    }
    syncPaymentTotalDue(footer, total, totalDue);

    const labels = [
        ['payToken()', 'Pay with stored method'],
        ['payNonToken()', 'Pay with new method'],
        ['forgetToken()', 'Forget stored method'],
    ];
    labels.forEach(([action, label]) => {
        footer
            ?.querySelector(`:scope > .btn[ng-click='${action}']`)
            ?.setAttribute('data-csui-payment-label', label);
    });

    reorderPaymentActions(footer);
}

function enhancePaymentForm(modal) {
    const table = modal.querySelector('form > table');
    if (!table) return null;

    table.setAttribute('data-csui-payment-form', 'true');
    let totalDue = 0;
    let hasDue = false;
    table.querySelectorAll('tr[ng-repeat]').forEach((row) => {
        row.setAttribute('data-csui-payment-row', 'true');
        const input = row.querySelector("input[name='amtToPay']");
        const initialDue = row.getAttribute('data-csui-payment-due') || input?.value || '';
        const amount = parseCurrencyAmount(initialDue);
        if (amount === null) return;

        const formattedAmount = formatCurrency(amount);
        row.setAttribute('data-csui-payment-due', formattedAmount);
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
    if (value) value.textContent = `$${amount}`;
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

function syncPaymentTotalDue(footer, total, amount) {
    if (!footer) return;

    let detail = footer.querySelector("[data-csui-generated='payment-total-due']");
    if (!amount) {
        detail?.remove();
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
        summary.append(detail);
    }

    if (total && total.parentElement !== summary) summary.append(total);

    const value = detail.querySelector('.csui-payment-total-due__value');
    if (value) value.textContent = `$${amount}`;
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

function reorderPaymentActions(footer) {
    if (!footer) return;

    const actionOrder = ['payToken()', 'cancel()', 'payNonToken()', 'forgetToken()'];
    const actions = actionOrder
        .map((action) => footer.querySelector(`:scope > .btn[ng-click='${action}']`))
        .filter(Boolean);
    const currentOrder = Array.from(footer.querySelectorAll(':scope > .btn'));

    if (
        actions.length === currentOrder.length &&
        actions.every((action, index) => action === currentOrder[index])
    ) {
        return;
    }

    actions.forEach((action) => footer.append(action));
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
