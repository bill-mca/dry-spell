/**
 * Monthly Rainfall Pattern Visualization
 *
 * Shows seasonal rainfall patterns across the year
 */

import { formatNumber } from '../utils.js';

/**
 * Aggregate rainfall data by month
 *
 * @param {Array} rainfallData - Daily rainfall data
 * @returns {Object} Monthly statistics
 */
function aggregateByMonth(rainfallData) {
    const monthlyData = Array(12).fill(null).map(() => ({
        totals: [],
        validYears: new Set()
    }));

    // Group by year and month
    const yearMonthData = new Map();

    for (const day of rainfallData) {
        if (day.missing) continue;

        const year = day.date.getFullYear();
        const month = day.date.getMonth();
        const key = `${year}-${month}`;

        if (!yearMonthData.has(key)) {
            yearMonthData.set(key, {
                year,
                month,
                total: 0,
                days: 0
            });
        }

        const monthData = yearMonthData.get(key);
        monthData.total += day.rainfall_mm;
        monthData.days++;
    }

    // Aggregate into monthly statistics
    for (const [key, data] of yearMonthData) {
        monthlyData[data.month].totals.push(data.total);
        monthlyData[data.month].validYears.add(data.year);
    }

    // Calculate statistics for each month
    const monthStats = monthlyData.map((data, month) => {
        if (data.totals.length === 0) {
            return {
                month,
                avg: 0,
                min: 0,
                max: 0,
                years: 0
            };
        }

        const sorted = [...data.totals].sort((a, b) => a - b);
        return {
            month,
            avg: data.totals.reduce((sum, val) => sum + val, 0) / data.totals.length,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            years: data.validYears.size
        };
    });

    return monthStats;
}

/**
 * Get color based on rainfall amount (brown for dry, blue for wet)
 *
 * @param {number} rainfall_mm - Monthly rainfall in mm
 * @returns {string} RGB color string
 */
function getRainfallColor(rainfall_mm) {
    // Color scale: brown (0mm) -> yellow (50mm) -> cyan (100mm) -> blue (200mm+)
    if (rainfall_mm < 30) {
        // Dry - brown to tan
        const intensity = rainfall_mm / 30;
        return `rgba(${120 + intensity * 60}, ${80 + intensity * 80}, 40, 0.8)`;
    } else if (rainfall_mm < 80) {
        // Moderate - yellow to light blue
        const intensity = (rainfall_mm - 30) / 50;
        return `rgba(${180 - intensity * 80}, ${160 - intensity * 20}, ${40 + intensity * 180}, 0.8)`;
    } else {
        // Wet - blue
        const intensity = Math.min((rainfall_mm - 80) / 120, 1);
        return `rgba(${100 - intensity * 60}, ${140 - intensity * 40}, ${220}, 0.8)`;
    }
}

/**
 * Create monthly rainfall pattern chart
 *
 * @param {HTMLCanvasElement} canvas - Canvas element to render to
 * @param {Array} rainfallData - Daily rainfall data
 * @returns {Chart} Chart.js instance
 */
export function createMonthlyRainfallChart(canvas, rainfallData) {
    if (!canvas || !rainfallData || rainfallData.length === 0) {
        throw new Error('Invalid parameters for monthly rainfall chart');
    }

    const monthStats = aggregateByMonth(rainfallData);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Prepare chart data
    const chartData = {
        labels: monthNames,
        datasets: [
            {
                label: 'Average Monthly Rainfall',
                data: monthStats.map(m => m.avg),
                backgroundColor: monthStats.map(m => getRainfallColor(m.avg)),
                borderColor: 'rgba(0, 0, 0, 0.2)',
                borderWidth: 1
            }
        ]
    };

    // Chart configuration
    const config = {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
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
                            return monthNames[context[0].dataIndex];
                        },
                        label: function(context) {
                            const monthData = monthStats[context.dataIndex];
                            return [
                                `Average: ${formatNumber(monthData.avg, 1)} mm`,
                                `Range: ${formatNumber(monthData.min, 0)} - ${formatNumber(monthData.max, 0)} mm`,
                                `${monthData.years} years of data`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        color: '#64748b',
                        callback: function(value) {
                            return formatNumber(value, 0) + ' mm';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Rainfall (mm)',
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
 * Analyze rainfall patterns and generate insights
 *
 * @param {Array} rainfallData - Daily rainfall data
 * @returns {Object} Insights object
 */
export function analyzeRainfallPatterns(rainfallData) {
    const monthStats = aggregateByMonth(rainfallData);

    // Find driest and wettest months
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    const sortedByRainfall = [...monthStats].sort((a, b) => a.avg - b.avg);
    const driest = sortedByRainfall.slice(0, 3).filter(m => m.avg > 0);
    const wettest = sortedByRainfall.slice(-3).reverse();

    // Calculate seasonal patterns
    const summer = [11, 0, 1]; // Dec, Jan, Feb
    const autumn = [2, 3, 4];   // Mar, Apr, May
    const winter = [5, 6, 7];   // Jun, Jul, Aug
    const spring = [8, 9, 10];  // Sep, Oct, Nov

    const seasonAvg = (months) => {
        const total = months.reduce((sum, m) => sum + monthStats[m].avg, 0);
        return total / months.length;
    };

    const seasons = [
        { name: 'Summer', avg: seasonAvg(summer) },
        { name: 'Autumn', avg: seasonAvg(autumn) },
        { name: 'Winter', avg: seasonAvg(winter) },
        { name: 'Spring', avg: seasonAvg(spring) }
    ];

    const sortedSeasons = [...seasons].sort((a, b) => b.avg - a.avg);

    return {
        driest: driest.map(m => ({
            month: monthNames[m.month],
            avg: m.avg
        })),
        wettest: wettest.map(m => ({
            month: monthNames[m.month],
            avg: m.avg
        })),
        wettestSeason: sortedSeasons[0],
        driestSeason: sortedSeasons[sortedSeasons.length - 1],
        totalYears: Math.max(...monthStats.map(m => m.years))
    };
}

/**
 * Generate insights HTML for monthly rainfall
 *
 * @param {Object} insights - Result from analyzeRainfallPatterns()
 * @returns {string} HTML string
 */
export function generateMonthlyRainfallInsights(insights) {
    let html = '<h5>Seasonal Patterns</h5>';

    // Wettest period
    const wettestMonths = insights.wettest.map(m => m.month).join(', ');
    const wettestAvg = insights.wettest.reduce((sum, m) => sum + m.avg, 0) / insights.wettest.length;
    html += `<p><strong>Wettest months:</strong> ${wettestMonths} (avg ${formatNumber(wettestAvg, 0)} mm/month)</p>`;

    // Driest period
    if (insights.driest.length > 0) {
        const driestMonths = insights.driest.map(m => m.month).join(', ');
        const driestAvg = insights.driest.reduce((sum, m) => sum + m.avg, 0) / insights.driest.length;
        html += `<p><strong>Driest months:</strong> ${driestMonths} (avg ${formatNumber(driestAvg, 0)} mm/month)</p>`;
    }

    // Seasonal comparison
    html += `<p><strong>Wettest season:</strong> ${insights.wettestSeason.name} (${formatNumber(insights.wettestSeason.avg, 0)} mm/month)</p>`;
    html += `<p><strong>Driest season:</strong> ${insights.driestSeason.name} (${formatNumber(insights.driestSeason.avg, 0)} mm/month)</p>`;

    return html;
}
