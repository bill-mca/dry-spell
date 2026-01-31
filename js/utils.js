/**
 * Utility functions for formatting and calculations
 */

/**
 * Format a number with thousands separators
 * @param {number} num - The number to format
 * @param {number} decimals - Number of decimal places (default 0)
 * @returns {string} Formatted number string
 */
export function formatNumber(num, decimals = 0) {
    if (num === null || num === undefined || isNaN(num)) {
        return '—';
    }
    return num.toLocaleString('en-AU', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Format litres with appropriate unit (L or kL)
 * @param {number} litres - Volume in litres
 * @param {boolean} forceKL - Always use kilolitres
 * @returns {string} Formatted volume string
 */
export function formatLitres(litres, forceKL = false) {
    if (litres === null || litres === undefined || isNaN(litres)) {
        return '—';
    }
    if (forceKL || litres >= 10000) {
        return `${formatNumber(litres / 1000, 1)} kL`;
    }
    return `${formatNumber(litres)} L`;
}

/**
 * Format currency (AUD)
 * @param {number} amount - Dollar amount
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, decimals = 0) {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return '—';
    }
    return '$' + formatNumber(amount, decimals);
}

/**
 * Format percentage
 * @param {number} value - Decimal value (0.95 = 95%)
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export function formatPercent(value, decimals = 1) {
    if (value === null || value === undefined || isNaN(value)) {
        return '—';
    }
    return `${formatNumber(value * 100, decimals)}%`;
}

/**
 * Format a date object to a readable string
 * @param {Date} date - The date to format
 * @param {string} format - 'short', 'medium', or 'long'
 * @returns {string} Formatted date string
 */
export function formatDate(date, format = 'medium') {
    if (!date || !(date instanceof Date) || isNaN(date)) {
        return '—';
    }

    const options = {
        short: { month: 'short', year: 'numeric' },
        medium: { day: 'numeric', month: 'short', year: 'numeric' },
        long: { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }
    };

    return date.toLocaleDateString('en-AU', options[format] || options.medium);
}

/**
 * Format a date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {string} Formatted date range string
 */
export function formatDateRange(startDate, endDate) {
    if (!startDate || !endDate) {
        return '—';
    }
    return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

/**
 * Format tank size for display (e.g., "10,000 L" or "10 kL")
 * @param {number} litres - Tank size in litres
 * @returns {string} Formatted tank size
 */
export function formatTankSize(litres) {
    if (litres >= 1000) {
        // Show as kL for cleaner display
        const kl = litres / 1000;
        if (kl === Math.floor(kl)) {
            return `${formatNumber(kl)} kL`;
        }
        return `${formatNumber(kl, 1)} kL`;
    }
    return `${formatNumber(litres)} L`;
}

/**
 * Format days count with singular/plural
 * @param {number} days - Number of days
 * @returns {string} Formatted string
 */
export function formatDays(days) {
    if (days === null || days === undefined || isNaN(days)) {
        return '—';
    }
    return days === 1 ? '1 day' : `${formatNumber(days)} days`;
}

/**
 * Format years for display
 * @param {number[]} years - Array of years
 * @param {number} maxShow - Maximum years to show before truncating
 * @returns {string} Formatted years string
 */
export function formatYears(years, maxShow = 4) {
    if (!years || years.length === 0) {
        return 'Never';
    }
    if (years.length <= maxShow) {
        return years.join(', ');
    }
    const shown = years.slice(0, maxShow - 1);
    const remaining = years.length - (maxShow - 1);
    return `${shown.join(', ')} +${remaining} more`;
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Calculate the number of years spanned by a date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} Number of years (can be fractional)
 */
export function yearsBetween(startDate, endDate) {
    const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
    return (endDate - startDate) / msPerYear;
}

/**
 * Group items by a key function
 * @param {Array} items - Array of items
 * @param {Function} keyFn - Function to extract key from item
 * @returns {Map} Map of key to array of items
 */
export function groupBy(items, keyFn) {
    const groups = new Map();
    for (const item of items) {
        const key = keyFn(item);
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(item);
    }
    return groups;
}
