// importExport.js

/**
 * Converts the current state array of events into a downloadable CSV file.
 * @param {Array} events - Array of event objects from Firestore
 */
export function exportEventsToCSV(events) {
    if (!events || events.length === 0) {
        alert("No events to export.");
        return;
    }

    // Define CSV Headers
    const headers = ["Title", "Date", "Time", "Category", "Description"];
    
    // Map event data to CSV rows
    const rows = events.map(e => {
        // Wrap strings in quotes to handle commas inside titles or descriptions
        const title = `"${(e.title || '').replace(/"/g, '""')}"`;
        const desc = `"${(e.desc || '').replace(/"/g, '""')}"`;
        return `${title},${e.date},${e.time || ''},${e.category || ''},${desc}`;
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    
    // Trigger the browser download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "my_calendar_backup.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Parses a raw CSV text string back into JavaScript objects for Firestore uploading.
 * @param {String} csvText - The raw text read from a .csv file
 * @returns {Array} Array of parsed event objects ready to be saved
 */
export function parseCSVToEvents(csvText) {
    const lines = csvText.split('\n');
    const newEvents = [];
    
    // Skip the header row, start at index 1
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Basic split by comma (Note: This is a simple parser. For production, 
        // a robust Regex is needed to handle commas inside quotes)
        const columns = line.split(',');

        if (columns.length >= 2) {
            newEvents.push({
                title: columns[0].replace(/(^"|"$)/g, ''), // Strip quotes
                date: columns[1],
                time: columns[2] || "12:00",
                category: columns[3] || "personal",
                desc: columns[4] ? columns[4].replace(/(^"|"$)/g, '') : ""
            });
        }
    }
    
    return newEvents;
}
