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
    if (modal.getAttribute('data-csui-modal-kind') !== kind) {
        modal.setAttribute('data-csui-modal-kind', kind);
    }

    if (title && title.getAttribute('data-csui-modal-icon') !== getModalIcon(kind)) {
        title.setAttribute('data-csui-modal-icon', getModalIcon(kind));
    }
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
