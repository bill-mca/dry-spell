# Dry Spell

A client-side JavaScript webapp that helps users size water tanks using historical rainfall data from the Australian Bureau of Meteorology.

## Overview

Dry Spell runs water balance simulations on uploaded BoM rainfall data to help users make informed decisions about water tank purchases. All processing happens in-browser - your data never leaves your device.

## Two Modes

### Security Mode
For users seeking water independence - whether in remote areas, preparing for uncertain times, or wanting true independence from mains supply. This mode calculates the tank size needed for near-complete water security through extended dry periods.

**Outputs:**
- Recommended tank size for your chosen confidence level (90% - 99.9%)
- Historical failure analysis: "A 10,000L tank would have run empty once: Feb 2019 (3 days)"
- Water stress statistics: "127/6,606 days (1.9%) below 20% capacity"
- Worst dry spell analysis from the historical record

### Opportunistic Mode
For users with mains water who want to capture roof runoff to reduce bills and environmental impact. This mode finds the sweet spot between useful savings and reasonable tank size.

**Outputs:**
- Comparison table of different tank sizes (2,000L - 25,000L)
- Percentage of mains water offset by each size
- Annual dollar savings based on your water rate
- Overflow analysis showing diminishing returns of larger tanks

## How It Works

1. **Upload Data**: Provide a daily rainfall CSV from the Bureau of Meteorology
2. **Select Mode**: Choose Security or Opportunistic based on your goals
3. **Enter Parameters**: Roof catchment area, daily water usage, confidence level or water rate
4. **Get Results**: Receive concrete recommendations based on historical simulation

### Water Balance Calculation

For each day in the historical record:
```
inflow = rainfall_mm × roof_area_m² × 0.85 (runoff coefficient)
new_level = previous_level + inflow - daily_usage
overflow = max(0, new_level - tank_size)
deficit = max(0, -new_level)
```

## Getting BoM Rainfall Data

1. Visit the [Bureau of Meteorology Climate Data](http://www.bom.gov.au/climate/data/)
2. Select "Daily rainfall" and find a station near you
3. Download the CSV file (format: `IDCJAC0009_XXXXXX_1800_Data.csv`)
4. Upload to Dry Spell

## Default Values

| Input | Default | Notes |
|-------|---------|-------|
| Roof catchment area | 180 m² | Average Australian house |
| Daily water usage | 500 L | 4-person household |
| Water rate | $3.50/kL | Typical Australian rate |
| Runoff coefficient | 0.85 | Industry standard |
| Security confidence | 95% | Slider range: 90% - 99.9% |

## Technical Details

- **No build tools required** - Uses native ES6 modules
- **No server needed** - Runs entirely in browser
- **Privacy first** - Data never leaves your device
- **Mobile friendly** - Responsive layout up to 1200px wide

## Project Structure

```
dry-spell/
├── index.html                 # Single-page app entry
├── css/
│   ├── main.css              # Core layout, CSS variables
│   ├── wizard.css            # Wizard flow styling
│   ├── inputs.css            # Form controls, sliders
│   └── results.css           # Output cards, tables
├── js/
│   ├── app.js                # Main controller, state management
│   ├── csv-parser.js         # BoM CSV parsing and validation
│   ├── water-balance.js      # Core simulation engine
│   ├── security-mode.js      # Security mode calculations
│   ├── opportunistic-mode.js # Opportunistic mode calculations
│   ├── ui-controller.js      # DOM manipulation, wizard flow
│   └── utils.js              # Formatters, helpers
├── sample_data/              # Sample BoM rainfall data
├── BACKLOG.md                # Implementation backlog
└── README.md                 # This file
```

## Running Locally

Simply open `index.html` in a modern browser, or serve with any static file server:

```bash
# Python 3
python -m http.server 8000

# Node.js (with npx)
npx serve .
```

## Future Roadmap

- Monte Carlo simulation for locations without historical data
- Pre-built Australian climate zone profiles
- Tank level visualizations over time
- Household usage calculator
- Capital cost and payback analysis

## License

MIT

## Author

Bill McAlister (w.mcalister@gmx.com)
