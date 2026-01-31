# Dry Spell - Implementation Backlog

## Phase 1: Foundation

### 1.1 Project Setup
- [ ] Create `index.html` with basic structure
  - Header with title and tagline
  - Main wizard container
  - Footer with privacy message
  - Link to CSS and JS modules
- [ ] Create `css/main.css`
  - CSS custom properties for theming
  - Wide layout (max-width 1200px)
  - Mobile-first responsive breakpoints (600px, 900px)
  - Base typography and spacing

### 1.2 CSV Parser
- [ ] Create `js/csv-parser.js`
  - `parseBoMCSV(csvText)` - main parsing function
  - `validateBoMFormat(headerRow)` - format validation
  - Handle both `\r\n` and `\n` line endings
  - Parse columns: year, month, day, rainfall_mm, quality
  - Handle empty rainfall values (missing data, not zero)
  - Return structured result with metadata (station, date range, missing days)
- [ ] Error handling for invalid files
  - Non-CSV files
  - Wrong CSV format
  - No valid data rows

### 1.3 File Upload UI
- [ ] Create `css/wizard.css` for wizard step styling
- [ ] Create `css/inputs.css` for form controls
- [ ] Implement file upload step
  - Drag-and-drop zone with visual feedback
  - File input button fallback
  - Loading spinner during parse
  - Data summary display after successful upload
    - "Loaded 6,606 days of rainfall data (Jan 2008 - Jan 2026)"
    - "Station: 070351"
    - "Missing data: 47 days (0.7%)"
  - Clear error messages for invalid files

**Milestone: File upload and parsing working**

---

## Phase 2: Water Balance Engine

### 2.1 Core Simulation
- [ ] Create `js/water-balance.js`
  - `runWaterBalance(config)` - main simulation function
  - Config: rainfallData, tankSize_L, roofArea_m2, dailyUsage_L, runoffCoefficient
  - Daily calculation loop:
    - inflow = rainfall × roof × coefficient
    - newLevel = previous + inflow - usage
    - overflow = max(0, newLevel - tankSize)
    - deficit = max(0, -newLevel)
    - finalLevel = clamp(0, tankSize)
  - Return daily levels array and summary statistics
  - Track empty periods and stress periods

### 2.2 Mode Selection UI
- [ ] Implement mode selection step
  - Two prominent cards: Security / Opportunistic
  - Clear descriptions of each mode's purpose
  - Selection stored in app state

### 2.3 Parameters UI
- [ ] Create `js/app.js` for state management
- [ ] Implement parameters step (common inputs)
  - Roof catchment area (m²) with helper text
  - Daily water usage (L) with preset dropdown
    - Outdoor only (150L)
    - Small household (350L)
    - Average household (500L)
    - Large household (800L)
- [ ] Conditional inputs based on mode
  - Security: Confidence slider (90% - 99.9%)
  - Opportunistic: Water rate ($/kL) with default

**Milestone: Simulation running with inputs**

---

## Phase 3: Security Mode

### 3.1 Security Calculations
- [ ] Create `js/security-mode.js`
  - `analyzeSecurityMode(rainfallData, params)` - main analysis
  - `findMinimumTankForConfidence(data, params, targetConfidence)` - binary search
  - Search range: 1,000L to 100,000L (500L steps)
  - For each candidate size, run simulation and check failure rate
  - Find minimum tank where (1 - failureRate) >= confidenceLevel
  - Track failure events with dates and durations
  - Calculate stress statistics (days below 20%, 50%)
  - Identify worst dry spell in data

### 3.2 Security Results UI
- [ ] Create `css/results.css` for output styling
- [ ] Implement security results display
  - Prominent recommended tank size
  - Confidence statement
  - Historical failure table (smaller tank sizes)
    - "10,000L: Empty once - Feb 2019 (3 days)"
    - "5,000L: Empty 4 times - 2016, 2018, 2019, 2022"
  - Water stress statistics card
    - "127/6,606 days (1.9%) below 20% capacity"
  - Worst dry spell card
    - Date range, duration, minimum tank level reached

**Milestone: Security mode complete**

---

## Phase 4: Opportunistic Mode

### 4.1 Opportunistic Calculations
- [ ] Create `js/opportunistic-mode.js`
  - `analyzeOpportunisticMode(rainfallData, params)` - main analysis
  - Run simulation for each tank size: 2k, 5k, 10k, 15k, 20k, 25kL
  - For each size calculate:
    - Total rainwater used (L)
    - Total mains water needed (L)
    - Percentage offset
    - Annual savings ($)
    - Overflow lost (L and %)
  - Identify "best value" tank (good offset, minimal overflow)
  - Calculate total roof capture potential

### 4.2 Opportunistic Results UI
- [ ] Implement opportunistic results display
  - Comparison table with all tank sizes
    - Size | % Offset | Annual Savings | Overflow Lost | Efficiency bar
  - "Best value" indicator on recommended row
  - Roof potential summary card
    - "Your roof captures ~640 kL/year (worth ~$2,240)"
  - Current water cost context

**Milestone: Opportunistic mode complete (Full MVP)**

---

## Phase 5: Polish

### 5.1 Wizard Flow
- [ ] Create `js/ui-controller.js`
  - WizardController class
  - Step management (upload → mode → params → results)
  - Navigation (next/back buttons)
  - Step validation before proceeding
  - Progress indicator

### 5.2 Utilities
- [ ] Create `js/utils.js`
  - Number formatters (commas, decimals)
  - Date formatters
  - Currency formatter
  - Percentage formatter

### 5.3 Responsive Design
- [ ] Test and refine mobile layout
  - Stack cards on mobile
  - Readable table on small screens
  - Touch-friendly inputs

### 5.4 Error Handling
- [ ] Insufficient data warning (< 1 year)
- [ ] High missing data warning (> 10%)
- [ ] Impossible scenario handling (usage > capture)
- [ ] Helpful error messages with suggestions

### 5.5 Final Polish
- [ ] Cross-browser testing
- [ ] Accessibility review (labels, focus states)
- [ ] Performance check with large datasets

**Milestone: Production ready**

---

## Future Pathways (Out of Scope for MVP)

### Monte Carlo Mode
- [ ] Pre-built Australian climate zone profiles
- [ ] Statistical distribution fitting (gamma/log-normal)
- [ ] Synthetic rainfall generation (1,000+ scenarios)
- [ ] Confidence interval reporting
- [ ] Climate zone selector dropdown

### Visualizations
- [ ] Tank level over time chart (Chart.js or D3)
- [ ] Monthly rainfall pattern bar chart
- [ ] Dry spell histogram

### Household Calculator
- [ ] Number of occupants input
- [ ] Fixtures connected checklist
- [ ] Automatic daily usage calculation

### Financial Analysis
- [ ] Tank cost database by size
- [ ] Installation cost estimates
- [ ] Payback period calculation
- [ ] NPV analysis with discount rate

---

## Technical Notes

### BoM CSV Format
```
Product code,Bureau of Meteorology station number,Year,Month,Day,Rainfall amount (millimetres),Period over which rainfall was measured (days),Quality
IDCJAC0009,070351,2016,03,18,7.4,1,N
```

### Key Constants
```javascript
const DEFAULTS = {
    roofArea_m2: 180,
    dailyUsage_L: 500,
    waterRate_perKL: 3.50,
    runoffCoefficient: 0.85,
    securityConfidence: 0.95
};

const TANK_SIZES = [2000, 5000, 10000, 15000, 20000, 25000];
```

### Water Balance Formula
```
inflow_L = rainfall_mm × roofArea_m² × runoffCoefficient
1mm on 1m² = 1 litre
```
