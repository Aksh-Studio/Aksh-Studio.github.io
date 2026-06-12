// 1. The Central Source of Truth
export const state = {
    currentDate: new Date(),
    currentView: 'month', // 'day', 'week', 'month'
    events: [],
    filters: {
        personal: true,
        work: true,
        important: true
    },
    editingEventId: null
};

// 2. Observer Pattern: UI components will 'subscribe' to state changes
const listeners = [];

export function subscribe(listenerCallback) {
    listeners.push(listenerCallback);
}

function notifyListeners() {
    listeners.forEach(listener => listener(state));
}

// 3. State Mutation Methods (Always triggers a UI update)
export function setEvents(newEvents) {
    state.events = newEvents;
    notifyListeners();
}

export function setDate(dateObj) {
    state.currentDate = new Date(dateObj);
    notifyListeners();
}

export function setView(viewType) {
    state.currentView = viewType;
    notifyListeners();
}

export function toggleFilter(category, isVisible) {
    state.filters[category] = isVisible;
    notifyListeners();
}

export function setEditingEvent(eventId) {
    state.editingEventId = eventId;
    notifyListeners();
}
