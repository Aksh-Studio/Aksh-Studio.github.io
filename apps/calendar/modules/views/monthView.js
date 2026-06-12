// monthView.js

export function renderMonthView(container, currentDate, events, filters, onEventClick) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    
    let html = `<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; height: 100%; min-height: 500px;">`;
    
    // Day Headers
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(d => html += `<div style="text-align:center; font-weight:600; color:var(--text-muted); padding-bottom:10px; border-bottom:1px solid var(--border);">${d}</div>`);
    
    // Empty padding for previous month's trailing days
    for (let i = 0; i < firstDay; i++) {
        html += `<div style="border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); opacity: 0.2; background: var(--bg-color); border-radius: 8px;"></div>`;
    }

    // Render Actual Days
    for (let i = 1; i <= daysInMonth; i++) {
        let isToday = (i === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        let dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        let dayEvents = events.filter(e => e.date === dateStr && filters[e.category]);
        let eventHtml = '';
        
        dayEvents.forEach(e => {
            let color = e.category === 'personal' ? 'var(--cat-personal)' : (e.category === 'work' ? 'var(--cat-work)' : 'var(--cat-important)');
            eventHtml += `<div class="event-pill" data-id="${e.id}" style="background:${color}; color:white; font-size:11px; padding:4px 6px; border-radius:4px; margin-bottom:4px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; box-shadow: var(--shadow-sm);">${e.title}</div>`;
        });

        html += `
            <div style="min-height: 100px; padding: 10px; border: 1px solid var(--border); border-radius: 8px; display: flex; flex-direction: column; background: var(--card-bg);">
                <span style="${isToday ? 'background:var(--primary); color:white; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:50%; box-shadow: var(--shadow-md);' : 'font-weight:500; color:var(--text-main);'}">${i}</span>
                <div style="flex: 1; margin-top: 8px; overflow-y: auto; scrollbar-width: none;">
                    ${eventHtml}
                </div>
            </div>
        `;
    }
    
    html += `</div>`;
    container.innerHTML = html;

    // Attach click listeners to the dynamically generated pills
    container.querySelectorAll('.event-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop clicking the background day
            if(onEventClick) onEventClick(pill.getAttribute('data-id'));
        });
    });
}
