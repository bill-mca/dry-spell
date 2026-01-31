/**
 * Dry Spell - Main Application Controller
 *
 * Manages app state, wizard flow, and coordinates between modules.
 */

import { parseBoMCSV, generateDataSummary } from './csv-parser.js';
import { DEFAULTS, TANK_SIZES } from './water-balance.js';
import { analyzeSecurityMode, analyzeDrySpell } from './security-mode.js';
import { analyzeOpportunisticMode } from './opportunistic-mode.js';
import {
    formatNumber,
    formatLitres,
    formatCurrency,
    formatPercent,
    formatDate,
    formatDateRange,
    formatTankSize,
    formatDays
} from './utils.js';

/**
 * Application State
 */
const state = {
    currentStep: 'upload',
    rainfallData: null,
    parseResult: null,
    mode: null,  // 'security' | 'opportunistic'
    params: {
        roofArea_m2: DEFAULTS.roofArea_m2,
        dailyUsage_L: DEFAULTS.dailyUsage_L,
        confidenceLevel: DEFAULTS.securityConfidence,
        waterRate_perKL: DEFAULTS.waterRate_perKL
    },
    results: null
};

/**
 * DOM Elements
 */
let elements = {};

/**
 * Initialize the application
 */
function init() {
    cacheElements();
    bindEvents();
    showStep('upload');
}

/**
 * Cache DOM element references
 */
function cacheElements() {
    elements = {
        // Steps
        steps: {
            upload: document.querySelector('[data-step="upload"]'),
            mode: document.querySelector('[data-step="mode"]'),
            params: document.querySelector('[data-step="params"]'),
            results: document.querySelector('[data-step="results"]')
        },

        // Upload
        uploadZone: document.getElementById('upload-zone'),
        fileInput: document.getElementById('file-input'),
        uploadStatus: document.getElementById('upload-status'),
        statusLoading: document.getElementById('status-loading'),
        statusSuccess: document.getElementById('status-success'),
        statusError: document.getElementById('status-error'),
        dataSummary: document.getElementById('data-summary'),
        errorMessage: document.getElementById('error-message'),

        // Navigation buttons
        btnToMode: document.getElementById('btn-to-mode'),
        btnBackToUpload: document.getElementById('btn-back-to-upload'),
        btnToParams: document.getElementById('btn-to-params'),
        btnBackToMode: document.getElementById('btn-back-to-mode'),
        btnCalculate: document.getElementById('btn-calculate'),
        btnBackToParams: document.getElementById('btn-back-to-params'),
        btnStartOver: document.getElementById('btn-start-over'),

        // Mode selection
        modeCards: document.querySelectorAll('.mode-card'),

        // Parameters
        roofArea: document.getElementById('roof-area'),
        dailyUsage: document.getElementById('daily-usage'),
        presetBtns: document.querySelectorAll('.preset-btn'),
        confidenceGroup: document.getElementById('confidence-group'),
        confidenceSlider: document.getElementById('confidence'),
        confidenceValue: document.getElementById('confidence-value'),
        waterRateGroup: document.getElementById('water-rate-group'),
        waterRate: document.getElementById('water-rate'),

        // Results - Security
        securityResults: document.getElementById('security-results'),
        recommendedTank: document.getElementById('recommended-tank'),
        confidenceStatement: document.getElementById('confidence-statement'),
        reliabilityStat: document.getElementById('reliability-stat'),
        reliabilityDetail: document.getElementById('reliability-detail'),
        stressStat: document.getElementById('stress-stat'),
        stressDetail: document.getElementById('stress-detail'),
        failureTableBody: document.getElementById('failure-table-body'),
        drySpellCard: document.getElementById('dry-spell-card'),

        // Results - Opportunistic
        opportunisticResults: document.getElementById('opportunistic-results'),
        bestValueTank: document.getElementById('best-value-tank'),
        bestValueSubtitle: document.getElementById('best-value-subtitle'),
        roofPotential: document.getElementById('roof-potential'),
        roofPotentialDetail: document.getElementById('roof-potential-detail'),
        waterCost: document.getElementById('water-cost'),
        waterCostDetail: document.getElementById('water-cost-detail'),
        comparisonTableBody: document.getElementById('comparison-table-body')
    };
}

/**
 * Bind event listeners
 */
function bindEvents() {
    // File upload
    elements.uploadZone.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    elements.uploadZone.addEventListener('dragover', handleDragOver);
    elements.uploadZone.addEventListener('dragleave', handleDragLeave);
    elements.uploadZone.addEventListener('drop', handleDrop);

    // Navigation
    elements.btnToMode.addEventListener('click', () => showStep('mode'));
    elements.btnBackToUpload.addEventListener('click', () => showStep('upload'));
    elements.btnToParams.addEventListener('click', () => showStep('params'));
    elements.btnBackToMode.addEventListener('click', () => showStep('mode'));
    elements.btnCalculate.addEventListener('click', runCalculation);
    elements.btnBackToParams.addEventListener('click', () => showStep('params'));
    elements.btnStartOver.addEventListener('click', resetApp);

    // Mode selection
    elements.modeCards.forEach(card => {
        card.addEventListener('click', () => selectMode(card.dataset.mode));
    });

    // Parameter inputs
    elements.roofArea.addEventListener('input', updateParams);
    elements.dailyUsage.addEventListener('input', updateParams);
    elements.confidenceSlider.addEventListener('input', updateConfidenceDisplay);
    elements.waterRate.addEventListener('input', updateParams);

    // Usage presets
    elements.presetBtns.forEach(btn => {
        btn.addEventListener('click', () => selectUsagePreset(btn));
    });
}

/**
 * Show a wizard step
 */
function showStep(stepName) {
    state.currentStep = stepName;

    // Hide all steps
    Object.values(elements.steps).forEach(step => {
        step.hidden = true;
    });

    // Show target step
    elements.steps[stepName].hidden = false;

    // Update conditional UI
    if (stepName === 'params') {
        updateParamsVisibility();
    }
}

/**
 * Handle file selection
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processFile(file);
    }
}

/**
 * Handle drag over
 */
function handleDragOver(event) {
    event.preventDefault();
    elements.uploadZone.classList.add('drag-over');
}

/**
 * Handle drag leave
 */
function handleDragLeave(event) {
    event.preventDefault();
    elements.uploadZone.classList.remove('drag-over');
}

/**
 * Handle file drop
 */
function handleDrop(event) {
    event.preventDefault();
    elements.uploadZone.classList.remove('drag-over');

    const file = event.dataTransfer.files[0];
    if (file) {
        processFile(file);
    }
}

/**
 * Process uploaded file
 */
async function processFile(file) {
    // Show loading state
    elements.uploadStatus.hidden = false;
    elements.statusLoading.hidden = false;
    elements.statusSuccess.hidden = true;
    elements.statusError.hidden = true;
    elements.btnToMode.disabled = true;

    try {
        const text = await file.text();

        // Small delay to show loading state
        await new Promise(resolve => setTimeout(resolve, 100));

        const result = parseBoMCSV(text);

        if (result.success) {
            state.parseResult = result;
            state.rainfallData = result.data;

            // Show success
            elements.statusLoading.hidden = true;
            elements.statusSuccess.hidden = false;
            elements.dataSummary.textContent = generateDataSummary(result);
            elements.btnToMode.disabled = false;

            // Show warnings if any
            if (result.warnings.length > 0) {
                console.warn('CSV parsing warnings:', result.warnings);
            }
        } else {
            throw new Error(result.errors.join('. '));
        }
    } catch (error) {
        elements.statusLoading.hidden = true;
        elements.statusError.hidden = false;
        elements.errorMessage.textContent = error.message;
    }
}

/**
 * Select mode
 */
function selectMode(mode) {
    state.mode = mode;

    // Update UI
    elements.modeCards.forEach(card => {
        card.classList.toggle('selected', card.dataset.mode === mode);
    });

    elements.btnToParams.disabled = false;
}

/**
 * Update parameters visibility based on mode
 */
function updateParamsVisibility() {
    const isSecurityMode = state.mode === 'security';

    elements.confidenceGroup.hidden = !isSecurityMode;
    elements.waterRateGroup.hidden = isSecurityMode;
}

/**
 * Update params from inputs
 */
function updateParams() {
    state.params.roofArea_m2 = parseFloat(elements.roofArea.value) || DEFAULTS.roofArea_m2;
    state.params.dailyUsage_L = parseFloat(elements.dailyUsage.value) || DEFAULTS.dailyUsage_L;
    state.params.waterRate_perKL = parseFloat(elements.waterRate.value) || DEFAULTS.waterRate_perKL;
}

/**
 * Update confidence slider display
 */
function updateConfidenceDisplay() {
    const value = parseFloat(elements.confidenceSlider.value);
    state.params.confidenceLevel = value / 100;
    elements.confidenceValue.textContent = `${value}%`;
}

/**
 * Select usage preset
 */
function selectUsagePreset(btn) {
    const usage = parseInt(btn.dataset.usage, 10);
    elements.dailyUsage.value = usage;
    state.params.dailyUsage_L = usage;

    // Update active state
    elements.presetBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

/**
 * Run calculation and show results
 */
function runCalculation() {
    updateParams();

    if (state.mode === 'security') {
        runSecurityAnalysis();
    } else {
        runOpportunisticAnalysis();
    }

    showStep('results');
}

/**
 * Run security mode analysis
 */
function runSecurityAnalysis() {
    const results = analyzeSecurityMode(state.rainfallData, {
        roofArea_m2: state.params.roofArea_m2,
        dailyUsage_L: state.params.dailyUsage_L,
        confidenceLevel: state.params.confidenceLevel
    });

    state.results = results;

    // Show security results, hide opportunistic
    elements.securityResults.hidden = false;
    elements.opportunisticResults.hidden = true;

    // Populate hero
    elements.recommendedTank.textContent = formatTankSize(results.recommendedTankSize_L);
    elements.confidenceStatement.textContent = results.confidenceStatement;

    // Reliability card
    const reliability = results.actualReliability;
    elements.reliabilityStat.textContent = `${reliability.toFixed(1)}%`;
    const emptyDays = results.stressStatistics.totalDays - Math.round(results.stressStatistics.totalDays * reliability / 100);
    elements.reliabilityDetail.textContent = emptyDays === 0
        ? 'Tank never ran empty'
        : `${emptyDays} days would have run empty`;

    // Stress card
    const stressDays = results.stressStatistics.daysBelow20pct;
    const totalDays = results.stressStatistics.totalDays;
    const stressPercent = results.stressStatistics.percentageStressed;
    elements.stressStat.textContent = `${stressDays.toLocaleString()} days`;
    elements.stressDetail.textContent = `${stressPercent.toFixed(1)}% of days below 20% capacity`;

    // Failure table
    elements.failureTableBody.innerHTML = '';
    results.smallerTankAnalysis.forEach(analysis => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="tank-size">${formatTankSize(analysis.tankSize_L)}</td>
            <td class="${analysis.totalFailures === 0 ? 'no-failures' : 'failure-desc'}">
                ${analysis.description}
            </td>
        `;
        elements.failureTableBody.appendChild(row);
    });

    // Dry spell card
    const drySpell = analyzeDrySpell(
        results.worstDrySpell,
        results.recommendedTankSize_L,
        results.simulation
    );

    elements.drySpellCard.innerHTML = `
        <p class="dry-spell-dates">${drySpell.dateRange}</p>
        <div class="dry-spell-stats">
            <span class="dry-spell-stat">
                <strong>${drySpell.duration}</strong> days
            </span>
            <span class="dry-spell-stat">
                <strong>${drySpell.totalRainfall.toFixed(1)}mm</strong> total rain
            </span>
            <span class="dry-spell-stat">
                ${drySpell.tankImpact}
            </span>
        </div>
    `;
}

/**
 * Run opportunistic mode analysis
 */
function runOpportunisticAnalysis() {
    const results = analyzeOpportunisticMode(state.rainfallData, {
        roofArea_m2: state.params.roofArea_m2,
        dailyUsage_L: state.params.dailyUsage_L,
        waterRate_perKL: state.params.waterRate_perKL
    });

    state.results = results;

    // Show opportunistic results, hide security
    elements.securityResults.hidden = true;
    elements.opportunisticResults.hidden = false;

    // Best value hero
    const bestValue = results.comparisons[results.bestValueIndex];
    elements.bestValueTank.textContent = formatTankSize(bestValue.tankSize_L);
    elements.bestValueSubtitle.textContent =
        `Offsets ${bestValue.percentOffset.toFixed(0)}% of mains water • Saves ${formatCurrency(bestValue.annualSavings)}/year`;

    // Roof potential card
    elements.roofPotential.textContent = `${formatNumber(results.roofPotential.annual_kL, 1)} kL/year`;
    elements.roofPotentialDetail.textContent =
        `Your roof could capture ${formatCurrency(results.roofPotential.annualValue)}/year worth of water`;

    // Water cost card
    elements.waterCost.textContent = `${formatCurrency(results.waterCost.annualCost)}/year`;
    elements.waterCostDetail.textContent =
        `Based on ${formatNumber(results.waterCost.annualDemand_kL, 1)} kL/year at ${formatCurrency(results.waterCost.ratePerKL, 2)}/kL`;

    // Comparison table
    elements.comparisonTableBody.innerHTML = '';
    results.comparisons.forEach((comparison, index) => {
        const isBest = index === results.bestValueIndex;
        const row = document.createElement('tr');
        if (isBest) {
            row.classList.add('best-value');
        }

        row.innerHTML = `
            <td class="tank-size">
                ${formatTankSize(comparison.tankSize_L)}
                ${isBest ? '<span class="best-badge">Best Value</span>' : ''}
            </td>
            <td>${comparison.percentOffset.toFixed(0)}%</td>
            <td class="savings">${formatCurrency(comparison.annualSavings)}/yr</td>
            <td>
                <div class="efficiency-bar">
                    <div class="efficiency-track">
                        <div class="efficiency-fill" style="width: ${comparison.captureEfficiency}%"></div>
                    </div>
                    <span class="efficiency-value">${comparison.captureEfficiency.toFixed(0)}%</span>
                </div>
            </td>
        `;
        elements.comparisonTableBody.appendChild(row);
    });
}

/**
 * Reset app to initial state
 */
function resetApp() {
    state.currentStep = 'upload';
    state.rainfallData = null;
    state.parseResult = null;
    state.mode = null;
    state.results = null;

    // Reset UI
    elements.fileInput.value = '';
    elements.uploadStatus.hidden = true;
    elements.btnToMode.disabled = true;
    elements.btnToParams.disabled = true;

    // Clear mode selection
    elements.modeCards.forEach(card => card.classList.remove('selected'));

    // Reset params to defaults
    elements.roofArea.value = DEFAULTS.roofArea_m2;
    elements.dailyUsage.value = DEFAULTS.dailyUsage_L;
    elements.confidenceSlider.value = DEFAULTS.securityConfidence * 100;
    elements.confidenceValue.textContent = `${DEFAULTS.securityConfidence * 100}%`;
    elements.waterRate.value = DEFAULTS.waterRate_perKL;

    // Reset preset buttons
    elements.presetBtns.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.usage, 10) === DEFAULTS.dailyUsage_L);
    });

    showStep('upload');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
