/**
 * Tank Level Over Time Visualization
 *
 * Shows how the tank level fluctuates over the historical period
 */

import { formatDate, formatLitres, formatPercent } from '../utils.js';

/**
 * Decimate data for better performance with long time series
 *
 * @param {Array} data - Daily level data
 * @param {number} maxPoints - Maximum number of points to display
 * @returns {Array} Decimated data
 */
function decimateData(data, maxPoints = 500) {
    if (data.length <= maxPoints) {
        return data;
    }

    const decimationFactor = Math.ceil(data.length / maxPoints);
    const decimated = [];

    for (let i = 0; i < data.length; i += decimationFactor) {
        // Use average of the window
        const windowEnd = Math.min(i + decimationFactor, data.length);
        const window = data.slice(i, windowEnd);

        const avgLevel = window.reduce((sum, d) => sum + d.level_L, 0) / window.length;
        const anyEmpty = window.some(d => d.isEmpty);

        decimated.push({
            date: data[i].date,
            level_L: avgLevel,
            isEmpty: anyEmpty,
            isDecimated: true
        });
    }

    return decimated;
}

/**
 * Create a gradient for tank level visualization
 * Red (empty) -> Yellow (low) -> Blue (medium) -> Green (full)
 *
 * @param {Object} ctx - Canvas context
 * @param {Object} chartArea - Chart area dimensions
 * @param {number} tankSize_L - Tank capacity
 * @returns {CanvasGradient} Gradient object
 */
function createTankLevelGradient(ctx, chartArea, tankSize_L) {
    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);

    // Color stops based on tank level percentage
    gradient.addColorStop(0, 'rgba(220, 38, 38, 0.6)');      // 0% - Red (empty)
    gradient.addColorStop(0.2, 'rgba(245, 158, 11, 0.6)');   // 20% - Amber (stress)
    gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.6)');   // 50% - Blue (medium)
    gradient.addColorStop(1, 'rgba(5, 150, 105, 0.6)');      // 100% - Green (full)

    return gradient;
}

/**
 * Create tank level over time chart
 *
 * @param {HTMLCanvasElement} canvas - Canvas element to render to
 * @param {Object} simulationResult - Result from runWaterBalance()
 * @param {number} tankSize_L - Tank capacity in litres
 * @returns {Chart} Chart.js instance
 */
export function createTankLevelChart(canvas, simulationResult, tankSize_L) {
    if (!canvas || !simulationResult || !simulationResult.dailyLevels) {
        throw new Error('Invalid parameters for tank level chart');
    }

    const { dailyLevels } = simulationResult;

    // Decimate data for performance
    const displayData = decimateData(dailyLevels, 500);

    // Prepare chart data
    const chartData = {
        labels: displayData.map(d => d.date),
        datasets: [
            {
                label: 'Tank Level',
                data: displayData.map(d => d.level_L),
                borderColor: 'rgba(37, 99, 235, 0.8)',
                backgroundColor: function(context) {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;

                    if (!chartArea) {
                        return 'rgba(37, 99, 235, 0.3)';
                    }
                    return createTankLevelGradient(ctx, chartArea, tankSize_L);
                },
                borderWidth: 2,
                fill: true,
                tension: 0.1,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: 'rgba(37, 99, 235, 1)',
                segment: {
                    // Highlight empty periods in red
                    borderColor: ctx => {
                        const current = displayData[ctx.p0DataIndex];
                        const next = displayData[ctx.p1DataIndex];
                        return (current?.isEmpty || next?.isEmpty)
                            ? 'rgba(220, 38, 38, 0.8)'
                            : 'rgba(37, 99, 235, 0.8)';
                    }
                }
            }
        ]
    };

    // Chart configuration
    const config = {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 13
                    },
                    bodyFont: {
                        size: 12
                    },
                    callbacks: {
                        title: function(context) {
                            const dataPoint = displayData[context[0].dataIndex];
                            return formatDate(dataPoint.date);
                        },
                        label: function(context) {
                            const level = context.parsed.y;
                            const percentage = (level / tankSize_L) * 100;
                            return [
                                `Level: ${formatLitres(level)}`,
                                `Capacity: ${formatPercent(percentage / 100)}`
                            ];
                        },
                        afterLabel: function(context) {
                            const dataPoint = displayData[context.dataIndex];
                            if (dataPoint.isEmpty) {
                                return '⚠ Tank empty';
                            }
                            if (dataPoint.isDecimated) {
                                return '(averaged data)';
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: displayData.length > 1825 ? 'year' : displayData.length > 365 ? 'month' : 'day',
                        displayFormats: {
                            day: 'MMM d',
                            month: 'MMM yyyy',
                            year: 'yyyy'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        color: '#64748b',
                        maxRotation: 0,
                        autoSkipPadding: 20
                    }
                },
                y: {
                    beginAtZero: true,
                    max: tankSize_L,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        color: '#64748b',
                        callback: function(value) {
                            return formatLitres(value);
                        }
                    },
                    title: {
                        display: true,
                        text: 'Tank Level (litres)',
                        color: '#64748b',
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
                }
            }
        }
    };

    // Create and return chart
    return new Chart(canvas, config);
}

/**
 * Generate insights text for tank level chart
 *
 * @param {Object} simulationResult - Simulation results
 * @param {number} tankSize_L - Tank capacity
 * @returns {string} HTML string with insights
 */
export function generateTankLevelInsights(simulationResult, tankSize_L) {
    const { summary, dailyLevels } = simulationResult;

    // Calculate average level
    const avgLevel = dailyLevels.reduce((sum, d) => sum + d.level_L, 0) / dailyLevels.length;
    const avgPercent = (avgLevel / tankSize_L) * 100;

    // Find min and max levels
    const minLevel = Math.min(...dailyLevels.map(d => d.level_L));
    const maxLevel = Math.max(...dailyLevels.map(d => d.level_L));

    let insights = `<p><strong>Average level:</strong> ${formatLitres(avgLevel)} (${formatPercent(avgPercent / 100)})</p>`;
    insights += `<p><strong>Range:</strong> ${formatLitres(minLevel)} to ${formatLitres(maxLevel)}</p>`;

    if (summary.daysEmpty > 0) {
        insights += `<p><strong>Empty periods:</strong> Tank ran dry ${summary.daysEmpty} days</p>`;
    } else {
        insights += `<p><strong>No empty periods:</strong> Tank never ran dry ✓</p>`;
    }

    return insights;
}
