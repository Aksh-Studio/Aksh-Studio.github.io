// weekView.js

export function renderWeekView(container, currentDate, events, filters, onEventClick) {
    // Find the Sunday of the current week
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    let html = `
        <div style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
            <div style="display: grid; grid-template-columns: 60px repeat(7, 1fr); border-bottom: 1px solid var(--border); padding-bottom: 10px;">
                <div></div> `;

    const weekDates = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
        let d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        weekDates.push(d);
        
        let isToday = (d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear());
        
        html += `
            <div style="text-align:center; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <span style="font-size: 12px; color: var(--text-muted); font-weight: 500; text-transform: uppercase;">${days[i]}</span>
                <span style="${isToday ? 'background:var(--primary); color:white; width:36px; height:36px; border-radius:50%; display:flex; justify-content:center; align-items:center; font-size:18px; font-weight:600; box-shadow: var(--shadow-md);' : 'font-size:24px; color:var(--text-main); font-weight:300;'}">${d.getDate()}</span>
            </div>
        `;
    }
    
    html += `</div>
        <div style="flex: 1; overflow-y: auto; position: relative;">
            <div style="display: grid; grid-template-columns: 60px repeat(7, 1fr); min-height: 1200px;">
    `;

    // Time Axis & Grid Lines (24 hours)
    let timeAxis = `<div style="border-right: 1px solid var(--border);">`;
    let gridRows = ``;
    
    for (let h = 0; h < 24; h++) {
        let ampm = h >= 12 ? 'PM' : 'AM';
        let hour = h % 12 === 0 ? 12 : h % 12;
        timeAxis += `<div style="height: 60px; position: relative;"><span style="position: absolute; top: -8px; right: 8px; font-size: 11px; color: var(--text-muted);">${hour} ${ampm}</span></div>`;
    }
    timeAxis += `</div>`;
    html += timeAxis;

    // Day Columns
    weekDates.forEach(date => {
        let dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        let dayEvents = events.filter(e => e.date === dateStr && filters[e.category]);

        html += `<div style="border-right: 1px solid var(--border); position: relative; background: var(--bg-color);">`;
        
        // Horizontal grid lines
        for(let h=0; h<24; h++) html += `<div style="height: 60px; border-bottom: 1px solid var(--border); opacity: 0.5;"></div>`;

        // Plot Events using absolute positioning
        dayEvents.forEach(e => {
            let color = e.category === 'personal' ? 'var(--cat-personal)' : (e.category === 'work' ? 'var(--cat-work)' : 'var(--cat-important)');
            // Approximate top position based on time string (e.g., "14:30")
            let [hh, mm] = (e.time || "12:00").split(':').map(Number);
            let topPx = (hh * 60) + mm; 

            html += `
                <div class="event-pill" data-id="${e.id}" style="position: absolute; top: ${topPx}px; left: 4px; right: 4px; height: 50px; background: ${color}; color: white; border-radius: 6px; padding: 6px; font-size: 11px; cursor: pointer; box-shadow: var(--shadow-sm); overflow: hidden;">
                    <strong>${e.title}</strong><br>${e.time}
                </div>
            `;
        });
        html += `</div>`;
    });

    html += `</div></div></div>`;
    container.innerHTML = html;

    container.querySelectorAll('.event-pill').forEach(pill => {
        pill.addEventListener('click', () => { if(onEventClick) onEventClick(pill.getAttribute('data-id')); });
    });
}
