/**
 * Opportunistic Mode Analysis
 *
 * Compares different tank sizes to help users find the best value
 * for offsetting mains water usage.
 */

import { runWaterBalance, calculateRoofPotential, TANK_SIZES, DEFAULTS } from './water-balance.js';

/**
 * Analyze opportunistic mode - compare tank sizes for savings
 *
 * @param {Array} rainfallData - Parsed rainfall data
 * @param {Object} params - Analysis parameters
 * @param {number} params.roofArea_m2 - Roof catchment area
 * @param {number} params.dailyUsage_L - Daily water usage
 * @param {number} params.waterRate_perKL - Water rate in dollars per kilolitre
 * @param {number[]} [params.tankSizesToCompare] - Tank sizes to analyze
 * @returns {Object} Opportunistic analysis results
 */
export function analyzeOpportunisticMode(rainfallData, params) {
    const {
        roofArea_m2,
        dailyUsage_L,
        waterRate_perKL,
        tankSizesToCompare = TANK_SIZES
    } = params;

    // Calculate roof potential
    const roofPotential = calculateRoofPotential(rainfallData, roofArea_m2);

    // Calculate total water demand over the period
    const totalDays = rainfallData.length;
    const totalDemand_L = dailyUsage_L * totalDays;
    const years = totalDays / 365.25;

    // Analyze each tank size
    const comparisons = tankSizesToCompare.map(tankSize_L => {
        const result = runWaterBalance({
            rainfallData,
            tankSize_L,
            roofArea_m2,
            dailyUsage_L
        });

        // Calculate actual rainwater used (demand minus deficit)
        const totalDeficit_L = result.summary.totalDeficit_L;
        const rainwaterUsed_L = totalDemand_L - totalDeficit_L;
        const mainsWaterNeeded_L = totalDeficit_L;

        // Calculate percentages
        const percentOffset = (rainwaterUsed_L / totalDemand_L) * 100;

        // Calculate annual values
        const annualRainwaterUsed_L = rainwaterUsed_L / years;
        const annualMainsNeeded_L = mainsWaterNeeded_L / years;
        const annualSavings = (annualRainwaterUsed_L / 1000) * waterRate_perKL;

        // Calculate efficiency (how much of captured rain is used vs overflow)
        const totalCapture = roofPotential.totalCapture_L;
        const overflow_L = result.summary.totalOverflow_L;
        const captureEfficiency = totalCapture > 0
            ? ((totalCapture - overflow_L) / totalCapture) * 100
            : 0;

        // Overflow as percentage of potential capture
        const overflowPercent = totalCapture > 0
            ? (overflow_L / totalCapture) * 100
            : 0;

        return {
            tankSize_L,
            rainwaterUsed_L,
            mainsWaterNeeded_L,
            percentOffset,
            annualRainwaterUsed_L,
            annualMainsNeeded_L,
            annualSavings,
            overflow_L,
            overflowPercent,
            captureEfficiency,
            daysEmpty: result.summary.daysEmpty
        };
    });

    // Find the "best value" tank - best balance of savings vs diminishing returns
    const bestValue = findBestValueTank(comparisons);

    // Calculate user's current annual water cost
    const annualDemand_kL = (dailyUsage_L * 365.25) / 1000;
    const annualWaterCost = annualDemand_kL * waterRate_perKL;

    return {
        comparisons,
        bestValueSize: bestValue.tankSize_L,
        bestValueIndex: comparisons.findIndex(c => c.tankSize_L === bestValue.tankSize_L),
        roofPotential: {
            annual_L: roofPotential.annualCapture_L,
            annual_kL: roofPotential.annualCapture_L / 1000,
            annualValue: (roofPotential.annualCapture_L / 1000) * waterRate_perKL,
            total_L: roofPotential.totalCapture_L
        },
        waterCost: {
            annualDemand_kL,
            annualCost: annualWaterCost,
            ratePerKL: waterRate_perKL
        }
    };
}

/**
 * Find the "best value" tank size based on diminishing returns
 *
 * Uses a simple heuristic: the tank where the marginal benefit
 * (additional % offset per additional cost/size) starts declining significantly
 *
 * @param {Array} comparisons - Array of tank comparison results
 * @returns {Object} Best value comparison entry
 */
function findBestValueTank(comparisons) {
    if (comparisons.length === 0) {
        return null;
    }

    if (comparisons.length === 1) {
        return comparisons[0];
    }

    // Calculate marginal benefit for each step up in tank size
    const marginalBenefits = [];

    for (let i = 1; i < comparisons.length; i++) {
        const prev = comparisons[i - 1];
        const curr = comparisons[i];

        const sizeIncrease = curr.tankSize_L - prev.tankSize_L;
        const offsetIncrease = curr.percentOffset - prev.percentOffset;
        const savingsIncrease = curr.annualSavings - prev.annualSavings;

        // Marginal efficiency: additional offset per 1000L of tank
        const marginalEfficiency = offsetIncrease / (sizeIncrease / 1000);

        marginalBenefits.push({
            fromSize: prev.tankSize_L,
            toSize: curr.tankSize_L,
            offsetIncrease,
            savingsIncrease,
            marginalEfficiency
        });
    }

    // Find the point where marginal efficiency drops below a threshold
    // or drops significantly from the previous step
    const EFFICIENCY_THRESHOLD = 2; // % offset per 1000L
    const EFFICIENCY_DROP_RATIO = 0.5; // 50% drop from previous

    let bestIndex = 0;

    for (let i = 0; i < marginalBenefits.length; i++) {
        const benefit = marginalBenefits[i];

        // Check if this upgrade still provides good value
        const previousEfficiency = i > 0 ? marginalBenefits[i - 1].marginalEfficiency : Infinity;
        const efficiencyDrop = benefit.marginalEfficiency / previousEfficiency;

        if (benefit.marginalEfficiency < EFFICIENCY_THRESHOLD ||
            (i > 0 && efficiencyDrop < EFFICIENCY_DROP_RATIO)) {
            // The previous size was the sweet spot
            break;
        }

        bestIndex = i + 1;
    }

    // Ensure we return at least the smallest tank if all provide poor value
    return comparisons[Math.min(bestIndex, comparisons.length - 1)];
}

/**
 * Generate a summary for a tank comparison
 *
 * @param {Object} comparison - Single tank comparison result
 * @param {boolean} isBestValue - Whether this is the best value option
 * @returns {Object} Summary with formatted values
 */
export function generateComparisonSummary(comparison, isBestValue = false) {
    return {
        size: formatTankSize(comparison.tankSize_L),
        offset: `${comparison.percentOffset.toFixed(0)}%`,
        savings: `$${comparison.annualSavings.toFixed(0)}/yr`,
        efficiency: `${comparison.captureEfficiency.toFixed(0)}%`,
        overflow: `${comparison.overflowPercent.toFixed(0)}% lost`,
        isBestValue
    };
}

/**
 * Format tank size for display
 *
 * @param {number} litres - Tank size in litres
 * @returns {string} Formatted string
 */
function formatTankSize(litres) {
    if (litres >= 1000) {
        const kl = litres / 1000;
        return kl === Math.floor(kl) ? `${kl} kL` : `${kl.toFixed(1)} kL`;
    }
    return `${litres} L`;
}
