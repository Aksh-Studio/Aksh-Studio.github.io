// appointmentSlots.js
import { state } from '../state.js';

/**
 * Generates a sharable booking link payload for a specific day.
 * @param {String} dateStr - The date to check (YYYY-MM-DD)
 * @returns {Array} List of available time slots
 */
export function getAvailableSlots(dateStr) {
    // Define standard working hours (e.g., 9 AM to 5 PM)
    const workStartHour = 9; 
    const workEndHour = 17;
    const allSlots = [];

    // Generate every hour slot
    for (let h = workStartHour; h < workEndHour; h++) {
        let timeString = `${String(h).padStart(2, '0')}:00`;
        allSlots.push(timeString);
    }

    // Find all existing events on this date
    const daysEvents = state.events.filter(e => e.date === dateStr);
    
    // Filter out slots that already have an event scheduled
    const freeSlots = allSlots.filter(slot => {
        // If an event's time perfectly matches this slot, it is taken.
        const isTaken = daysEvents.some(e => e.time === slot);
        return !isTaken;
    });

    return freeSlots;
}

/**
 * Books an appointment into an available slot.
 */
export async function bookSlot(dateStr, timeStr, guestName) {
    const available = getAvailableSlots(dateStr);
    
    if (!available.includes(timeStr)) {
        throw new Error("This time slot is no longer available.");
    }
    
    // If it's free, we would normally call addEvent from db.js here
    console.log(`Appointment booked for ${guestName} on ${dateStr} at ${timeStr}`);
}
