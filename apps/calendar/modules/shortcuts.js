// shortcuts.js

/**
 * Initializes global keyboard shortcuts for the Calendar app.
 * Automatically ignores keystrokes if the user is typing in an input field.
 */
export function initShortcuts() {
    window.addEventListener('keydown', (e) => {
        // 1. Check if the user is actively typing in an input field, textarea, or select dropdown
        const activeTag = document.activeElement.tagName.toLowerCase();
        const isTyping = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || document.activeElement.isContentEditable;

        // If they are typing, we ONLY want to listen for the "Escape" key to cancel out
        if (isTyping) {
            if (e.key === 'Escape') {
                document.activeElement.blur(); // Remove cursor from input
                
                // Close the modal if it's open
                const closeBtn = document.getElementById('btn-close-modal');
                if (closeBtn) closeBtn.click();
            }
            return; // Ignore all other shortcuts while typing
        }

        // 2. Ignore shortcuts if the user is holding Ctrl, Alt, or Command (Cmd)
        // so we don't accidentally override native browser shortcuts (like Ctrl+C, Ctrl+T)
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        // 3. Process the exact key pressed
        switch (e.key.toLowerCase()) {
            
            // --- View Switching ---
            case 'd': // 'D' for Day View
                clickElement('.view-btn[data-view="day"]');
                break;
            case 'w': // 'W' for Week View
                clickElement('.view-btn[data-view="week"]');
                break;
            case 'm': // 'M' for Month View
                clickElement('.view-btn[data-view="month"]');
                break;
            case 'y': // 'Y' for Year View
                clickElement('.view-btn[data-view="year"]');
                break;
            case 'a': // 'A' for Agenda/Schedule View
                clickElement('.view-btn[data-view="agenda"]');
                break;

            // --- Time Navigation ---
            case 't': // 'T' to snap back to Today
                clickElement('#btn-today');
                break;
            case 'p': // 'P' or Left Arrow for Previous
            case 'arrowleft':
                clickElement('#btn-main-prev');
                break;
            case 'n': // 'N' or Right Arrow for Next
            case 'arrowright':
                clickElement('#btn-main-next');
                break;

            // --- Actions ---
            case 'c': // 'C' to Create a new Event
                e.preventDefault(); // Prevent accidental typing
                clickElement('#btn-create-event');
                break;
            
            case '/': // '/' to instantly focus the AI Smart Planner text box
                e.preventDefault(); // Prevents the '/' character from actually typing in the box initially
                const aiInput = document.getElementById('ai-prompt-input');
                if (aiInput) aiInput.focus();
                break;

            case 'escape': // Close modals or sidebars
                clickElement('#btn-close-modal');
                break;
        }
    });
}

/**
 * Helper function to safely find and click a DOM element if it exists.
 * @param {String} selector - CSS Selector for the button
 */
function clickElement(selector) {
    const el = document.querySelector(selector);
    if (el) el.click();
}
