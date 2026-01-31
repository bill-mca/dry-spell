/**
 * Water Balance Simulation Engine
 *
 * Simulates daily water tank levels based on:
 * - Roof catchment area
 * - Daily rainfall data
 * - Daily water usage
 * - Tank capacity
 */

import { clamp } from './utils.js';

/**
 * Default configuration values
 */
export const DEFAULTS = {
    roofArea_m2: 180,
    dailyUsage_L: 500,
    waterRate_perKL: 3.50,
    runoffCoefficient: 0.85,
    securityConfidence: 0.95,
    stressThreshold: 0.20  // 20% of tank capacity
};

/**
 * Standard tank sizes for comparison (in litres)
 */
export const TANK_SIZES = [2000, 5000, 10000, 15000, 20000, 25000];

/**
 * Run a water balance simulation over the rainfall data
 *
 * @param {Object} config - Simulation configuration
 * @param {Array} config.rainfallData - Array of {date, rainfall_mm, missing} objects
 * @param {number} config.tankSize_L - Tank capacity in litres
 * @param {number} config.roofArea_m2 - Roof catchment area in square metres
 * @param {number} config.dailyUsage_L - Daily water usage in litres
 * @param {number} [config.runoffCoefficient=0.85] - Fraction of rainfall captured
 * @param {number} [config.initialLevel_L] - Starting tank level (default: half full)
 * @returns {Object} Simulation results
 */
export function runWaterBalance(config) {
    const {
        rainfallData,
        tankSize_L,
        roofArea_m2,
        dailyUsage_L,
        runoffCoefficient = DEFAULTS.runoffCoefficient,
        initialLevel_L = tankSize_L / 2
    } = config;

    if (!rainfallData || rainfallData.length === 0) {
        throw new Error('No rainfall data provided');
    }

    if (tankSize_L <= 0 || roofArea_m2 <= 0 || dailyUsage_L <= 0) {
        throw new Error('Tank size, roof area, and daily usage must be positive');
    }

    const stressThreshold_L = tankSize_L * DEFAULTS.stressThreshold;

    // Initialize tracking variables
    const dailyLevels = [];
    let currentLevel = clamp(initialLevel_L, 0, tankSize_L);

    // Summary statistics
    let totalOverflow_L = 0;
    let totalDeficit_L = 0;
    let daysEmpty = 0;
    let daysBelowStress = 0;
    let daysBelow50pct = 0;

    // Track empty and stress periods
    const emptyPeriods = [];
    const stressPeriods = [];
    let currentEmptyPeriod = null;
    let currentStressPeriod = null;

    // Process each day
    for (const dayData of rainfallData) {
        // Calculate inflow: 1mm on 1m² = 1 litre
        const inflow_L = dayData.missing
            ? 0  // Assume no rain on missing data days (conservative)
            : dayData.rainfall_mm * roofArea_m2 * runoffCoefficient;

        // Calculate new level before clamping
        const rawNewLevel = currentLevel + inflow_L - dailyUsage_L;

        // Calculate overflow and deficit
        const overflow_L = Math.max(0, rawNewLevel - tankSize_L);
        const deficit_L = Math.max(0, -rawNewLevel);

        // Clamp to valid range
        const newLevel = clamp(rawNewLevel, 0, tankSize_L);

        // Update totals
        totalOverflow_L += overflow_L;
        totalDeficit_L += deficit_L;

        // Track empty days
        const isEmpty = newLevel === 0;
        if (isEmpty) {
            daysEmpty++;

            if (!currentEmptyPeriod) {
                currentEmptyPeriod = {
                    startDate: dayData.date,
                    endDate: dayData.date,
                    duration: 1,
                    year: dayData.date.getFullYear()
                };
            } else {
                currentEmptyPeriod.endDate = dayData.date;
                currentEmptyPeriod.duration++;
            }
        } else if (currentEmptyPeriod) {
            emptyPeriods.push(currentEmptyPeriod);
            currentEmptyPeriod = null;
        }

        // Track stress periods (below threshold)
        const isStressed = newLevel < stressThreshold_L;
        if (isStressed) {
            daysBelowStress++;

            if (!currentStressPeriod) {
                currentStressPeriod = {
                    startDate: dayData.date,
                    endDate: dayData.date,
                    minLevel: newLevel,
                    year: dayData.date.getFullYear()
                };
            } else {
                currentStressPeriod.endDate = dayData.date;
                currentStressPeriod.minLevel = Math.min(currentStressPeriod.minLevel, newLevel);
            }
        } else if (currentStressPeriod) {
            stressPeriods.push(currentStressPeriod);
            currentStressPeriod = null;
        }

        // Track 50% threshold
        if (newLevel < tankSize_L * 0.5) {
            daysBelow50pct++;
        }

        // Record daily state
        dailyLevels.push({
            date: dayData.date,
            level_L: newLevel,
            inflow_L,
            usage_L: dailyUsage_L,
            overflow_L,
            deficit_L,
            isEmpty,
            isStressed
        });

        currentLevel = newLevel;
    }

    // Close any open periods at end of data
    if (currentEmptyPeriod) {
        emptyPeriods.push(currentEmptyPeriod);
    }
    if (currentStressPeriod) {
        stressPeriods.push(currentStressPeriod);
    }

    // Find worst dry spell (longest period with minimal rain)
    const worstDrySpell = findWorstDrySpell(rainfallData, roofArea_m2, runoffCoefficient);

    return {
        dailyLevels,
        summary: {
            totalDays: dailyLevels.length,
            daysEmpty,
            daysBelowStress,
            daysBelow50pct,
            totalOverflow_L,
            totalDeficit_L,
            reliabilityPercent: ((dailyLevels.length - daysEmpty) / dailyLevels.length) * 100,
            stressPercent: (daysBelowStress / dailyLevels.length) * 100
        },
        emptyPeriods,
        stressPeriods,
        worstDrySpell
    };
}

/**
 * Find the worst dry spell in the rainfall data
 * A dry spell is defined as consecutive days where cumulative inflow
 * is less than typical daily usage
 *
 * @param {Array} rainfallData - Rainfall data array
 * @param {number} roofArea_m2 - Roof area
 * @param {number} runoffCoefficient - Runoff coefficient
 * @returns {Object} Worst dry spell information
 */
function findWorstDrySpell(rainfallData, roofArea_m2, runoffCoefficient) {
    // Find the longest period where average daily inflow was below a threshold
    const THRESHOLD_MM_PER_DAY = 2;  // Less than 2mm/day average is "dry"

    let worstSpell = null;
    let currentSpell = null;

    for (let i = 0; i < rainfallData.length; i++) {
        const dayData = rainfallData[i];
        const rainfall = dayData.missing ? 0 : dayData.rainfall_mm;

        if (!currentSpell) {
            currentSpell = {
                startDate: dayData.date,
                endDate: dayData.date,
                totalRainfall: rainfall,
                duration: 1
            };
        } else {
            // Check if this day continues the dry spell
            const newTotal = currentSpell.totalRainfall + rainfall;
            const newDuration = currentSpell.duration + 1;
            const avgRainfall = newTotal / newDuration;

            if (avgRainfall < THRESHOLD_MM_PER_DAY) {
                // Continue the dry spell
                currentSpell.endDate = dayData.date;
                currentSpell.totalRainfall = newTotal;
                currentSpell.duration = newDuration;
            } else {
                // End current spell, check if worst
                if (!worstSpell || currentSpell.duration > worstSpell.duration) {
                    worstSpell = { ...currentSpell };
                }
                // Start new potential spell
                currentSpell = {
                    startDate: dayData.date,
                    endDate: dayData.date,
                    totalRainfall: rainfall,
                    duration: 1
                };
            }
        }
    }

    // Check final spell
    if (currentSpell && (!worstSpell || currentSpell.duration > worstSpell.duration)) {
        worstSpell = currentSpell;
    }

    return worstSpell || {
        startDate: rainfallData[0].date,
        endDate: rainfallData[0].date,
        totalRainfall: 0,
        duration: 0
    };
}

/**
 * Run simulation for multiple tank sizes
 *
 * @param {Object} config - Base configuration (without tankSize_L)
 * @param {number[]} tankSizes - Array of tank sizes to test
 * @returns {Map} Map of tank size to simulation results
 */
export function runMultipleSizes(config, tankSizes = TANK_SIZES) {
    const results = new Map();

    for (const size of tankSizes) {
        const result = runWaterBalance({
            ...config,
            tankSize_L: size
        });
        results.set(size, result);
    }

    return results;
}

/**
 * Calculate total potential roof capture over the data period
 *
 * @param {Array} rainfallData - Rainfall data
 * @param {number} roofArea_m2 - Roof area
 * @param {number} runoffCoefficient - Runoff coefficient
 * @returns {Object} Capture statistics
 */
export function calculateRoofPotential(rainfallData, roofArea_m2, runoffCoefficient = DEFAULTS.runoffCoefficient) {
    let totalCapture_L = 0;
    let validDays = 0;

    for (const day of rainfallData) {
        if (!day.missing) {
            totalCapture_L += day.rainfall_mm * roofArea_m2 * runoffCoefficient;
            validDays++;
        }
    }

    const years = rainfallData.length / 365.25;
    const annualCapture_L = totalCapture_L / years;

    return {
        totalCapture_L,
        annualCapture_L,
        dailyAverage_L: totalCapture_L / validDays,
        years
    };
}
