/**
 * Security Mode Analysis
 *
 * Calculates the minimum tank size needed to achieve a target reliability level,
 * and provides detailed failure analysis.
 */

import { runWaterBalance, DEFAULTS } from './water-balance.js';
import { formatDate, formatDateRange, groupBy } from './utils.js';

/**
 * Tank size search parameters
 */
const SEARCH_MIN = 1000;      // 1,000 L minimum
const SEARCH_MAX = 100000;    // 100,000 L maximum
const SEARCH_STEP = 500;      // 500 L increments

/**
 * Analyze security mode requirements
 *
 * @param {Array} rainfallData - Parsed rainfall data
 * @param {Object} params - Analysis parameters
 * @param {number} params.roofArea_m2 - Roof catchment area
 * @param {number} params.dailyUsage_L - Daily water usage
 * @param {number} params.confidenceLevel - Target confidence (0.90 - 0.999)
 * @returns {Object} Security analysis results
 */
export function analyzeSecurityMode(rainfallData, params) {
    const { roofArea_m2, dailyUsage_L, confidenceLevel } = params;

    // Find minimum tank size for target confidence
    const tankSizing = findMinimumTankForConfidence(
        rainfallData,
        { roofArea_m2, dailyUsage_L },
        confidenceLevel
    );

    // Run detailed analysis at recommended size
    const recommendedResult = runWaterBalance({
        rainfallData,
        tankSize_L: tankSizing.recommendedSize,
        roofArea_m2,
        dailyUsage_L
    });

    // Analyze smaller tank sizes for comparison
    const smallerTankAnalysis = analyzeSmallterTanks(
        rainfallData,
        { roofArea_m2, dailyUsage_L },
        tankSizing.recommendedSize
    );

    // Generate confidence statement
    const actualReliability = recommendedResult.summary.reliabilityPercent;
    const confidenceStatement = generateConfidenceStatement(
        tankSizing.recommendedSize,
        actualReliability,
        confidenceLevel * 100
    );

    return {
        recommendedTankSize_L: tankSizing.recommendedSize,
        actualReliability: actualReliability,
        targetConfidence: confidenceLevel * 100,
        confidenceStatement,
        stressStatistics: {
            daysBelow20pct: recommendedResult.summary.daysBelowStress,
            daysBelow50pct: recommendedResult.summary.daysBelow50pct,
            totalDays: recommendedResult.summary.totalDays,
            percentageStressed: recommendedResult.summary.stressPercent
        },
        failureEvents: recommendedResult.emptyPeriods,
        smallerTankAnalysis,
        worstDrySpell: recommendedResult.worstDrySpell,
        simulation: recommendedResult
    };
}

/**
 * Find the minimum tank size that achieves target confidence
 *
 * @param {Array} rainfallData - Rainfall data
 * @param {Object} baseConfig - Base simulation config
 * @param {number} targetConfidence - Target confidence (0-1)
 * @returns {Object} Tank sizing result
 */
function findMinimumTankForConfidence(rainfallData, baseConfig, targetConfidence) {
    // Binary search for minimum tank size
    let low = SEARCH_MIN;
    let high = SEARCH_MAX;
    let bestSize = SEARCH_MAX;
    let bestReliability = 0;

    // First check if even the max size achieves target
    const maxResult = runWaterBalance({
        rainfallData,
        tankSize_L: SEARCH_MAX,
        ...baseConfig
    });

    if (maxResult.summary.reliabilityPercent / 100 < targetConfidence) {
        // Even max tank can't achieve target - return max with warning
        return {
            recommendedSize: SEARCH_MAX,
            achievedConfidence: maxResult.summary.reliabilityPercent,
            reachedLimit: true
        };
    }

    // Binary search
    while (low <= high) {
        const mid = Math.round((low + high) / 2 / SEARCH_STEP) * SEARCH_STEP;

        const result = runWaterBalance({
            rainfallData,
            tankSize_L: mid,
            ...baseConfig
        });

        const reliability = result.summary.reliabilityPercent / 100;

        if (reliability >= targetConfidence) {
            bestSize = mid;
            bestReliability = reliability;
            high = mid - SEARCH_STEP;
        } else {
            low = mid + SEARCH_STEP;
        }
    }

    // Round up to nearest 1000L for practical tank sizes
    const practicalSize = Math.ceil(bestSize / 1000) * 1000;

    // Verify practical size still meets target
    const verifyResult = runWaterBalance({
        rainfallData,
        tankSize_L: practicalSize,
        ...baseConfig
    });

    return {
        recommendedSize: practicalSize,
        achievedConfidence: verifyResult.summary.reliabilityPercent,
        exactMinimum: bestSize,
        reachedLimit: false
    };
}

/**
 * Analyze what would happen with smaller tank sizes
 *
 * @param {Array} rainfallData - Rainfall data
 * @param {Object} baseConfig - Base simulation config
 * @param {number} recommendedSize - The recommended tank size
 * @returns {Array} Analysis of smaller tank sizes
 */
function analyzeSmallterTanks(rainfallData, baseConfig, recommendedSize) {
    // Test a range of smaller sizes
    const sizesToTest = [
        Math.round(recommendedSize * 0.75 / 1000) * 1000,
        Math.round(recommendedSize * 0.5 / 1000) * 1000,
        Math.round(recommendedSize * 0.33 / 1000) * 1000,
        Math.round(recommendedSize * 0.25 / 1000) * 1000
    ].filter(size => size >= 1000);

    // Remove duplicates and sort descending
    const uniqueSizes = [...new Set(sizesToTest)].sort((a, b) => b - a);

    return uniqueSizes.map(size => {
        const result = runWaterBalance({
            rainfallData,
            tankSize_L: size,
            ...baseConfig
        });

        // Group failures by year
        const failuresByYear = groupBy(result.emptyPeriods, period => period.year);
        const yearsWithFailures = Array.from(failuresByYear.keys()).sort();

        return {
            tankSize_L: size,
            totalFailures: result.emptyPeriods.length,
            daysEmpty: result.summary.daysEmpty,
            yearsWithFailures,
            failureEvents: result.emptyPeriods,
            description: generateFailureDescription(result.emptyPeriods)
        };
    });
}

/**
 * Generate a human-readable failure description
 *
 * @param {Array} emptyPeriods - Array of empty tank periods
 * @returns {string} Description of failures
 */
function generateFailureDescription(emptyPeriods) {
    if (emptyPeriods.length === 0) {
        return 'Never ran empty';
    }

    if (emptyPeriods.length === 1) {
        const period = emptyPeriods[0];
        const duration = period.duration === 1 ? '1 day' : `${period.duration} days`;
        return `Empty once: ${formatDate(period.startDate, 'short')} (${duration})`;
    }

    // Group by year
    const byYear = groupBy(emptyPeriods, p => p.year);
    const years = Array.from(byYear.keys()).sort();

    if (emptyPeriods.length <= 4) {
        // List individual events
        const events = emptyPeriods.map(p => {
            const duration = p.duration === 1 ? '1 day' : `${p.duration} days`;
            return `${formatDate(p.startDate, 'short')} (${duration})`;
        });
        return `Empty ${emptyPeriods.length} times: ${events.join(', ')}`;
    }

    // Summarize by year count
    return `Empty ${emptyPeriods.length} times across ${years.length} years (${years.join(', ')})`;
}

/**
 * Generate a confidence statement
 *
 * @param {number} tankSize - Recommended tank size
 * @param {number} actualReliability - Actual reliability achieved
 * @param {number} targetConfidence - Target confidence percentage
 * @returns {string} Human-readable confidence statement
 */
function generateConfidenceStatement(tankSize, actualReliability, targetConfidence) {
    if (actualReliability >= 100) {
        return `This tank never ran empty in the historical data`;
    }

    if (actualReliability >= targetConfidence) {
        return `Meets your ${targetConfidence}% security target (${actualReliability.toFixed(1)}% reliability)`;
    }

    return `Best available: ${actualReliability.toFixed(1)}% reliability (target was ${targetConfidence}%)`;
}

/**
 * Generate dry spell analysis text
 *
 * @param {Object} drySpell - Worst dry spell data
 * @param {number} tankSize - Tank size being analyzed
 * @param {Object} simulationResult - Full simulation result
 * @returns {Object} Dry spell analysis
 */
export function analyzeDrySpell(drySpell, tankSize, simulationResult) {
    if (!drySpell || drySpell.duration === 0) {
        return {
            dateRange: 'No significant dry spell found',
            duration: 0,
            totalRainfall: 0,
            tankImpact: 'N/A'
        };
    }

    // Find minimum tank level during this period
    const drySpellStart = drySpell.startDate.getTime();
    const drySpellEnd = drySpell.endDate.getTime();

    const levelsInPeriod = simulationResult.dailyLevels.filter(d => {
        const time = d.date.getTime();
        return time >= drySpellStart && time <= drySpellEnd;
    });

    const minLevel = levelsInPeriod.length > 0
        ? Math.min(...levelsInPeriod.map(d => d.level_L))
        : 0;

    const minLevelPercent = (minLevel / tankSize) * 100;

    return {
        dateRange: formatDateRange(drySpell.startDate, drySpell.endDate),
        duration: drySpell.duration,
        totalRainfall: drySpell.totalRainfall,
        minLevel,
        minLevelPercent,
        tankImpact: minLevel === 0
            ? 'Tank would have run empty'
            : `Tank dropped to ${minLevelPercent.toFixed(0)}% (${Math.round(minLevel).toLocaleString()} L)`
    };
}
