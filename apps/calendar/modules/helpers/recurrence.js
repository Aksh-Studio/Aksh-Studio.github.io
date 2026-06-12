// recurrence.js

/**
 * Generates an array of future dates based on a recurrence rule.
 * @param {String} startDateStr - The starting date (YYYY-MM-DD)
 * @param {String} rule - 'daily', 'weekly', 'monthly', or 'yearly'
 * @param {Number} occurrences - How many future dates to generate (default 10)
 * @returns {Array} Array of date strings (YYYY-MM-DD)
 */
export function generateRecurringDates(startDateStr, rule, occurrences = 10) {
    const dates = [];
    const baseDate = new Date(startDateStr);

    for (let i = 0; i < occurrences; i++) {
        const nextDate = new Date(baseDate);

        switch (rule) {
            case 'daily':
                nextDate.setDate(baseDate.getDate() + i);
                break;
            case 'weekly':
                nextDate.setDate(baseDate.getDate() + (i * 7));
                break;
            case 'monthly':
                nextDate.setMonth(baseDate.getMonth() + i);
                break;
            case 'yearly':
                nextDate.setFullYear(baseDate.getFullYear() + i);
                break;
            default:
                // If 'none' or invalid, just return the single start date
                return [startDateStr];
        }

        // Format back to YYYY-MM-DD safely
        const formattedDate = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
        dates.push(formattedDate);
    }

    return dates;
}
