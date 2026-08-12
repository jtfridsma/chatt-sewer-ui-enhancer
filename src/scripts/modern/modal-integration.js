const MODAL_OPEN_CLASS = 'csui-modern-modal-open';

export function setupModernModalIntegration() {
    let observer = null;

    function sync() {
        const modals = getOpenModals();
        modals.forEach(tagModal);
        setModalOpenState(modals.length > 0);
    }

    observer = new MutationObserver(sync);
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
    });
    sync();

    return {
        destroy() {
            observer?.disconnect();
            observer = null;
            setModalOpenState(false);
            document.querySelectorAll('.modal[data-csui-modern-modal]').forEach((modal) => {
                modal.removeAttribute('data-csui-modern-modal');
                modal.removeAttribute('data-csui-modal-kind');
            });
            document
                .querySelectorAll('.modal-title[data-csui-modal-icon]')
                .forEach((title) => title.removeAttribute('data-csui-modal-icon'));
        },
    };
}

function getOpenModals() {
    return Array.from(document.querySelectorAll('.modal')).filter((modal) => {
        const style = window.getComputedStyle(modal);
        return modal.classList.contains('in') && style.display !== 'none';
    });
}

function tagModal(modal) {
    modal.setAttribute('data-csui-modern-modal', 'true');

    const title = modal.querySelector('.modal-title');
    const titleText = title?.textContent?.trim() || '';
    const kind = getModalKind(titleText);
    modal.setAttribute('data-csui-modal-kind', kind);

    if (title) {
        title.setAttribute('data-csui-modal-icon', getModalIcon(kind));
    }
}

function getModalKind(title) {
    const normalized = title.toLowerCase();
    if (normalized.includes('password')) return 'password';
    if (normalized.includes('profile')) return 'profile';
    if (
        normalized.includes('pay') ||
        normalized.includes('payment') ||
        normalized.includes('stored payment')
    ) {
        return 'payment';
    }
    return 'generic';
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
