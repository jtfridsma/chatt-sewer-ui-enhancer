// src/scripts/components/theme-toggle.js

const STORAGE_KEY_ENABLED = 'csui-theme-enabled';
const STORAGE_KEY_ERROR_FLAG = 'csui-has-error';
const ROOT_ENABLED_ATTR = 'data-csui-enabled';

const UI_ROOT_ID = 'csui-ui';
const LAUNCHER_ID = 'csui-launcher';
const PANEL_ID = 'csui-panel';
const TOGGLE_ID = 'csui-enabled-toggle';
const ERROR_BADGE_ID = 'csui-error-badge';

const LINKS = {
    reportIssue: 'https://github.com/jtfridsma/chatt-sewer-ui-enhancer/issues',
    buyCoffee: 'https://buymeacoffee.com/jtfridsma',
};

export function addThemeToggle() {
    if (typeof document === 'undefined') return;
    if (!document.body) return;

    // Avoid duplicate insertion
    if (document.getElementById(UI_ROOT_ID)) return;

    // Build UI root + markup
    const root = document.createElement('div');
    root.id = UI_ROOT_ID;
    root.className = 'csui-control'; // styles will target this
    root.innerHTML = getMarkup();

    document.body.appendChild(root);

    const launcher = root.querySelector(`#${LAUNCHER_ID}`);
    const panel = root.querySelector(`#${PANEL_ID}`);
    const toggle = root.querySelector(`#${TOGGLE_ID}`);
    const errorBadge = root.querySelector(`#${ERROR_BADGE_ID}`);

    if (!launcher || !panel || !toggle) return;

    panel.hidden = true;
    launcher.setAttribute('aria-controls', PANEL_ID);

    // Restore enabled state (default: on)
    const initialOn = readEnabledState();
    setEnabledState(initialOn);
    toggle.checked = initialOn;

    // Restore error badge state (default: none)
    const hasError = readErrorFlag();
    setErrorBadgeVisible(!!hasError, errorBadge);

    const openPanel = () => {
        panel.hidden = false;
        root.setAttribute('data-csui-open', 'true');
        launcher.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => {
            toggle.focus?.();
        });
    };

    const closePanel = () => {
        panel.hidden = true;
        root.removeAttribute('data-csui-open');
        launcher.setAttribute('aria-expanded', 'false');
        launcher.focus?.();
    };

    const isOpen = () => root.getAttribute('data-csui-open') === 'true';

    launcher.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isOpen()) closePanel();
        else openPanel();
    });

    // Close on click outside
    document.addEventListener(
        'click',
        (e) => {
            if (!isOpen()) return;
            if (!root.contains(e.target)) closePanel();
        },
        true
    );

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (!isOpen()) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closePanel();
        }
    });

    // Toggle enabled state
    toggle.addEventListener('change', () => {
        const next = !!toggle.checked;
        setEnabledState(next);
        persistEnabledState(next);

        try {
            window.dispatchEvent(
                new CustomEvent('csui-theme-toggle', { detail: { enabled: next } })
            );
        } catch {
            // no-op
        }
    });

    installGlobalErrorReporter({ errorBadge });
}

function getMarkup() {
    return `
    <button
      id="${LAUNCHER_ID}"
      class="csui-control__launcher"
      type="button"
      aria-label="Chattanooga Sewer UI Enhancer settings"
      aria-haspopup="dialog"
      aria-expanded="false"
    >
      <span id="${ERROR_BADGE_ID}" class="csui-control__badge" aria-hidden="true">
        ⚠️
      </span>
    </button>

    <div
      id="${PANEL_ID}"
      class="csui-control__panel"
      role="dialog"
      aria-label="Chattanooga Sewer UI Enhancer"
    >
      <div class="csui-control__header">
        <div class="csui-control__title">Chattanooga Sewer UI Enhancer</div>
      </div>

      <div class="csui-control__row">
        <label class="csui-control__toggle">
          <span class="csui-control__toggle-label">Enable enhancements</span>
          <input id="${TOGGLE_ID}" type="checkbox" />
          <span class="csui-control__toggle-ui" aria-hidden="true"></span>
        </label>
      </div>

      <div class="csui-control__divider" role="separator" aria-hidden="true"></div>

      <div class="csui-control__links">
        <a class="csui-control__link" href="${escapeAttr(
            LINKS.reportIssue
        )}" target="_blank" rel="noopener noreferrer">
          💩 <span>Report an issue</span>
        </a>
        <a class="csui-control__link" href="${escapeAttr(
            LINKS.buyCoffee
        )}" target="_blank" rel="noopener noreferrer">
          ☕️ <span>Buy me a coffee</span>
        </a>
      </div>
    </div>
  `;
}

function readEnabledState() {
    try {
        const saved =
            (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_ENABLED)) ||
            'true';
        return saved !== 'false';
    } catch {
        return true;
    }
}

function persistEnabledState(enabled) {
    try {
        localStorage.setItem(STORAGE_KEY_ENABLED, enabled ? 'true' : 'false');
    } catch {
        // ignore
    }
}

function setEnabledState(enabled) {
    const root = document.documentElement;
    if (!root) return;

    if (enabled) {
        root.setAttribute(ROOT_ENABLED_ATTR, 'true');
    } else {
        root.removeAttribute(ROOT_ENABLED_ATTR);
    }
}

function readErrorFlag() {
    try {
        return localStorage.getItem(STORAGE_KEY_ERROR_FLAG) === 'true';
    } catch {
        return false;
    }
}

function persistErrorFlag(hasError) {
    try {
        localStorage.setItem(STORAGE_KEY_ERROR_FLAG, hasError ? 'true' : 'false');
    } catch {
        // ignore
    }
}

function setErrorBadgeVisible(visible, badgeEl) {
    if (!badgeEl) return;
    if (visible) badgeEl.setAttribute('data-visible', 'true');
    else badgeEl.removeAttribute('data-visible');
}

function installGlobalErrorReporter({ errorBadge }) {
    const w = window;
    const existing = w.__CSUI__ || {};

    w.__CSUI__ = {
        ...existing,
        reportError(err) {
            persistErrorFlag(true);
            setErrorBadgeVisible(true, errorBadge);

            try {
                const msg = err?.message
                    ? String(err.message).slice(0, 200)
                    : String(err).slice(0, 200);
                localStorage.setItem('csui-last-error', msg);
            } catch {
                // ignore
            }
        },
        clearError() {
            persistErrorFlag(false);
            setErrorBadgeVisible(false, errorBadge);
            try {
                localStorage.removeItem('csui-last-error');
            } catch {
                // ignore
            }
        },
    };
}

/** Tiny helpers */

function escapeAttr(url) {
    return String(url).replace(/"/g, '&quot;');
}
