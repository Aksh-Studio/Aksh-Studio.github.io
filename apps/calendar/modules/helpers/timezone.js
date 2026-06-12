// timezone.js

/**
 * Gets the user's current local timezone string (e.g., "Asia/Kolkata" or "America/New_York")
 */
export function getLocalTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Converts a standard date string into a specific timezone's formatted time.
 * @param {Date|String} date - The date to convert
 * @param {String} targetTimezone - The timezone to convert to
 * @returns {String} Formatted time string
 */
export function convertToTimezone(date, targetTimezone) {
    const dateObj = new Date(date);
    return new Intl.DateTimeFormat('en-US', {
        timeStyle: 'short',
        timeZone: targetTimezone,
    }).format(dateObj);
}

/**
 * Calculates the hour offset between two timezones (useful for rendering dual-timezone UI grids).
 */
export function getTimezoneOffsetHours(tz1, tz2) {
    const now = new Date();
    
    // Get formatted time strings for both timezones
    const str1 = now.toLocaleString('en-US', { timeZone: tz1, hourCycle: 'h23' });
    const str2 = now.toLocaleString('en-US', { timeZone: tz2, hourCycle: 'h23' });
    
    const hour1 = parseInt(str1.split(', ')[1].split(':')[0], 10);
    const hour2 = parseInt(str2.split(', ')[1].split(':')[0], 10);
    
    let diff = hour1 - hour2;
    
    // Handle midnight wrap-arounds
    if (diff > 12) diff -= 24;
    else if (diff < -12) diff += 24;
    
    return diff;
}
