export const DASHBOARD_STYLES = `
        :host {
            all: initial;
            --card-radius: 8px;
            --dashboard-heading: var(--csui-dashboard-backdrop, #092f49);
            --dashboard-text: var(--csui-dashboard-text, #172033);
            --dashboard-text-muted: #4f6475;
            --dashboard-accent: var(--csui-dashboard-accent, #0f6684);
            --dashboard-primary: var(--csui-dashboard-primary, #0f4c6d);
            --dashboard-primary-hover: var(
                --csui-dashboard-primary-hover,
                #093c5a
            );
            --dashboard-border: var(--csui-dashboard-border, #d9e2ea);
            --dashboard-input-border: var(
                --csui-dashboard-input-border,
                #cbd8e1
            );
            --dashboard-row-border: var(--csui-dashboard-row-border, #edf2f5);
            --dashboard-surface: var(--csui-dashboard-surface, #ffffff);
            --dashboard-surface-muted: var(
                --csui-dashboard-surface-muted,
                #f6f9fb
            );
            --dashboard-surface-hover: var(
                --csui-dashboard-surface-hover,
                #f7fbfd
            );
            color-scheme: light;
            display: block;
            min-height: 100vh;
            background: #eef3f6;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: var(--dashboard-text);
        }

        *, *::before, *::after {
            box-sizing: border-box;
        }

        button, input, select {
            font: inherit;
        }

        a {
            color: var(--dashboard-accent);
            font-weight: 600;
            text-decoration: none;
        }

        a:hover {
            text-decoration: underline;
        }

        .icon {
            direction: ltr;
            display: inline-flex;
            flex: 0 0 auto;
            font-family: "Material Symbols Rounded";
            font-feature-settings: "liga";
            font-size: 1.15rem;
            font-style: normal;
            font-variation-settings:
                "FILL" 0,
                "wght" 400,
                "GRAD" 0,
                "opsz" 24;
            font-weight: normal;
            letter-spacing: 0;
            line-height: 1;
            text-transform: none;
            white-space: nowrap;
            -webkit-font-feature-settings: "liga";
            -webkit-font-smoothing: antialiased;
        }

        .shell {
            display: grid;
            gap: 1rem;
            width: min(1360px, calc(100vw - 2rem));
            margin: 0 auto;
            padding: 1rem 0 2rem;
        }

        .modern-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
            padding: 0.65rem 0.85rem;
            border: 1px solid var(--dashboard-border);
            border-radius: 8px;
            background: var(--dashboard-surface);
            box-shadow: 0 8px 24px rgba(9, 47, 73, 0.08);
        }

        .modern-header__identity {
            display: flex;
            align-items: center;
            gap: 0.8rem;
            min-width: 0;
        }

        .modern-header__logo {
            display: block;
            width: auto;
            height: 76px;
            max-width: 220px;
            object-fit: contain;
            flex: 0 0 auto;
        }

        .modern-header__text {
            min-width: 0;
            padding: 0.35rem 0;
        }

        .modern-header__actions {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            flex: 0 0 auto;
            padding: 0.35rem 0;
        }

        .action-menu--mobile {
            display: none;
        }

        .eyebrow {
            margin: 0 0 0.35rem;
            color: var(--dashboard-text-muted);
            font-size: 0.82rem;
            font-weight: 400;
        }

        h1, h2, h3, p {
            margin: 0;
        }

        h1 {
            font-size: 1.55rem;
            line-height: 1.2;
            font-weight: 700;
            color: var(--dashboard-heading);
        }

        h2 {
            font-size: 1rem;
            line-height: 1.25;
            color: var(--dashboard-heading);
        }

        h3 {
            font-size: 0.92rem;
            line-height: 1.25;
            color: var(--dashboard-heading);
        }

        .panel {
            border: 1px solid var(--dashboard-border);
            border-radius: var(--card-radius);
            background: var(--dashboard-surface);
            box-shadow: 0 8px 24px rgba(9, 47, 73, 0.08);
            overflow: hidden;
        }

        .panel__header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
            padding: 0.85rem 1rem;
            border-bottom: 1px solid var(--dashboard-border);
            background: var(--dashboard-surface-muted);
        }

        .panel__body {
            padding: 1rem;
        }

        .panel-actions {
            margin-top: 0.75rem;
        }

        .dashboard-layout {
            display: grid;
            grid-template-columns: minmax(240px, 285px) minmax(0, 1fr);
            gap: 1.2rem;
            align-items: start;
        }

        .dashboard-content {
            display: grid;
            gap: 1rem;
            min-width: 0;
        }

        .dashboard-sidebar {
            position: sticky;
            top: 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.8rem;
            height: var(--dashboard-sidebar-height, calc(100dvh - 2rem));
            overflow-y: auto;
            overscroll-behavior: contain;
            padding-right: 0.15rem;
        }

        .account-sidebar {
            display: grid;
            gap: 0.8rem;
            flex: 0 0 auto;
            padding: 0.2rem 0;
        }

        .dashboard-helper {
            display: grid;
            gap: 0.65rem;
            margin-top: auto;
            color: var(--dashboard-text-muted);
            font-size: 0.74rem;
            font-weight: 400;
            line-height: 1.45;
            padding: 0.2rem 0.35rem;
        }

        .dashboard-helper a {
            font-weight: 600;
        }

        .account-sidebar__header {
            display: grid;
            gap: 0.18rem;
            padding: 0 0.35rem;
        }

        .account-list {
            display: grid;
            gap: 0.85rem;
        }

        .account-group {
            display: grid;
            gap: 0.5rem;
        }

        .account-group h3 {
            color: var(--dashboard-text-muted);
            font-size: 0.74rem;
            font-weight: 400;
            padding: 0 0.35rem;
        }

        .account-group__items {
            display: grid;
            gap: 0.35rem;
        }

        .account-nav-item {
            appearance: none;
            width: 100%;
            display: grid;
            gap: 0.5rem;
            border: 1px solid var(--dashboard-border);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.64);
            color: var(--dashboard-text);
            cursor: pointer;
            padding: 0.68rem 0.72rem;
            text-align: left;
        }

        .account-nav-item:not(.is-selected):hover {
            border-color: var(--dashboard-accent);
            background: var(--dashboard-surface-hover);
        }

        .account-nav-item.is-selected {
            border-color: var(--dashboard-primary);
            background: var(--dashboard-surface);
            box-shadow: inset 0 0 0 1px var(--dashboard-primary);
        }

        .account-nav-item__top {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: start;
            gap: 0.5rem;
        }

        .account-nav-item__address {
            margin-top: 3px;
            color: var(--dashboard-heading);
            font-size: 0.98rem;
            font-weight: 700;
            line-height: 1.25;
            overflow-wrap: anywhere;
        }

        .account-nav-item__details {
            display: flex;
            align-items: center;
            gap: 0.42rem;
            flex-wrap: wrap;
        }

        .account-nav-item__label {
            color: var(--dashboard-text-muted);
            font-size: 0.74rem;
            font-weight: 400;
        }

        .detail-tabs {
            display: grid;
            gap: 1rem;
        }

        .account-overview__body {
            display: grid;
            grid-template-areas:
                "identity amount"
                "facts amount";
            grid-template-columns: minmax(0, 1fr) minmax(220px, 0.34fr);
            gap: 1rem;
            align-items: stretch;
            padding: 1rem;
        }

        .account-overview__identity,
        .account-overview__facts,
        .account-overview__amount {
            min-width: 0;
        }

        .account-overview__identity {
            display: grid;
            grid-area: identity;
            align-content: start;
            gap: 0.45rem;
        }

        .account-overview__label {
            margin: 0;
            color: var(--dashboard-text-muted);
            font-size: 0.78rem;
            font-weight: 400;
        }

        .account-overview__identity h2 {
            margin: 0;
            color: var(--dashboard-heading);
            font-size: 2rem;
            line-height: 1.05;
        }

        .account-overview__facts {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            grid-area: facts;
            gap: 0.75rem;
            margin: 0;
            align-content: end;
        }

        .account-overview__facts div {
            display: grid;
            gap: 0.32rem;
        }

        .account-overview__facts dt {
            color: var(--dashboard-text-muted);
            font-size: 0.74rem;
            font-weight: 400;
        }

        .account-overview__facts dd {
            margin: 0;
            color: var(--dashboard-text);
            font-size: 0.94rem;
            font-weight: 700;
            overflow-wrap: anywhere;
        }

        .account-overview__amount {
            display: grid;
            grid-area: amount;
            align-content: center;
            gap: 0.7rem;
            justify-items: stretch;
            padding: 1rem;
            border: 1px solid #d9e8ee;
            border-radius: 10px;
            background: #f3f8fa;
        }

        .account-overview__amount-primary {
            display: grid;
            gap: 0.45rem;
        }

        .account-overview__amount strong {
            color: var(--dashboard-heading);
            font-size: 2rem;
            line-height: 1.05;
            overflow-wrap: anywhere;
        }

        .detail-tabs__list {
            display: flex;
            gap: 0.35rem;
            overflow-x: auto;
            padding: 0.35rem;
            border: 1px solid var(--dashboard-border);
            border-radius: var(--card-radius);
            background: rgba(255, 255, 255, 0.64);
        }

        .detail-tab {
            appearance: none;
            border: 1px solid transparent;
            border-radius: 8px;
            background: transparent;
            color: var(--dashboard-text-muted);
            cursor: pointer;
            min-height: 42px;
            padding: 0.58rem 0.9rem;
            font-weight: 700;
            white-space: nowrap;
        }

        .detail-tab:hover {
            background: #eef5f8;
            color: var(--dashboard-heading);
        }

        .detail-tab.is-selected {
            border-color: var(--dashboard-primary);
            background: var(--dashboard-surface);
            color: var(--dashboard-heading);
            box-shadow: inset 0 0 0 1px var(--dashboard-primary);
        }

        .detail-tabs__panel {
            padding: 1rem;
        }

        .detail-tabs__panel--summary {
            padding: 0;
        }

        .summary-tab {
            display: grid;
            gap: 1rem;
        }

        .summary-card .panel__body {
            display: grid;
            gap: 1rem;
        }

        .summary-section {
            display: grid;
            gap: 0.7rem;
            min-width: 0;
        }

        .tab-list-panel {
            min-width: 0;
        }

        .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            min-height: 24px;
            border-radius: 999px;
            padding: 0.18rem 0.55rem;
            font-size: 0.74rem;
            font-weight: 700;
            line-height: 1;
            white-space: nowrap;
        }

        .status-pill__icon {
            font-size: 0.95rem;
        }

        .status-pill--current {
            color: #07503e;
            background: #dff5ec;
        }

        .status-pill--due {
            color: var(--dashboard-primary);
            background: #dff2f7;
        }

        .status-pill--past-due {
            color: #8f1f17;
            background: #fce3df;
        }

        .status-pill--inactive {
            color: #774116;
            background: #faead8;
        }

        .primary-action:focus-visible,
        .ghost-action:focus-visible,
        .menu-button:focus-visible,
        .text-action:focus-visible,
        .detail-tab:focus-visible,
        .meter-tab:focus-visible,
        .account-nav-item:focus-visible,
        .action-menu summary:focus-visible,
        .setting-toggle input:focus-visible + .switch-ui {
            outline: 3px solid #f3b233;
            outline-offset: 2px;
        }

        .muted {
            color: var(--dashboard-text-muted);
            font-size: 0.88rem;
            line-height: 1.35;
        }

        .primary-action,
        .ghost-action,
        .menu-button,
        .text-action,
        .action-menu summary {
            appearance: none;
            border-radius: 8px;
            min-height: 40px;
            padding: 0.62rem 0.9rem;
            font-weight: 700;
            cursor: pointer;
        }

        .ghost-action {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.4rem;
        }

        .button-icon {
            font-size: 1.1rem;
        }

        .primary-action {
            width: 100%;
            border: 1px solid #094162;
            background: var(--dashboard-primary);
            color: var(--dashboard-surface);
        }

        .primary-action:hover {
            background: var(--dashboard-primary-hover);
        }

        .ghost-action,
        .action-menu summary {
            border: 1px solid var(--dashboard-input-border);
            background: var(--dashboard-surface);
            color: var(--dashboard-heading);
        }

        .ghost-action:hover,
        .action-menu summary:hover {
            border-color: var(--dashboard-accent);
            background: var(--dashboard-surface-hover);
        }

        .action-menu {
            position: relative;
        }

        .action-menu summary {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            list-style: none;
        }

        .action-menu summary::-webkit-details-marker {
            display: none;
        }

        .action-menu__icon {
            color: var(--dashboard-text-muted);
            transition: transform 150ms ease;
        }

        .action-menu--account[open] .action-menu__icon {
            transform: rotate(180deg);
        }

        .action-menu__panel {
            position: absolute;
            top: calc(100% + 0.4rem);
            right: 0;
            z-index: 10;
            display: grid;
            gap: 0.35rem;
            width: min(320px, calc(100vw - 2rem));
            padding: 0.7rem;
            border: 1px solid var(--dashboard-border);
            border-radius: 8px;
            background: var(--dashboard-surface);
            box-shadow: 0 16px 34px rgba(9, 47, 73, 0.18);
        }

        .action-menu:not([open]) > .action-menu__panel {
            display: none;
        }

        .menu-button {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            border: 0;
            background: transparent;
            color: var(--dashboard-heading);
            text-align: left;
            width: 100%;
        }

        .menu-button:hover {
            background: #f1f6f8;
        }

        .menu-divider {
            height: 1px;
            background: var(--dashboard-border);
            margin: 0.25rem 0;
        }

        .setting-toggle {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            gap: 0.75rem;
            align-items: center;
            padding: 0.55rem 0.45rem;
            border-radius: 8px;
            cursor: pointer;
        }

        .setting-toggle__icon {
            color: var(--dashboard-accent);
            font-size: 1.35rem;
        }

        .setting-toggle:hover {
            background: var(--dashboard-surface-muted);
        }

        .setting-toggle.is-disabled {
            opacity: 0.62;
            cursor: not-allowed;
        }

        .setting-toggle input {
            position: absolute;
            opacity: 0;
            width: 1px;
            height: 1px;
        }

        .setting-toggle__title,
        .setting-toggle__hint {
            display: block;
        }

        .setting-toggle__title {
            color: var(--dashboard-heading);
            font-size: 0.9rem;
            font-weight: 700;
        }

        .setting-toggle__hint {
            color: var(--dashboard-text-muted);
            font-size: 0.78rem;
            margin-top: 0.12rem;
        }

        .switch-ui {
            width: 42px;
            height: 24px;
            border-radius: 999px;
            background: #91a5b5;
            position: relative;
            transition: background 140ms ease;
        }

        .switch-ui::after {
            content: "";
            position: absolute;
            width: 18px;
            height: 18px;
            top: 3px;
            left: 3px;
            border-radius: 999px;
            background: var(--dashboard-surface);
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.18);
            transition: transform 140ms ease;
        }

        .setting-toggle input:checked + .switch-ui {
            background: var(--dashboard-accent);
        }

        .setting-toggle input:checked + .switch-ui::after {
            transform: translateX(18px);
        }

        .summary-grid {
            display: grid;
            margin: 0;
        }

        .summary-field {
            display: grid;
            grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
            align-items: baseline;
            gap: 1rem;
            padding: 0.65rem 0;
            border-bottom: 1px solid var(--dashboard-row-border);
        }

        .summary-field:first-child {
            padding-top: 0;
        }

        .summary-field:last-child {
            padding-bottom: 0;
            border-bottom: 0;
        }

        .summary-field dt {
            max-width: 300px;
            color: var(--dashboard-text-muted);
            font-size: 0.74rem;
            font-weight: 400;
        }

        .summary-field dd {
            margin: 0;
            color: var(--dashboard-text);
            font-size: 0.98rem;
            font-weight: 600;
            overflow-wrap: anywhere;
        }

        .billing-panel {
            display: grid;
            gap: 0.9rem;
            max-width: 680px;
        }

        .billing-panel__header {
            display: grid;
            gap: 0.2rem;
        }

        .billing-panel__header h2 {
            margin: 0;
            color: var(--dashboard-heading);
            font-size: 1.05rem;
            line-height: 1.2;
        }

        .billing-panel__header p {
            margin: 0;
            color: var(--dashboard-text-muted);
            font-size: 0.86rem;
            font-weight: 700;
        }

        .billing-settings {
            display: grid;
            overflow: hidden;
            border: 1px solid var(--dashboard-border);
            border-radius: 8px;
            background: var(--dashboard-surface);
        }

        .billing-settings .setting-toggle {
            border-radius: 0;
            padding: 0.85rem 1rem;
        }

        .billing-settings .setting-toggle + .setting-toggle {
            border-top: 1px solid var(--dashboard-row-border);
        }

        .field {
            display: grid;
            gap: 0.32rem;
            min-width: 0;
        }

        .field dt {
            color: var(--dashboard-text-muted);
            font-size: 0.74rem;
            font-weight: 400;
        }

        .field dd {
            margin: 0;
            color: var(--dashboard-text);
            font-size: 0.98rem;
            font-weight: 600;
            overflow-wrap: anywhere;
        }

        .statement-list {
            list-style: none;
            display: grid;
            gap: 0.55rem;
            margin: 0;
            padding: 0;
        }

        .statement-list li {
            padding-bottom: 0.55rem;
            border-bottom: 1px solid var(--dashboard-row-border);
        }

        .statement-list li:last-child {
            border-bottom: 0;
            padding-bottom: 0;
        }

        .statement-list a,
        .statement-list span {
            display: inline-flex;
            align-items: center;
            gap: 0.45rem;
        }

        .statement-list a {
            color: var(--dashboard-primary);
            text-decoration: none;
        }

        .statement-list a .statement-list__label {
            text-decoration: underline;
        }

        .statement-list a:hover {
            color: var(--dashboard-primary-hover);
        }

        .statement-list__icon {
            color: var(--dashboard-accent);
            font-size: 1.35rem;
        }

        .text-action {
            border: 0;
            background: #eef8fb;
            color: var(--dashboard-primary);
        }

        .text-action:hover {
            background: #dff2f7;
        }

        .meter-list {
            display: grid;
            gap: 1rem;
        }

        .meter-tabs {
            display: grid;
            gap: 0.85rem;
        }

        .meter-tabs__list {
            display: flex;
            gap: 0.45rem;
            overflow-x: auto;
            padding-bottom: 0.15rem;
        }

        .meter-tab {
            appearance: none;
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            gap: 0.14rem 0.75rem;
            min-width: 148px;
            border: 1px solid var(--dashboard-input-border);
            border-radius: 8px;
            background: var(--dashboard-surface);
            color: var(--dashboard-heading);
            cursor: pointer;
            padding: 0.62rem 0.72rem;
            text-align: left;
        }

        .meter-tab__icon {
            grid-row: span 2;
            align-self: center;
            color: var(--dashboard-accent);
            font-size: 1.35rem;
            font-weight: 400;
            font-variation-settings:
                "FILL" 0,
                "wght" 400,
                "GRAD" 0,
                "opsz" 24;
        }

        .meter-tab:hover {
            border-color: var(--dashboard-accent);
            background: var(--dashboard-surface-hover);
        }

        .meter-tab.is-selected {
            border-color: var(--dashboard-primary);
            background: var(--dashboard-surface-hover);
            box-shadow: inset 0 0 0 1px var(--dashboard-primary);
        }

        .meter-tab__label {
            font-weight: 700;
            overflow-wrap: anywhere;
        }

        .meter-tab small {
            display: flex;
            gap: 0.25rem;
            font-size: 0.74rem;
            font-weight: 400;
        }

        .meter-tab small span {
            color: var(--dashboard-text-muted);
            font-weight: 400;
        }

        .meter-tabs__panel {
            min-width: 0;
        }

        .meter-series {
            display: grid;
            gap: 0.6rem;
        }

        .chart {
            display: grid;
            gap: 0.65rem;
            margin: 0;
            min-width: 0;
        }

        .chart__summary {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.85rem 1rem;
            margin: 0;
        }

        .chart__canvas-wrap {
            position: relative;
            width: 100%;
            min-height: 250px;
            height: clamp(250px, 32vw, 340px);
        }

        .chart canvas {
            display: block;
            width: 100% !important;
            height: 100% !important;
        }

        figcaption:not(.chart__summary) {
            color: var(--dashboard-text-muted);
            font-size: 0.8rem;
            margin-top: 0.45rem;
        }

        .message-list {
            display: grid;
            gap: 0.6rem;
            color: var(--dashboard-text);
            line-height: 1.45;
        }

        .empty,
        .empty-inline {
            color: var(--dashboard-text-muted);
        }

        .empty {
            padding: 1rem;
        }

        .empty-inline {
            line-height: 1.45;
        }

        .notice-inline {
            border: 1px solid #f2d2a8;
            border-radius: 8px;
            background: #fff8ed;
            color: #744515;
            font-size: 0.86rem;
            line-height: 1.4;
            margin: 0 0 0.85rem;
            padding: 0.65rem 0.75rem;
        }

        .loading-inline {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            color: var(--dashboard-text-muted);
            font-size: 0.9rem;
            line-height: 1.4;
            min-height: 42px;
        }

        .spinner {
            width: 20px;
            height: 20px;
            border: 3px solid #d6e2ea;
            border-top-color: var(--dashboard-accent);
            border-radius: 999px;
            animation: csui-modern-spin 800ms linear infinite;
            flex: 0 0 auto;
        }

        @keyframes csui-modern-spin {
            to {
                transform: rotate(360deg);
            }
        }

        @media (max-width: 900px) {
            .modern-header,
            .dashboard-layout,
            .account-overview__body,
            .account-overview__facts,
            .chart__summary {
                grid-template-columns: 1fr;
            }

            .summary-field {
                grid-template-columns: 1fr;
                gap: 0.32rem;
            }

            .account-overview__body {
                grid-template-areas:
                    "identity"
                    "facts"
                    "amount";
            }

            .modern-header {
                display: grid;
            }

            .modern-header__identity {
                align-items: center;
            }

            .modern-header__actions {
                justify-content: start;
                flex-wrap: wrap;
            }

            .account-sidebar {
                position: static;
            }

            .dashboard-sidebar {
                position: static;
                display: contents;
                height: auto;
                overflow: visible;
                padding: 0;
            }

            .account-sidebar {
                order: 1;
            }

            .dashboard-content {
                order: 2;
            }

            .dashboard-helper {
                order: 3;
            }

            .account-list {
                display: flex;
                gap: 0.6rem;
                overflow-x: auto;
                padding-bottom: 0.15rem;
            }

            .account-group {
                min-width: max-content;
            }

            .account-group__items {
                display: flex;
                gap: 0.6rem;
            }

            .account-nav-item {
                min-width: 245px;
            }
        }

        @media (max-width: 620px) {
            .shell {
                width: min(100%, calc(100vw - 1rem));
                padding-top: 0.5rem;
            }

            .modern-header__actions {
                display: grid;
                grid-template-columns: 1fr;
                width: 100%;
            }

            .action-menu--desktop {
                display: none;
            }

            .action-menu--mobile {
                display: block;
                width: 100%;
            }

            .modern-header__logo {
                height: 62px;
                max-width: 180px;
            }

            .action-menu__panel {
                position: static;
                width: 100%;
                margin-top: 0.45rem;
                box-shadow: none;
            }

            .ghost-action,
            .action-menu summary,
            .menu-button {
                width: 100%;
            }

            .action-menu summary {
                justify-content: space-between;
            }
        }

        @media (min-width: 621px) and (max-width: 900px) {
            .modern-header__actions {
                display: flex;
                flex-wrap: nowrap;
            }

            .account-overview__facts {
                display: flex;
                gap: 0.75rem;
            }

            .account-overview__facts > div {
                flex: 1 1 0;
            }

            .summary-field {
                grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
                gap: 1rem;
            }

            .chart__summary {
                display: flex;
                gap: 0.85rem 1rem;
            }

            .chart__summary .field {
                flex: 1 1 0;
            }
        }
    `;
