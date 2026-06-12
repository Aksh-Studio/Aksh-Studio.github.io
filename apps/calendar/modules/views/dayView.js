// dayView.js

export function renderDayView(container, currentDate, events, filters, onEventClick) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    let dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    let dayEvents = events.filter(e => e.date === dateStr && filters[e.category]);

    let html = `
        <div style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
            <div style="padding-bottom: 15px; border-bottom: 1px solid var(--border); margin-bottom: 10px;">
                <h2 style="font-weight: 300; font-size: 32px;">${days[currentDate.getDay()]}, ${months[currentDate.getMonth()]} ${currentDate.getDate()}</h2>
            </div>
            
            <div style="flex: 1; overflow-y: auto; position: relative;">
                <div style="display: grid; grid-template-columns: 80px 1fr; min-height: 1440px;">
                    <div style="border-right: 1px solid var(--border);">
    `;

    // Time Axis
    for (let h = 0; h < 24; h++) {
        let ampm = h >= 12 ? 'PM' : 'AM';
        let hour = h % 12 === 0 ? 12 : h % 12;
        html += `<div style="height: 60px; position: relative;"><span style="position: absolute; top: -8px; right: 15px; font-size: 13px; color: var(--text-muted); font-weight: 500;">${hour}:00 ${ampm}</span></div>`;
    }

    html += `</div><div style="position: relative; background: var(--bg-color);">`;
    
    // Grid Lines
    for(let h=0; h<24; h++) html += `<div style="height: 60px; border-bottom: 1px solid var(--border); opacity: 0.5;"></div>`;

    // Plot Events
    dayEvents.forEach(e => {
        let color = e.category === 'personal' ? 'var(--cat-personal)' : (e.category === 'work' ? 'var(--cat-work)' : 'var(--cat-important)');
        let [hh, mm] = (e.time || "12:00").split(':').map(Number);
        let topPx = (hh * 60) + mm; 

        html += `
            <div class="event-pill" data-id="${e.id}" style="position: absolute; top: ${topPx}px; left: 10px; right: 20px; height: 50px; background: ${color}; color: white; border-radius: 8px; padding: 10px; font-size: 13px; cursor: pointer; box-shadow: var(--shadow-md); border-left: 4px solid rgba(255,255,255,0.4);">
                <div style="font-weight: 600; font-size: 14px;">${e.title}</div>
                <div>${e.time}</div>
            </div>
        `;
    });

    html += `</div></div></div></div>`;
    container.innerHTML = html;

    container.querySelectorAll('.event-pill').forEach(pill => {
        pill.addEventListener('click', () => { if(onEventClick) onEventClick(pill.getAttribute('data-id')); });
    });
}
