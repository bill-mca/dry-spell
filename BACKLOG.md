# Dry Spell - Implementation Backlog

## Phase 1: Foundation ✅

### 1.1 Project Setup
- [x] Create `index.html` with basic structure
  - Header with title and tagline
  - Main wizard container
  - Footer with privacy message
  - Link to CSS and JS modules
- [x] Create `css/main.css`
  - CSS custom properties for theming
  - Wide layout (max-width 1200px)
  - Mobile-first responsive breakpoints (600px, 900px)
  - Base typography and spacing

### 1.2 CSV Parser
- [x] Create `js/csv-parser.js`
  - `parseBoMCSV(csvText)` - main parsing function
  - `validateBoMFormat(headerRow)` - format validation
  - Handle both `\r\n` and `\n` line endings
  - Parse columns: year, month, day, rainfall_mm, quality
  - Handle empty rainfall values (missing data, not zero)
  - Return structured result with metadata (station, date range, missing days)
- [x] Error handling for invalid files
  - Non-CSV files
  - Wrong CSV format
  - No valid data rows

### 1.3 File Upload UI
- [x] Create `css/wizard.css` for wizard step styling
- [x] Create `css/inputs.css` for form controls
- [x] Implement file upload step
  - Drag-and-drop zone with visual feedback
  - File input button fallback
  - Loading spinner during parse
  - Data summary display after successful upload
    - "Loaded 6,606 days of rainfall data (Jan 2008 - Jan 2026)"
    - "Station: 070351"
    - "Missing data: 47 days (0.7%)"
  - Clear error messages for invalid files

**Milestone: File upload and parsing working** ✅

---

## Phase 2: Water Balance Engine ✅

### 2.1 Core Simulation
- [x] Create `js/water-balance.js`
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
- [x] Implement mode selection step
  - Two prominent cards: Security / Opportunistic
  - Clear descriptions of each mode's purpose
  - Selection stored in app state

### 2.3 Parameters UI
- [x] Create `js/app.js` for state management
- [x] Implement parameters step (common inputs)
  - Roof catchment area (m²) with helper text
  - Daily water usage (L) with preset dropdown
    - Outdoor only (150L)
    - Small household (350L)
    - Average household (500L)
    - Large household (800L)
- [x] Conditional inputs based on mode
  - Security: Confidence slider (90% - 99.9%)
  - Opportunistic: Water rate ($/kL) with default

**Milestone: Simulation running with inputs** ✅

---

## Phase 3: Security Mode ✅

### 3.1 Security Calculations
- [x] Create `js/security-mode.js`
  - `analyzeSecurityMode(rainfallData, params)` - main analysis
  - `findMinimumTankForConfidence(data, params, targetConfidence)` - binary search
  - Search range: 1,000L to 100,000L (500L steps)
  - For each candidate size, run simulation and check failure rate
  - Find minimum tank where (1 - failureRate) >= confidenceLevel
  - Track failure events with dates and durations
  - Calculate stress statistics (days below 20%, 50%)
  - Identify worst dry spell in data

### 3.2 Security Results UI
- [x] Create `css/results.css` for output styling
- [x] Implement security results display
  - Prominent recommended tank size
  - Confidence statement
  - Historical failure table (smaller tank sizes)
    - "10,000L: Empty once - Feb 2019 (3 days)"
    - "5,000L: Empty 4 times - 2016, 2018, 2019, 2022"
  - Water stress statistics card
    - "127/6,606 days (1.9%) below 20% capacity"
  - Worst dry spell card
    - Date range, duration, minimum tank level reached

**Milestone: Security mode complete** ✅

---

## Phase 4: Opportunistic Mode ✅

### 4.1 Opportunistic Calculations
- [x] Create `js/opportunistic-mode.js`
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
- [x] Implement opportunistic results display
  - Comparison table with all tank sizes
    - Size | % Offset | Annual Savings | Overflow Lost | Efficiency bar
  - "Best value" indicator on recommended row
  - Roof potential summary card
    - "Your roof captures ~640 kL/year (worth ~$2,240)"
  - Current water cost context

**Milestone: Opportunistic mode complete (Full MVP)** ✅

---

## Phase 5: Polish ✅

### 5.1 Wizard Flow
- [x] Create `js/ui-controller.js`
  - WizardController class
  - Step management (upload → mode → params → results)
  - Navigation (next/back buttons)
  - Step validation before proceeding
  - Progress indicator

### 5.2 Utilities
- [x] Create `js/utils.js`
  - Number formatters (commas, decimals)
  - Date formatters
  - Currency formatter
  - Percentage formatter

### 5.3 Responsive Design
- [x] Test and refine mobile layout
  - Stack cards on mobile
  - Readable table on small screens
  - Touch-friendly inputs

### 5.4 Error Handling
- [x] Insufficient data warning (< 1 year)
- [x] High missing data warning (> 10%)
- [x] Impossible scenario handling (usage > capture)
- [x] Helpful error messages with suggestions

### 5.5 Final Polish
- [x] Cross-browser testing
- [x] Accessibility review (labels, focus states)
- [x] Performance check with large datasets

**Milestone: Production ready** ✅

---

## Phase 6: Visualizations

### 6.1 Charting Library Setup
- [ ] Evaluate and select charting library
  - Option A: Chart.js (simpler, good for basic charts, smaller bundle)
  - Option B: D3.js (more powerful, full control, steeper learning curve)
  - Recommendation: Start with Chart.js for faster implementation
- [ ] Add library to project
  - CDN link in `index.html` OR
  - ES module import if using npm/bundler
- [ ] Create `css/charts.css` for visualization styling
  - Chart container sizing and responsive behavior
  - Legend styling
  - Tooltip customization
  - Color palette variables matching app theme

### 6.2 Tank Level Over Time Chart

**Purpose**: Show how the tank level fluctuates over the historical period for the recommended/selected tank size

- [ ] Create `js/visualizations/tank-level-chart.js`
  - `createTankLevelChart(canvasElement, simulationData, tankSize_L)` - main function
  - Data preparation:
    - X-axis: Date (daily data points)
    - Y-axis: Tank level in litres (0 to tankSize_L)
    - Consider data decimation for long time series (>5 years)
      - Show daily data for <1 year
      - Weekly averages for 1-5 years
      - Monthly averages for >5 years
  - Chart configuration:
    - Line chart with area fill
    - Color gradient: red (empty) → yellow (50%) → green (full)
    - Horizontal reference lines at 25%, 50%, 75% capacity
    - Highlight empty periods (level = 0) with distinct color/pattern
    - Responsive width, fixed height (~400px)
  - Interactive features:
    - Tooltip showing date, level (L), percentage full
    - Pan/zoom for long time series (if using Chart.js zoom plugin)
    - Optional: Toggle showing rainfall bars as overlay

- [ ] Add UI integration
  - Add chart container to security mode results
  - Add chart container to opportunistic mode results
  - "Show tank level history" expandable section
  - Loading indicator while rendering chart
  - Handle missing data gracefully (gaps in line)

- [ ] Responsive design
  - Full width on mobile, constrained on desktop
  - Readable axis labels at all sizes
  - Adjust decimation based on screen width

### 6.3 Monthly Rainfall Pattern Bar Chart

**Purpose**: Show the seasonal rainfall patterns in the uploaded data to help users understand dry/wet seasons

- [ ] Create `js/visualizations/monthly-rainfall-chart.js`
  - `createMonthlyRainfallChart(canvasElement, rainfallData)` - main function
  - Data preparation:
    - Aggregate rainfall by month across all years
    - Calculate for each month (Jan-Dec):
      - Average monthly total (mm)
      - Min monthly total across all years
      - Max monthly total across all years
      - Number of years of data
  - Chart configuration:
    - Vertical bar chart, 12 bars (one per month)
    - X-axis: Month names (Jan, Feb, Mar...)
    - Y-axis: Rainfall (mm)
    - Bar color: gradient from brown (dry) to blue (wet)
    - Error bars or range indicators (min/max)
    - Average line overlay
  - Interactive features:
    - Tooltip showing month, avg/min/max values
    - Number of years of data in subtitle

- [ ] Add UI integration
  - Add to data upload summary section
  - "View rainfall patterns" expandable card
  - Display after successful CSV parse
  - Show alongside station metadata

- [ ] Insights annotation
  - Automatically identify driest month(s)
  - Automatically identify wettest month(s)
  - Display insight text below chart
    - "Driest period: May-Aug (avg 45mm/month)"
    - "Wettest period: Jan-Feb (avg 180mm/month)"

### 6.4 Dry Spell Histogram

**Purpose**: Show the distribution of dry spell lengths to help users understand drought risk

- [ ] Create `js/visualizations/dry-spell-chart.js`
  - `createDrySpellHistogram(canvasElement, rainfallData, threshold_mm)` - main function
  - Data preparation:
    - Define "dry day" threshold (default: <1mm rainfall, configurable)
    - Identify all dry spell periods (consecutive dry days)
    - Create histogram bins:
      - 1-3 days, 4-7 days, 8-14 days, 15-30 days, 31-60 days, 60+ days
    - Count number of dry spells in each bin
    - Track longest dry spell (date range, duration)
  - Chart configuration:
    - Horizontal bar chart (bins on Y-axis, count on X-axis) OR
    - Vertical bar chart (bins on X-axis, count on Y-axis)
    - Color intensity based on severity (light yellow → dark red)
    - Annotate longest spell bar with date/duration
  - Interactive features:
    - Tooltip showing bin range, count, example dates
    - Click to see list of all spells in that bin (optional)

- [ ] Add UI integration
  - Add to security mode results (highly relevant)
  - Add to data upload summary (general interest)
  - "View dry spell analysis" expandable section
  - Show context: "Based on N years of data (YYYY-YYYY)"

- [ ] Additional statistics panel
  - Display alongside chart:
    - Total number of dry spells
    - Longest dry spell: "87 days (May-Aug 2019)"
    - Average dry spell duration
    - Percentage of days in dry spells

### 6.5 Chart Integration & UX Polish

- [ ] Results page layout updates
  - Add "Visualizations" section/tab to results page
  - Organize charts logically:
    - Security mode: Tank level chart + Dry spell histogram
    - Opportunistic mode: Tank level chart + Monthly rainfall
    - Data summary: Monthly rainfall + Dry spell histogram
  - Lazy-load charts (only render when section is visible)
  - Add print-friendly styles (charts render well on paper)

- [ ] Export functionality (optional enhancement)
  - "Download chart as PNG" button for each visualization
  - "Download all charts" bulk export
  - Use Chart.js `.toBase64Image()` or similar

- [ ] Accessibility
  - Add ARIA labels to chart containers
  - Provide text summary of key insights for screen readers
  - Ensure charts have sufficient color contrast
  - Keyboard navigation for interactive features

- [ ] Performance optimization
  - Data decimation for very large datasets (>10 years)
  - Debounce window resize events
  - Use requestAnimationFrame for smooth animations
  - Consider Web Worker for heavy data processing

- [ ] Documentation
  - Add help tooltips explaining what each chart shows
  - Add examples to README with screenshots
  - Document how to interpret each visualization

**Milestone: Visualizations complete**

---

## Future Pathways (Beyond Visualizations)

### Monte Carlo Mode
- [ ] Pre-built Australian climate zone profiles
- [ ] Statistical distribution fitting (gamma/log-normal)
- [ ] Synthetic rainfall generation (1,000+ scenarios)
- [ ] Confidence interval reporting
- [ ] Climate zone selector dropdown

### Household Calculator
- [ ] Number of occupants input
- [ ] Fixtures connected checklist (toilets, washing machine, garden irrigation, etc.)
- [ ] Automatic daily usage calculation based on fixtures
- [ ] Seasonal variation in usage patterns

### Advanced Visualizations
- [ ] Interactive map of BoM stations (select location visually)
- [ ] Heatmap calendar view of rainfall (GitHub-style)
- [ ] 3D rainfall surface plot by year/month
- [ ] Comparative analysis (overlay multiple stations)

### Economic Analysis
- [ ] Tank purchase cost input
- [ ] Installation cost estimation
- [ ] Payback period calculation
- [ ] NPV/IRR analysis with discount rates
- [ ] Comparison with other water-saving investments

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
