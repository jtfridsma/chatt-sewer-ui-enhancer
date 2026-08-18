import { getExtensionUrl } from '../../utilities/chrome.js';

const CHART_MODULE_PATH = 'public/csui-consumption-chart.js';

let chartModulePromise = null;

export async function mountConsumptionCharts(root) {
    if (!root?.querySelector?.('[data-consumption-chart]')) return [];

    const chartModule = await loadChartModule();
    return chartModule.mountConsumptionCharts(root);
}

function loadChartModule() {
    if (!chartModulePromise) {
        const url = getExtensionUrl(CHART_MODULE_PATH);
        chartModulePromise = import(url).catch((error) => {
            chartModulePromise = null;
            throw error;
        });
    }
    return chartModulePromise;
}
