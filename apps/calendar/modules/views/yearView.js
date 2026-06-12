// yearView.js

export function renderYearView(container, currentDate, events, filters) {
    const year = currentDate.getFullYear();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    let html = `
        <div style="height: 100%; overflow-y: auto; padding-right: 10px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 25px;">
    `;

    for (let month = 0; month < 12; month++) {
        html += `
            <div style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 15px; box-shadow: var(--shadow-sm);">
                <h3 style="font-size: 16px; margin-bottom: 12px; color: var(--primary); font-weight: 600;">${monthNames[month]} ${year}</h3>
                <div style="display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 11px; color: var(--text-muted); font-weight: 600; margin-bottom: 8px;">
                    <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;">
        `;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Empty days
        for (let i = 0; i < firstDay; i++) {
            html += `<div></div>`;
        }

        // Real days
        for (let i = 1; i <= daysInMonth; i++) {
            let dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            let hasEvent = events.some(e => e.date === dateStr && filters[e.category]);

            html += `
                <div style="aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 12px; border-radius: 50%; color: var(--text-main); position: relative;">
                    ${i}
                    ${hasEvent ? `<div style="position: absolute; bottom: 2px; width: 4px; height: 4px; border-radius: 50%; background: var(--primary);"></div>` : ''}
                </div>
            `;
        }
        
        html += `</div></div>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;
}
