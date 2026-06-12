// eventModal.js
import { addEvent, updateEvent, deleteEvent } from '../db.js';
import { state, setEditingEvent } from '../state.js';

// DOM Elements
const modalOverlay = document.getElementById('modal-overlay');
const titleInput = document.getElementById('event-title');
const dateInput = document.getElementById('event-date');
const timeInput = document.getElementById('event-time');
const categorySelect = document.getElementById('event-category');
const descInput = document.getElementById('event-desc');
const btnDelete = document.getElementById('btn-delete-event');

export function initEventModal() {
    // Attach UI Listeners
    document.getElementById('btn-create-event').addEventListener('click', () => openModal());
    document.getElementById('btn-close-modal').addEventListener('click', closeModal);
    document.getElementById('btn-save-event').addEventListener('click', handleSave);
    btnDelete.addEventListener('click', handleDelete);
}

export function openModal(eventId = null) {
    document.getElementById('modal-title-text').innerText = eventId ? "Edit Event" : "Create Event";
    setEditingEvent(eventId);

    if (eventId) {
        // Find existing event and populate fields
        const ev = state.events.find(e => e.id === eventId);
        if (ev) {
            titleInput.value = ev.title;
            dateInput.value = ev.date;
            timeInput.value = ev.time || "12:00";
            categorySelect.value = ev.category || "personal";
            descInput.value = ev.desc || "";
            btnDelete.style.display = 'block';
        }
    } else {
        // Clear fields for new event
        titleInput.value = "";
        dateInput.value = state.currentDate.toISOString().split('T')[0];
        timeInput.value = "12:00";
        descInput.value = "";
        btnDelete.style.display = 'none';
    }
    
    modalOverlay.style.display = 'flex';
}

export function closeModal() {
    modalOverlay.style.display = 'none';
    setEditingEvent(null);
}

async function handleSave() {
    const title = titleInput.value.trim();
    const date = dateInput.value;
    
    if (!title || !date) {
        alert("Event Title and Date are required!");
        return;
    }

    const eventData = {
        title: title,
        date: date,
        time: timeInput.value,
        category: categorySelect.value,
        desc: descInput.value,
        // Auto-generate a meeting link if it's a Work event
        meetLink: categorySelect.value === 'work' ? generateMeetLink() : null
    };

    try {
        if (state.editingEventId) {
            await updateEvent(state.editingEventId, eventData);
        } else {
            await addEvent(eventData);
        }
        closeModal();
    } catch (error) {
        console.error("Failed to save event:", error);
    }
}

async function handleDelete() {
    if (!state.editingEventId) return;
    if (confirm("Are you sure you want to delete this event?")) {
        await deleteEvent(state.editingEventId);
        closeModal();
    }
}

// Helper: Generates a random Meet-style string (e.g., abc-defg-hij)
function generateMeetLink() {
    const randomStr = () => Math.random().toString(36).substring(2, 5);
    return `meet.google.com/${randomStr()}-${randomStr()}-${randomStr()}`;
}
