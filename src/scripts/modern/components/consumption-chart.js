import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
});

export function mountConsumptionCharts(root) {
    if (!root?.querySelectorAll) return [];

    return Array.from(root.querySelectorAll('[data-consumption-chart]'))
        .map((canvas) => mountConsumptionChart(canvas))
        .filter(Boolean);
}

function mountConsumptionChart(canvas) {
    const readings = parseReadings(canvas.dataset.readings);
    if (!readings.length) return null;

    const chart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: readings.map((reading) => reading.label),
            datasets: [
                {
                    label: 'Consumption',
                    data: readings.map((reading) => reading.consumption),
                    backgroundColor: '#0f6684',
                    borderColor: '#0f6684',
                    borderRadius: 4,
                    borderSkipped: false,
                    maxBarThickness: 34,
                },
            ],
        },
        options: {
            animation: {
                duration: 180,
            },
            maintainAspectRatio: false,
            responsive: true,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    displayColors: false,
                    callbacks: {
                        title(items) {
                            return items[0]?.label || '';
                        },
                        label(item) {
                            return `Consumption: ${formatNumber(item.parsed.y)}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: {
                        display: false,
                    },
                    ticks: {
                        color: '#4f6475',
                        font: {
                            size: 12,
                            weight: 650,
                        },
                        maxRotation: 0,
                        autoSkip: true,
                        autoSkipPadding: 16,
                    },
                },
                y: {
                    beginAtZero: true,
                    border: {
                        color: '#9fb0bd',
                    },
                    grid: {
                        color: '#edf2f5',
                    },
                    ticks: {
                        color: '#4f6475',
                        precision: 0,
                        callback(value) {
                            return formatNumber(value);
                        },
                    },
                },
            },
        },
    });

    return chart;
}

function parseReadings(value) {
    if (!value) return [];
    try {
        const parsed = JSON.parse(decodeURIComponent(value));
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((reading) => ({
                label: String(reading.label || ''),
                consumption: numberValue(reading.consumption),
            }))
            .filter((reading) => reading.label);
    } catch {
        return [];
    }
}

function numberValue(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(String(value).replace(/[$,]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value) {
    return NUMBER_FORMATTER.format(Number(value) || 0);
}
