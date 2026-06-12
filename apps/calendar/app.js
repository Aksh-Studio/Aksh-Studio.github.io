import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { initShortcuts } from './modules/shortcuts.js';

// ==========================================
// 1. FIREBASE SETUP & THEME SYNC
// ==========================================
const themeBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    if (themeIcon) themeIcon.innerText = 'light_mode';
}

if (themeBtn) {
    themeBtn.onclick = () => {
        document.body.classList.toggle('dark-theme');
        if (document.body.classList.contains('dark-theme')) {
            localStorage.setItem('theme', 'dark');
            themeIcon.innerText = 'light_mode';
        } else {
            localStorage.setItem('theme', 'light');
            themeIcon.innerText = 'dark_mode';
        }
    };
}

const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================
// 2. STATE MANAGEMENT
// ==========================================
let currentUser = null;
let currentDate = new Date(); // The month currently being viewed
let events = []; // Array to hold all Firebase events
let editingEventId = null; // Tracks if we are editing an existing event

// Checkboxes for filtering
const filters = {
    personal: true,
    work: true,
    important: true
};

onAuthStateChanged(auth, user => { 
    if(user) { 
        currentUser = user; 
        loadEvents(); 
    } else {
        window.location.href = "../../index.html";
    }
});

// Update filters when checkboxes change
document.querySelectorAll('.custom-checkbox input').forEach(box => {
    box.addEventListener('change', (e) => {
        filters[e.target.value] = e.target.checked;
        renderMainCalendar();
        renderAgenda();
    });
});

// ==========================================
// 3. CALENDAR MATH & RENDERING ENGINE
// ==========================================
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function renderMiniCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    document.getElementById('mini-month-year').innerText = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = document.getElementById('mini-grid');
    grid.innerHTML = '';

    // Empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div></div>`;
    }

    // Actual days
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        let isToday = (i === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        grid.innerHTML += `<div class="${isToday ? 'active-day' : ''}">${i}</div>`;
    }
}

function renderMainCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    document.getElementById('main-month-year').innerText = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid = document.getElementById('main-calendar-grid');
    
    // Build a classic 7-column CSS grid for the month
    let html = `<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; height: 100%;">`;
    
    // Day Headers
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(d => html += `<div style="text-align:center; font-weight:600; color:var(--text-muted); padding-bottom:10px; border-bottom:1px solid var(--border);">${d}</div>`);
    
    // Empty padding cells
    for (let i = 0; i < firstDay; i++) {
        html += `<div style="border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); opacity: 0.3;"></div>`;
    }

    const today = new Date();
    
    // Render Day Cells
    for (let i = 1; i <= daysInMonth; i++) {
        let isToday = (i === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        let dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        // Filter events for this specific day
        let dayEvents = events.filter(e => e.date === dateStr && filters[e.category]);

        let eventHtml = '';
        dayEvents.forEach(e => {
            // Colors match the CSS variables
            let color = e.category === 'personal' ? '#3b82f6' : (e.category === 'work' ? '#f59e0b' : '#ef4444');
            eventHtml += `<div onclick="openEditModal('${e.id}')" style="background:${color}; color:white; font-size:11px; padding:4px; border-radius:4px; margin-bottom:4px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${e.title}</div>`;
        });

        html += `
            <div style="min-height: 100px; padding: 10px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); display: flex; flex-direction: column;">
                <span style="${isToday ? 'background:var(--primary); color:white; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:50%;' : 'font-weight:500;'}">${i}</span>
                <div style="flex: 1; margin-top: 8px; overflow-y: auto;">
                    ${eventHtml}
                </div>
            </div>
        `;
    }
    
    html += `</div>`;
    grid.innerHTML = html;
}

// Navigation Listeners
document.getElementById('mini-prev').onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); updateAllViews(); };
document.getElementById('mini-next').onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); updateAllViews(); };
document.getElementById('btn-main-prev').onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); updateAllViews(); };
document.getElementById('btn-main-next').onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); updateAllViews(); };
document.getElementById('btn-today').onclick = () => { currentDate = new Date(); updateAllViews(); };

function updateAllViews() {
    renderMiniCalendar();
    renderMainCalendar();
}


// ==========================================
// 4. FIREBASE EVENT CRUD LOGIC
// ==========================================
function loadEvents() {
    const q = query(collection(db, `users/${currentUser.uid}/calendarEvents`), orderBy("date", "asc"));
    onSnapshot(q, (snapshot) => {
        events = [];
        snapshot.forEach((doc) => {
            events.push({ id: doc.id, ...doc.data() });
        });
        updateAllViews();
        renderAgenda();
    });
}

// Modal Elements
const modalOverlay = document.getElementById('modal-overlay');
const btnCreate = document.getElementById('btn-create-event');
const btnClose = document.getElementById('btn-close-modal');
const btnSave = document.getElementById('btn-save-event');
const btnDelete = document.getElementById('btn-delete-event');

btnCreate.onclick = () => openModal();
btnClose.onclick = () => closeModal();

function openModal() {
    editingEventId = null;
    document.getElementById('modal-title-text').innerText = "Create Event";
    document.getElementById('event-title').value = "";
    document.getElementById('event-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('event-time').value = "12:00";
    document.getElementById('event-desc').value = "";
    btnDelete.style.display = 'none';
    modalOverlay.style.display = 'flex';
}

window.openEditModal = function(id) {
    const ev = events.find(e => e.id === id);
    if(!ev) return;
    
    editingEventId = id;
    document.getElementById('modal-title-text').innerText = "Edit Event";
    document.getElementById('event-title').value = ev.title;
    document.getElementById('event-date').value = ev.date;
    document.getElementById('event-time').value = ev.time;
    document.getElementById('event-category').value = ev.category;
    document.getElementById('event-desc').value = ev.desc || "";
    
    btnDelete.style.display = 'block';
    modalOverlay.style.display = 'flex';
};

function closeModal() {
    modalOverlay.style.display = 'none';
}

btnSave.onclick = async () => {
    const title = document.getElementById('event-title').value;
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const category = document.getElementById('event-category').value;
    const desc = document.getElementById('event-desc').value;

    if (!title || !date) return alert("Title and Date are required!");

    const eventData = { title, date, time, category, desc };

    try {
        if (editingEventId) {
            await updateDoc(doc(db, `users/${currentUser.uid}/calendarEvents`, editingEventId), eventData);
        } else {
            await addDoc(collection(db, `users/${currentUser.uid}/calendarEvents`), eventData);
        }
        closeModal();
    } catch (error) {
        console.error("Error saving event:", error);
    }
};

btnDelete.onclick = async () => {
    if (!editingEventId) return;
    if (confirm("Are you sure you want to delete this event?")) {
        await deleteDoc(doc(db, `users/${currentUser.uid}/calendarEvents`, editingEventId));
        closeModal();
    }
};

// ==========================================
// 5. AGENDA (UPCOMING) ENGINE
// ==========================================
function renderAgenda() {
    const agendaList = document.getElementById('upcoming-agenda');
    agendaList.innerHTML = '';
    
    // Get today's date string (YYYY-MM-DD) for filtering past events
    const todayStr = new Date().toISOString().split('T')[0];
    
    const upcoming = events.filter(e => e.date >= todayStr && filters[e.category]).sort((a, b) => a.date.localeCompare(b.date));

    if (upcoming.length === 0) {
        agendaList.innerHTML = '<p class="empty-state">No upcoming events.</p>';
        return;
    }

    upcoming.forEach(e => {
        let color = e.category === 'personal' ? '#3b82f6' : (e.category === 'work' ? '#f59e0b' : '#ef4444');
        
        // Format Date nicely
        const dateObj = new Date(e.date);
        const niceDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        agendaList.innerHTML += `
            <li onclick="openEditModal('${e.id}')" style="display:flex; align-items:flex-start; gap:12px; margin-bottom:15px; cursor:pointer; padding:10px; border-radius:8px; transition:0.2s;" onmouseover="this.style.background='var(--btn-hover)'" onmouseout="this.style.background='transparent'">
                <div style="width:12px; height:12px; border-radius:50%; background:${color}; margin-top:5px;"></div>
                <div style="flex:1;">
                    <h4 style="font-size:14px; margin-bottom:4px; color:var(--text-main);">${e.title}</h4>
                    <p style="font-size:12px; color:var(--text-muted);"><span class="material-symbols-rounded" style="font-size:12px; vertical-align:middle;">event</span> ${niceDate} • ${e.time}</p>
                </div>
            </li>
        `;
    });
}

// ==========================================
// 6. ✨ AKSH STUDIO ADVANCED INTENT & NLP ENGINE
// ==========================================
import * as chrono from 'https://esm.sh/chrono-node@2.4.2';
import { collection, addDoc, getDocs, deleteDoc, query, where, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const aiInput = document.getElementById('ai-prompt-input');
const btnAiSend = document.getElementById('btn-ai-send');
const aiChat = document.getElementById('ai-chat-history');

function addAiMessage(msg, isUser = false) {
    const div = document.createElement('div');
    div.className = 'ai-msg';
    if(isUser) {
        div.style.background = 'var(--primary)';
        div.style.color = 'white';
        div.style.alignSelf = 'flex-end';
        div.style.border = 'none';
    }
    div.innerText = msg;
    aiChat.appendChild(div);
    aiChat.scrollTop = aiChat.scrollHeight;
}

btnAiSend.onclick = async () => {
    const text = aiInput.value.trim();
    if(!text) return;
    
    addAiMessage(text, true);
    aiInput.value = "";

    // Append Thinking Indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'ai-msg';
    typingIndicator.innerText = "Processing intent...";
    typingIndicator.style.fontStyle = "italic";
    typingIndicator.style.opacity = "0.6";
    aiChat.appendChild(typingIndicator);
    aiChat.scrollTop = aiChat.scrollHeight;

    setTimeout(async () => {
        aiChat.removeChild(typingIndicator);
        const lowerText = text.toLowerCase();

        // ==========================================
        // ADVANCED FEATURE 1: INTENT CLASSIFICATION (Beyond Scheduling)
        // ==========================================
        
        // ACTION A: BATCH DELETION / CLEARING BY CATEGORY
        if (lowerText.startsWith('clear') || lowerText.startsWith('delete all')) {
            let targetCategory = null;
            if (lowerText.includes('work')) targetCategory = 'work';
            if (lowerText.includes('personal')) targetCategory = 'personal';
            if (lowerText.includes('important')) targetCategory = 'important';

            if (targetCategory) {
                try {
                    const qRef = query(collection(db, `users/${currentUser.uid}/calendarEvents`), where("category", "==", targetCategory));
                    const snap = await getDocs(qRef);
                    let count = 0;
                    for (const documentSnapshot of snap.docs) {
                        await deleteDoc(doc(db, `users/${currentUser.uid}/calendarEvents`, documentSnapshot.id));
                        count++;
                    }
                    addAiMessage(`🗑️ Cleaned up your schedule. Successfully deleted ${count} events from your "${targetCategory}" calendar.`);
                } catch(err) {
                    addAiMessage("Encountered an issue adjusting your database constraints.");
                }
                return;
            }
        }

        // ACTION B: SEARCH & QUERYING VIA CHAT
        if (lowerText.includes('show') || lowerText.includes('find') || lowerText.includes('what do i have')) {
            let matches = [];
            if (lowerText.includes('work')) matches = events.filter(e => e.category === 'work');
            else if (lowerText.includes('important')) matches = events.filter(e => e.category === 'important');
            else if (lowerText.includes('personal')) matches = events.filter(e => e.category === 'personal');
            else matches = events;

            if (matches.length === 0) {
                addAiMessage("🔍 I searched your workspace collections but found no active listings matching that description.");
            } else {
                let report = "🔍 Here is what I discovered on your current itinerary:\n";
                matches.slice(0, 5).forEach(m => {
                    report += `• ${m.title} (${m.date} at ${m.time})\n`;
                });
                addAiMessage(report);
            }
            return;
        }

        // ==========================================
        // ACTION C: RE-ENGINEERED DYNAMIC SCHEDULING
        // ==========================================
        const referenceDate = new Date(); // Secure real-time context anchor
        const parsedResults = chrono.parse(text, referenceDate, { forwardDate: true });
        
        if (parsedResults.length === 0) {
            addAiMessage("🤖 I couldn't isolate an explicit timeframe or calendar milestone from that input. Try outlining a specific target hour or relative day index.");
            return;
        }

        const result = parsedResults[0];
        const startDate = result.start.date();

        // PROTECT AGAINST PAST DATES: If time conversion forces an ambiguous date backward, roll it forward
        if (startDate < referenceDate && !result.start.isCertain('day')) {
            startDate.setDate(startDate.getDate() + 7);
        }

        // FIXING THE ISO MUTATION BUG: Extract explicitly via local system parameters
        const year = startDate.getFullYear();
        const month = String(startDate.getMonth() + 1).padStart(2, '0');
        const day = String(startDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        // FIXING THE TIME DROPPING BUG: Guarantee hour extraction validation
        let hours = startDate.getHours();
        let minutes = startDate.getMinutes();
        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

        // EXTRACTING DURATION / END TIMEFRAMES
        let description = `Auto-scheduled via Smart Input execution loop.`;
        if (result.end) {
            const endDate = result.end.date();
            const durationMs = endDate - startDate;
            const durationHours = Math.round(durationMs / (1000 * 60 * 60) * 10) / 10;
            description += ` Allocated duration blocks out approximately ${durationHours} hours, ending near ${endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.`;
        }

        // EXTRACT CLEAN TARGET TITLE
        let cleanTitle = text.replace(result.text, '').trim();
        cleanTitle = cleanTitle.replace(/^(on|at|for|from|to|me to)\s+/i, '').replace(/\s+(on|at|for|from|to)$/i, '').trim();
        if (!cleanTitle) cleanTitle = "AI Generated Milestone";

        // CATEGORY DETERMINATION ALGORITHM
        let category = 'personal';
        if (['meet', 'sync', 'project', 'client', 'work', 'session', 'hours'].some(k => lowerText.includes(k))) category = 'work';
        if (['urgent', 'deadline', 'priority', 'important', 'exam', 'flight'].some(k => lowerText.includes(k))) category = 'important';

        // COMMIT STRUCT TO FIRESTORE
        try {
            await addDoc(collection(db, `users/${currentUser.uid}/calendarEvents`), {
                title: cleanTitle,
                date: dateStr,
                time: timeStr,
                category: category,
                desc: description
            });
            
            const niceDate = startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
            const niceTime = startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            
            addAiMessage(`✨ Workspace updated. Logged "${cleanTitle}" under [${category.toUpperCase()}] mapped to ${niceDate} starting promptly at ${niceTime}.`);
        } catch(e) {
            addAiMessage("Database synchronization variance detected. Verify Firestore availability credentials.");
            console.error(e);
        }
    }, 600);
};

if (aiInput) {
    aiInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') btnAiSend.click();
    });
}

// Init on load
updateAllViews();
initShortcuts(); // ACTIVATING THE SHORTCUTS HERE
