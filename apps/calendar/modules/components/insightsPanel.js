// insightsPanel.js
import { state } from '../state.js';

/**
 * Calculates statistics for the current month being viewed.
 * Assumes default event duration is 1 hour if not specified.
 */
export function calculateTimeInsights() {
    const currentMonthStr = `${state.currentDate.getFullYear()}-${String(state.currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Filter events to only those in the currently viewed month
    const monthlyEvents = state.events.filter(e => e.date.startsWith(currentMonthStr));

    const stats = {
        totalEvents: monthlyEvents.length,
        workHours: 0,
        personalHours: 0,
        importantHours: 0
    };

    monthlyEvents.forEach(e => {
        // For baseline stats, we assume each event block takes 1 hour
        let duration = e.durationHours || 1; 
        
        if (e.category === 'work') stats.workHours += duration;
        else if (e.category === 'personal') stats.personalHours += duration;
        else if (e.category === 'important') stats.importantHours += duration;
    });

    return stats;
}

/**
 * Returns a summary string ready for UI display
 */
export function generateInsightsReport() {
    const stats = calculateTimeInsights();
    
    if (stats.totalEvents === 0) {
        return "No events scheduled this month.";
    }

    return `
        This month you have ${stats.totalEvents} total events.
        You are spending ${stats.workHours} hours on Work, 
        ${stats.personalHours} hours on Personal time, 
        and ${stats.importantHours} hours on Important tasks.
    `;
}
