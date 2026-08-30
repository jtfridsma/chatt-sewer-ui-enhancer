// src/scripts/components/theme-toggle.js

import {
    dispatchThemeToggle,
    persistThemeEnabled,
    readThemeEnabled,
    setThemeEnabled,
} from '../utilities/theme-state.js';
import { getChattContext } from '../utilities/context.js';

const STORAGE_KEY_DIAGNOSTICS = 'csui-diagnostics';

const UI_ROOT_ID = 'csui-ui';
const LAUNCHER_ID = 'csui-launcher';
const PANEL_ID = 'csui-panel';
const TOGGLE_ID = 'csui-enabled-toggle';
const ERROR_BADGE_ID = 'csui-error-badge';
const BADGE_ICON_ID = 'csui-diagnostic-badge-icon';
const DIAGNOSTICS_ID = 'csui-diagnostics';
const MAX_DIAGNOSTICS = 3;

const LINKS = {
    reportIssue: 'https://github.com/jtfridsma/chatt-sewer-ui-enhancer/issues',
    buyCoffee: 'https://buymeacoffee.com/jtfridsma',
};

export function addThemeToggle(ctx) {
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
    const badgeIcon = root.querySelector(`#${BADGE_ICON_ID}`);
    const diagnostics = root.querySelector(`#${DIAGNOSTICS_ID}`);

    if (!launcher || !panel || !toggle) return;

    panel.hidden = true;
    launcher.setAttribute('aria-controls', PANEL_ID);

    // Restore enabled state (default: on)
    const initialOn = readThemeEnabled();
    setThemeEnabled(initialOn);
    toggle.checked = initialOn;

    const diagnosticScope = getDiagnosticScope(ctx);
    const initialDiagnostics = clearTransientDashboardDiagnostics(
        readDiagnostics(diagnosticScope),
        diagnosticScope
    );
    renderDiagnostics(initialDiagnostics, diagnostics, diagnosticScope);
    syncDiagnosticBadge(initialDiagnostics, errorBadge, badgeIcon);

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
        setThemeEnabled(next);
        persistThemeEnabled(next);

        if (!next && diagnosticScope === 'webshare:dashboard') {
            window.__CSUI__?.clearDashboardDataDiagnostics?.();
        }

        try {
            dispatchThemeToggle(next);
        } catch {
            // no-op
        }
    });

    installGlobalErrorReporter({
        errorBadge,
        badgeIcon,
        diagnostics,
        diagnosticScope,
    });
}

function getMarkup() {
    const version = getExtensionVersion();
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
        <span id="${BADGE_ICON_ID}" class="material-symbols-rounded csui-control__badge-icon">warning</span>
      </span>
    </button>

    <div
      id="${PANEL_ID}"
      class="csui-control__panel"
      role="dialog"
      aria-label="Chattanooga Sewer UI Enhancer"
    >
      <div class="csui-control__header">
        <div class="csui-control__title">
          <span>Chattanooga Sewer UI Enhancer</span>
          <span class="csui-control__version">v${escapeHtml(version)}</span>
        </div>
      </div>

      <div class="csui-control__row">
        <label class="csui-control__toggle">
          <span class="csui-control__toggle-label">Enable enhancements</span>
          <input id="${TOGGLE_ID}" type="checkbox" />
          <span class="csui-control__toggle-ui" aria-hidden="true"></span>
        </label>
      </div>

      <div id="${DIAGNOSTICS_ID}" class="csui-control__diagnostics" aria-live="polite" hidden></div>

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

function readDiagnostics(scope) {
    try {
        const parsed = JSON.parse(localStorage.getItem(getDiagnosticsStorageKey(scope)) || '[]');
        if (Array.isArray(parsed)) {
            const diagnostics = parsed
                .map((entry) => normalizeDiagnostic(entry?.level, entry?.message))
                .filter(Boolean);
            if (diagnostics.length) return diagnostics.slice(-MAX_DIAGNOSTICS);
        }
    } catch {
        // ignore
    }
    return [];
}

function persistDiagnostics(diagnostics, scope) {
    try {
        localStorage.setItem(getDiagnosticsStorageKey(scope), JSON.stringify(diagnostics));
    } catch {
        // ignore
    }
}

function syncDiagnosticBadge(diagnostics, badgeEl, iconEl) {
    if (!badgeEl) return;
    if (!diagnostics.length) {
        badgeEl.removeAttribute('data-visible');
        badgeEl.removeAttribute('data-severity');
        return;
    }

    const severity = diagnostics.some((diagnostic) => diagnostic.level === 'error')
        ? 'error'
        : 'warning';
    badgeEl.setAttribute('data-visible', 'true');
    badgeEl.setAttribute('data-severity', severity);
    if (iconEl) iconEl.textContent = severity;
}

function renderDiagnostics(diagnostics, container, scope) {
    if (!container) return;
    container.replaceChildren();
    container.hidden = !diagnostics.length;

    diagnostics.forEach((diagnostic) => {
        const item = document.createElement('div');
        item.className = `csui-control__diagnostic csui-control__diagnostic--${diagnostic.level}`;

        const label = document.createElement('strong');
        label.textContent = `${getDiagnosticScopeLabel(scope)} ${
            diagnostic.level === 'warning' ? 'Warning' : 'Error'
        }`;
        const message = document.createElement('span');
        message.textContent = diagnostic.message;

        item.append(label, message);
        container.appendChild(item);
    });
}

function installGlobalErrorReporter({
    errorBadge,
    badgeIcon,
    diagnostics: diagnosticsContainer,
    diagnosticScope,
}) {
    const w = window;
    const existing = w.__CSUI__ || {};
    let diagnostics = readDiagnostics(diagnosticScope);

    const report = (level, value) => {
        const diagnostic = normalizeDiagnostic(level, value);
        if (!diagnostic) return;

        const last = diagnostics.at(-1);
        if (last?.level === diagnostic.level && last.message === diagnostic.message) return;

        diagnostics = [...diagnostics, diagnostic].slice(-MAX_DIAGNOSTICS);
        persistDiagnostics(diagnostics, diagnosticScope);
        renderDiagnostics(diagnostics, diagnosticsContainer, diagnosticScope);
        syncDiagnosticBadge(diagnostics, errorBadge, badgeIcon);
    };

    w.__CSUI__ = {
        ...existing,
        reportError(err) {
            report('error', err);
        },
        reportWarning(warning) {
            report('warning', warning);
        },
        clearError() {
            diagnostics = [];
            persistDiagnostics(diagnostics, diagnosticScope);
            renderDiagnostics(diagnostics, diagnosticsContainer, diagnosticScope);
            syncDiagnosticBadge(diagnostics, errorBadge, badgeIcon);
        },
        clearDashboardDataDiagnostics() {
            const nextDiagnostics = clearTransientDashboardDiagnostics(
                diagnostics,
                diagnosticScope
            );
            if (nextDiagnostics.length === diagnostics.length) return;

            diagnostics = nextDiagnostics;
            renderDiagnostics(diagnostics, diagnosticsContainer, diagnosticScope);
            syncDiagnosticBadge(diagnostics, errorBadge, badgeIcon);
        },
    };
}

function clearTransientDashboardDiagnostics(diagnostics, scope) {
    if (scope !== 'webshare:dashboard') return diagnostics;

    const nextDiagnostics = diagnostics.filter(
        (diagnostic) => !isTransientDashboardDiagnostic(diagnostic)
    );
    if (nextDiagnostics.length !== diagnostics.length) {
        persistDiagnostics(nextDiagnostics, scope);
    }
    return nextDiagnostics;
}

function isTransientDashboardDiagnostic(diagnostic) {
    const message = diagnostic?.message || '';
    return (
        /\b(?:data|state|meter(?:\s+(?:data|readings?))?)\b.*\b(?:not\s+available|unavailable|timed?\s*out)\b/i.test(
            message
        ) ||
        /(?:csui-)?consumption chart|csui-consumption-chart|failed to resolve module specifier/i.test(
            message
        )
    );
}

function getDiagnosticScope(ctx) {
    const currentContext = ctx || getCurrentContext();
    if (currentContext?.isSewerPaymentsChatt) return 'landing';
    if (currentContext?.isChattWebShare) {
        return `webshare:${currentContext.pageType || 'other'}`;
    }
    return 'other';
}

function getCurrentContext() {
    try {
        return getChattContext(window.location);
    } catch {
        return null;
    }
}

function getDiagnosticsStorageKey(scope) {
    return `${STORAGE_KEY_DIAGNOSTICS}:${scope}`;
}

function getDiagnosticScopeLabel(scope) {
    const labels = {
        landing: 'Landing page',
        'webshare:dashboard': 'Dashboard',
        'webshare:login': 'Sign-in page',
        'webshare:forgot-username': 'Username recovery',
        'webshare:new-user': 'Registration',
        'webshare:guest-pay': 'Guest payment',
    };
    return labels[scope] || 'Extension';
}

function normalizeDiagnostic(level, value) {
    const message = value?.message ? String(value.message) : String(value || '');
    if (!message) return null;
    return {
        level: level === 'warning' ? 'warning' : 'error',
        message: message.replace(/\s+/g, ' ').trim().slice(0, 240),
    };
}

function getExtensionVersion() {
    try {
        const runtime =
            typeof chrome !== 'undefined'
                ? chrome.runtime
                : typeof browser !== 'undefined'
                  ? browser.runtime
                  : null;
        return runtime?.getManifest?.().version || '0.1.0';
    } catch {
        return '0.1.0';
    }
}

/** Tiny helpers */

function escapeAttr(url) {
    return String(url).replace(/"/g, '&quot;');
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
