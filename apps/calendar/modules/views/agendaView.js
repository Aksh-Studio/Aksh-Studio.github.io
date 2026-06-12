// agendaView.js

export function renderAgendaView(container, currentDate, events, filters, onEventClick) {
    let todayStr = currentDate.toISOString().split('T')[0];
    
    // Sort upcoming events chronologically
    let upcoming = events
        .filter(e => e.date >= todayStr && filters[e.category])
        .sort((a, b) => a.date.localeCompare(b.date));

    let html = `<div style="max-width: 800px; margin: 0 auto; padding-top: 10px;">`;

    if (upcoming.length === 0) {
        html += `<div style="text-align:center; padding: 40px; color: var(--text-muted);"><span class="material-symbols-rounded" style="font-size:48px; opacity:0.5;">event_busy</span><h3 style="margin-top:10px;">No upcoming events found.</h3></div>`;
    } else {
        let currentRenderedDate = "";

        upcoming.forEach(e => {
            let color = e.category === 'personal' ? 'var(--cat-personal)' : (e.category === 'work' ? 'var(--cat-work)' : 'var(--cat-important)');
            
            // If it's a new day, print a date header
            if (e.date !== currentRenderedDate) {
                const dateObj = new Date(e.date);
                const niceDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                html += `<h3 style="margin: 25px 0 10px 0; font-size: 18px; font-weight: 500; color: var(--primary); border-bottom: 2px solid var(--border); padding-bottom: 5px;">${niceDate}</h3>`;
                currentRenderedDate = e.date;
            }

            html += `
                <div class="agenda-item" data-id="${e.id}" style="display: flex; align-items: center; gap: 15px; padding: 15px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 10px; cursor: pointer; transition: 0.2s; box-shadow: var(--shadow-sm);">
                    <div style="min-width: 80px; font-weight: 600; color: var(--text-main); font-size: 15px;">${e.time || 'All Day'}</div>
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></div>
                    <div style="flex: 1;">
                        <h4 style="margin: 0; font-size: 16px; color: var(--text-main);">${e.title}</h4>
                        ${e.desc ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: var(--text-muted);">${e.desc}</p>` : ''}
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;
    container.innerHTML = html;

    // Attach Click Events
    container.querySelectorAll('.agenda-item').forEach(item => {
        item.addEventListener('mouseenter', () => item.style.transform = 'translateY(-2px)');
        item.addEventListener('mouseleave', () => item.style.transform = 'translateY(0)');
        item.addEventListener('click', () => { if(onEventClick) onEventClick(item.getAttribute('data-id')); });
    });
}
