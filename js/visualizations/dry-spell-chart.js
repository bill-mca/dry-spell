/**
 * Dry Spell Histogram Visualization
 *
 * Shows the distribution of consecutive dry day periods
 */

import { formatDate, formatDateRange } from '../utils.js';

/**
 * Analyze dry spells in rainfall data
 *
 * @param {Array} rainfallData - Daily rainfall data
 * @param {number} threshold_mm - Rainfall threshold for "dry" day (default: 1mm)
 * @returns {Object} Dry spell analysis
 */
export function analyzeDrySpells(rainfallData, threshold_mm = 1.0) {
    if (!rainfallData || rainfallData.length === 0) {
        throw new Error('No rainfall data provided');
    }

    const drySpells = [];
    let currentSpell = null;

    // Identify all dry spell periods
    for (const day of rainfallData) {
        const isDry = day.missing || day.rainfall_mm < threshold_mm;

        if (isDry) {
            if (!currentSpell) {
                currentSpell = {
                    startDate: day.date,
                    endDate: day.date,
                    duration: 1
                };
            } else {
                currentSpell.endDate = day.date;
                currentSpell.duration++;
            }
        } else {
            if (currentSpell) {
                drySpells.push(currentSpell);
                currentSpell = null;
            }
        }
    }

    // Close any open spell at end of data
    if (currentSpell) {
        drySpells.push(currentSpell);
    }

    // Create histogram bins
    const bins = [
        { label: '1-3 days', min: 1, max: 3, count: 0, spells: [] },
        { label: '4-7 days', min: 4, max: 7, count: 0, spells: [] },
        { label: '8-14 days', min: 8, max: 14, count: 0, spells: [] },
        { label: '15-30 days', min: 15, max: 30, count: 0, spells: [] },
        { label: '31-60 days', min: 31, max: 60, count: 0, spells: [] },
        { label: '60+ days', min: 61, max: Infinity, count: 0, spells: [] }
    ];

    // Categorize spells into bins
    for (const spell of drySpells) {
        for (const bin of bins) {
            if (spell.duration >= bin.min && spell.duration <= bin.max) {
                bin.count++;
                bin.spells.push(spell);
                break;
            }
        }
    }

    // Find longest spell
    const longestSpell = drySpells.reduce((longest, spell) =>
        spell.duration > longest.duration ? spell : longest,
        { duration: 0 }
    );

    // Calculate statistics
    const totalSpells = drySpells.length;
    const totalDryDays = drySpells.reduce((sum, spell) => sum + spell.duration, 0);
    const avgSpellDuration = totalSpells > 0 ? totalDryDays / totalSpells : 0;
    const dryDayPercentage = (totalDryDays / rainfallData.length) * 100;

    return {
        bins,
        drySpells,
        longestSpell,
        statistics: {
            totalSpells,
            totalDryDays,
            avgSpellDuration,
            dryDayPercentage,
            threshold_mm
        }
    };
}

/**
 * Get color based on dry spell severity
 *
 * @param {number} duration - Spell duration in days
 * @returns {string} RGBA color string
 */
function getSeverityColor(duration) {
    if (duration <= 3) {
        return 'rgba(254, 240, 138, 0.8)';  // Light yellow
    } else if (duration <= 7) {
        return 'rgba(252, 211, 77, 0.8)';   // Yellow
    } else if (duration <= 14) {
        return 'rgba(251, 146, 60, 0.8)';   // Orange
    } else if (duration <= 30) {
        return 'rgba(239, 68, 68, 0.8)';    // Red
    } else {
        return 'rgba(185, 28, 28, 0.8)';    // Dark red
    }
}

/**
 * Create dry spell histogram
 *
 * @param {HTMLCanvasElement} canvas - Canvas element to render to
 * @param {Array} rainfallData - Daily rainfall data
 * @param {number} threshold_mm - Threshold for dry day (default: 1mm)
 * @returns {Chart} Chart.js instance
 */
export function createDrySpellChart(canvas, rainfallData, threshold_mm = 1.0) {
    if (!canvas || !rainfallData || rainfallData.length === 0) {
        throw new Error('Invalid parameters for dry spell chart');
    }

    const analysis = analyzeDrySpells(rainfallData, threshold_mm);
    const { bins, longestSpell } = analysis;

    // Prepare chart data
    const chartData = {
        labels: bins.map(b => b.label),
        datasets: [
            {
                label: 'Number of Dry Spells',
                data: bins.map(b => b.count),
                backgroundColor: bins.map(b => {
                    // Use the midpoint of the bin for color
                    const midpoint = b.max === Infinity ? b.min + 30 : (b.min + b.max) / 2;
                    return getSeverityColor(midpoint);
                }),
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
            indexAxis: 'y',  // Horizontal bars
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
                            return bins[context[0].dataIndex].label;
                        },
                        label: function(context) {
                            const bin = bins[context.dataIndex];
                            const lines = [`${bin.count} dry spells`];

                            // Show example dates for this bin (up to 2)
                            if (bin.spells.length > 0) {
                                lines.push('');
                                lines.push('Examples:');
                                const examples = bin.spells.slice(0, 2);
                                for (const spell of examples) {
                                    lines.push(`${formatDateRange(spell.startDate, spell.endDate)} (${spell.duration}d)`);
                                }
                                if (bin.spells.length > 2) {
                                    lines.push(`...and ${bin.spells.length - 2} more`);
                                }
                            }

                            return lines;
                        },
                        afterLabel: function(context) {
                            const bin = bins[context.dataIndex];
                            // Highlight if this bin contains the longest spell
                            if (bin.spells.some(s => s.duration === longestSpell.duration)) {
                                return '\n⚠ Contains longest spell';
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        color: '#64748b',
                        precision: 0
                    },
                    title: {
                        display: true,
                        text: 'Number of Occurrences',
                        color: '#64748b',
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    };

    // Create chart
    const chart = new Chart(canvas, config);

    // Store analysis on chart for later access
    chart.config._config._drySpellAnalysis = analysis;

    return chart;
}

/**
 * Generate statistics HTML for dry spell analysis
 *
 * @param {Object} analysis - Result from analyzeDrySpells()
 * @returns {string} HTML string
 */
export function generateDrySpellStats(analysis) {
    const { statistics, longestSpell } = analysis;

    let html = '<div class="dry-spell-stats">';

    // Total dry spells
    html += '<div class="dry-spell-stat">';
    html += '<div class="dry-spell-stat-label">Total Dry Spells</div>';
    html += `<div class="dry-spell-stat-value">${statistics.totalSpells}</div>`;
    html += `<div class="dry-spell-stat-detail">Rainfall < ${statistics.threshold_mm} mm/day</div>`;
    html += '</div>';

    // Longest spell
    html += '<div class="dry-spell-stat">';
    html += '<div class="dry-spell-stat-label">Longest Spell</div>';
    html += `<div class="dry-spell-stat-value">${longestSpell.duration} days</div>`;
    if (longestSpell.duration > 0) {
        html += `<div class="dry-spell-stat-detail">${formatDateRange(longestSpell.startDate, longestSpell.endDate)}</div>`;
    }
    html += '</div>';

    // Average duration
    html += '<div class="dry-spell-stat">';
    html += '<div class="dry-spell-stat-label">Average Duration</div>';
    html += `<div class="dry-spell-stat-value">${statistics.avgSpellDuration.toFixed(1)} days</div>`;
    html += `<div class="dry-spell-stat-detail">Per dry spell</div>`;
    html += '</div>';

    // Percentage of dry days
    html += '<div class="dry-spell-stat">';
    html += '<div class="dry-spell-stat-label">Dry Days</div>';
    html += `<div class="dry-spell-stat-value">${statistics.dryDayPercentage.toFixed(1)}%</div>`;
    html += `<div class="dry-spell-stat-detail">${statistics.totalDryDays} of ${statistics.totalSpells > 0 ? Math.round(statistics.totalDryDays / statistics.dryDayPercentage * 100) : 0} days</div>`;
    html += '</div>';

    html += '</div>';

    return html;
}
