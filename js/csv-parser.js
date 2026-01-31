/**
 * CSV Parser for Bureau of Meteorology daily rainfall data
 *
 * Expected format:
 * Product code,Bureau of Meteorology station number,Year,Month,Day,Rainfall amount (millimetres),Period over which rainfall was measured (days),Quality
 * IDCJAC0009,070351,2016,03,18,7.4,1,N
 */

/**
 * Parse a BoM rainfall CSV file
 * @param {string} csvText - Raw CSV text content
 * @returns {Object} Parsed result with data, metadata, and any errors
 */
export function parseBoMCSV(csvText) {
    const result = {
        success: false,
        data: [],
        metadata: {
            station: null,
            productCode: null,
            dateRange: { start: null, end: null },
            totalDays: 0,
            missingDays: 0,
            totalRainfall: 0
        },
        errors: [],
        warnings: []
    };

    if (!csvText || typeof csvText !== 'string') {
        result.errors.push('No file content provided');
        return result;
    }

    // Split into lines, handling both Windows and Unix line endings
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
        result.errors.push('File appears to be empty or has no data rows');
        return result;
    }

    // Validate header
    const header = lines[0];
    const headerValidation = validateBoMFormat(header);
    if (!headerValidation.valid) {
        result.errors.push(headerValidation.message);
        return result;
    }

    // Parse data rows
    const dataRows = [];
    let missingCount = 0;
    let totalRainfall = 0;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parsed = parseDataRow(line, i + 1);

        if (parsed.error) {
            // Skip rows with errors but continue processing
            result.warnings.push(`Row ${i + 1}: ${parsed.error}`);
            continue;
        }

        if (parsed.missing) {
            missingCount++;
        } else {
            totalRainfall += parsed.rainfall_mm;
        }

        // Store station info from first valid row
        if (!result.metadata.station && parsed.station) {
            result.metadata.station = parsed.station;
            result.metadata.productCode = parsed.productCode;
        }

        dataRows.push({
            date: parsed.date,
            rainfall_mm: parsed.rainfall_mm,
            missing: parsed.missing,
            quality: parsed.quality
        });
    }

    if (dataRows.length === 0) {
        result.errors.push('No valid data rows found in file');
        return result;
    }

    // Sort by date (defensive - BoM data should be chronological)
    dataRows.sort((a, b) => a.date - b.date);

    // Calculate metadata
    result.data = dataRows;
    result.metadata.totalDays = dataRows.length;
    result.metadata.missingDays = missingCount;
    result.metadata.totalRainfall = totalRainfall;
    result.metadata.dateRange.start = dataRows[0].date;
    result.metadata.dateRange.end = dataRows[dataRows.length - 1].date;

    // Check for minimum data requirements
    const yearsOfData = (result.metadata.dateRange.end - result.metadata.dateRange.start) / (365.25 * 24 * 60 * 60 * 1000);
    if (yearsOfData < 1) {
        result.warnings.push('Less than 1 year of data - results may not reflect seasonal variation');
    }

    const missingPercent = (missingCount / dataRows.length) * 100;
    if (missingPercent > 10) {
        result.warnings.push(`High amount of missing data (${missingPercent.toFixed(1)}%) - results may be less reliable`);
    }

    result.success = true;
    return result;
}

/**
 * Validate that the header row matches expected BoM format
 * @param {string} headerRow - The first line of the CSV
 * @returns {Object} Validation result with valid boolean and message
 */
export function validateBoMFormat(headerRow) {
    if (!headerRow) {
        return { valid: false, message: 'Missing header row' };
    }

    const header = headerRow.toLowerCase();

    // Check for key column indicators
    const requiredIndicators = [
        { pattern: /year/i, name: 'Year' },
        { pattern: /month/i, name: 'Month' },
        { pattern: /day/i, name: 'Day' },
        { pattern: /rainfall/i, name: 'Rainfall' }
    ];

    const missing = requiredIndicators.filter(ind => !ind.pattern.test(header));

    if (missing.length > 0) {
        return {
            valid: false,
            message: `File doesn't appear to be a BoM rainfall CSV. Missing columns: ${missing.map(m => m.name).join(', ')}`
        };
    }

    return { valid: true, message: 'Valid BoM format' };
}

/**
 * Parse a single data row from the CSV
 * @param {string} line - CSV line
 * @param {number} lineNumber - Line number for error reporting
 * @returns {Object} Parsed row data or error
 */
function parseDataRow(line, lineNumber) {
    const columns = parseCSVLine(line);

    // BoM format: ProductCode, StationNumber, Year, Month, Day, Rainfall, Period, Quality
    // Minimum 6 columns needed (some files may not have all columns)
    if (columns.length < 6) {
        return { error: `Expected at least 6 columns, got ${columns.length}` };
    }

    const productCode = columns[0].trim();
    const station = columns[1].trim();
    const year = parseInt(columns[2], 10);
    const month = parseInt(columns[3], 10);
    const day = parseInt(columns[4], 10);
    const rainfallStr = columns[5].trim();
    const quality = columns.length > 7 ? columns[7].trim() : '';

    // Validate date components
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
        return { error: 'Invalid date values' };
    }

    if (year < 1800 || year > 2100) {
        return { error: `Invalid year: ${year}` };
    }

    if (month < 1 || month > 12) {
        return { error: `Invalid month: ${month}` };
    }

    if (day < 1 || day > 31) {
        return { error: `Invalid day: ${day}` };
    }

    // Create date (months are 0-indexed in JavaScript)
    const date = new Date(year, month - 1, day);

    // Verify date is valid (catches things like Feb 30)
    if (date.getMonth() !== month - 1) {
        return { error: `Invalid date: ${year}-${month}-${day}` };
    }

    // Parse rainfall - empty means missing data
    const missing = rainfallStr === '' || rainfallStr.toLowerCase() === 'null';
    const rainfall_mm = missing ? 0 : parseFloat(rainfallStr);

    if (!missing && isNaN(rainfall_mm)) {
        return { error: `Invalid rainfall value: ${rainfallStr}` };
    }

    if (!missing && rainfall_mm < 0) {
        return { error: `Negative rainfall value: ${rainfall_mm}` };
    }

    return {
        productCode,
        station,
        date,
        rainfall_mm: missing ? 0 : rainfall_mm,
        missing,
        quality
    };
}

/**
 * Parse a CSV line handling quoted values
 * @param {string} line - CSV line
 * @returns {string[]} Array of column values
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    // Don't forget the last column
    result.push(current);

    return result;
}

/**
 * Generate a summary string for the parsed data
 * @param {Object} parseResult - Result from parseBoMCSV
 * @returns {string} Human-readable summary
 */
export function generateDataSummary(parseResult) {
    if (!parseResult.success) {
        return 'Unable to parse data';
    }

    const { metadata } = parseResult;
    const startDate = metadata.dateRange.start.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
    const endDate = metadata.dateRange.end.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
    const years = ((metadata.dateRange.end - metadata.dateRange.start) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1);

    let summary = `${metadata.totalDays.toLocaleString()} days of data (${startDate} – ${endDate}, ~${years} years)`;

    if (metadata.station) {
        summary += ` • Station: ${metadata.station}`;
    }

    if (metadata.missingDays > 0) {
        const missingPercent = ((metadata.missingDays / metadata.totalDays) * 100).toFixed(1);
        summary += ` • Missing: ${metadata.missingDays} days (${missingPercent}%)`;
    }

    return summary;
}
