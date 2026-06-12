import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import * as chrono from 'https://esm.sh/chrono-node@2.4.2';

// ==========================================
// 1. THEME SYNC
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
// 2. STATE & AUTHENTICATION
// ==========================================
let currentUser = null;
let currentDate = new Date(); 
let events = []; 
let editingEventId = null; 

const filters = { personal: true, work: true, important: true };

onAuthStateChanged(auth, user => { 
    if(user) { 
        currentUser = user; 
        
        // SAFE PROFILE FETCHING
        const nameEl = document.getElementById('cal-profile-name');
        const emailEl = document.getElementById('cal-profile-email');
        const avatarEl = document.getElementById('cal-header-avatar');
        
        const fallbackProfile = () => {
            if (nameEl) nameEl.innerHTML = `<strong>Name:</strong> ${user.displayName || 'User'}`;
            if (emailEl) emailEl.innerHTML = `<strong>Email:</strong> ${user.email || '-'}`;
            if (avatarEl && user.photoURL) avatarEl.src = user.photoURL;
        };

        try {
            const userRef = doc(db, `users/${user.uid}`);
            onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (nameEl) nameEl.innerHTML = `<strong>Name:</strong> ${data.name || user.displayName || 'User'}`;
                    if (emailEl) emailEl.innerHTML = `<strong>Email:</strong> ${data.email || user.email || '-'}`;
                    if (avatarEl && (data.photoURL || user.photoURL)) avatarEl.src = data.photoURL || user.photoURL;
                } else fallbackProfile();
            }, () => fallbackProfile());
        } catch (err) { fallbackProfile(); }

        loadEvents(); 
    } else {
        window.location.href = "../../index.html";
    }
});

// Safe Signout
setTimeout(() => {
    const signoutBtn = document.getElementById('cal-btn-signout');
    if (signoutBtn) {
        signoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => window.location.href = "../../index.html");
        });
    }
}, 500);

document.querySelectorAll('.custom-checkbox input').forEach(box => {
    box.addEventListener('change', (e) => {
        filters[e.target.value] = e.target.checked;
        renderMainCalendar();
        renderAgenda();
    });
});

// ==========================================
// 3. UI RENDERING ENGINE
// ==========================================
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function renderMiniCalendar() {
    const grid = document.getElementById('mini-grid');
    if(!grid) return;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    document.getElementById('mini-month-year').innerText = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    grid.innerHTML = '';
    for (let i = 0; i < firstDay; i++) grid.innerHTML += `<div></div>`;

    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        let isToday = (i === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        grid.innerHTML += `<div class="${isToday ? 'active-day' : ''}">${i}</div>`;
    }
}

function renderMainCalendar() {
    const grid = document.getElementById('main-calendar-grid');
    if(!grid) return;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    document.getElementById('main-month-year').innerText = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let html = `<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; height: 100%;">`;
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(d => html += `<div style="text-align:center; font-weight:600; color:var(--text-muted); padding-bottom:10px; border-bottom:1px solid var(--border);">${d}</div>`);
    
    for (let i = 0; i < firstDay; i++) {
        html += `<div style="border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); opacity: 0.3;"></div>`;
    }

    const today = new Date();
    
    for (let i = 1; i <= daysInMonth; i++) {
        let isToday = (i === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        let dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        let dayEvents = events.filter(e => e.date === dateStr && filters[e.category]);
        let eventHtml = '';
        dayEvents.forEach(e => {
            let color = e.category === 'personal' ? 'var(--cat-personal)' : (e.category === 'work' ? 'var(--cat-work)' : 'var(--cat-important)');
            eventHtml += `<div onclick="openEditModal('${e.id}')" style="background:${color}; color:white; font-size:11px; padding:4px 6px; border-radius:4px; margin-bottom:4px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${e.time} - ${e.title}</div>`;
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
document.getElementById('mini-prev')?.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); updateAllViews(); });
document.getElementById('mini-next')?.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); updateAllViews(); });
document.getElementById('btn-main-prev')?.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); updateAllViews(); });
document.getElementById('btn-main-next')?.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); updateAllViews(); });
document.getElementById('btn-today')?.addEventListener('click', () => { currentDate = new Date(); updateAllViews(); });

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
        snapshot.forEach((doc) => events.push({ id: doc.id, ...doc.data() }));
        updateAllViews();
        renderAgenda();
    });
}

// Modal Elements
const modalOverlay = document.getElementById('modal-overlay');
document.getElementById('btn-create-event')?.addEventListener('click', () => openModal());
document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);

function openModal() {
    editingEventId = null;
    document.getElementById('modal-title-text').innerText = "Create Event";
    document.getElementById('event-title').value = "";
    document.getElementById('event-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('event-time').value = "12:00";
    document.getElementById('event-desc').value = "";
    document.getElementById('btn-delete-event').style.display = 'none';
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
    document.getElementById('btn-delete-event').style.display = 'block';
    modalOverlay.style.display = 'flex';
};

function closeModal() { modalOverlay.style.display = 'none'; }

document.getElementById('btn-save-event')?.addEventListener('click', async () => {
    const title = document.getElementById('event-title').value;
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const category = document.getElementById('event-category').value;
    const desc = document.getElementById('event-desc').value;

    if (!title || !date) return alert("Title and Date are required!");
    const eventData = { title, date, time, category, desc };

    try {
        if (editingEventId) await updateDoc(doc(db, `users/${currentUser.uid}/calendarEvents`, editingEventId), eventData);
        else await addDoc(collection(db, `users/${currentUser.uid}/calendarEvents`), eventData);
        closeModal();
    } catch (error) { console.error("Error saving event:", error); }
});

document.getElementById('btn-delete-event')?.addEventListener('click', async () => {
    if (!editingEventId) return;
    if (confirm("Are you sure you want to delete this event?")) {
        await deleteDoc(doc(db, `users/${currentUser.uid}/calendarEvents`, editingEventId));
        closeModal();
    }
});

// ==========================================
// 5. AGENDA (UPCOMING) ENGINE
// ==========================================
function renderAgenda() {
    const agendaList = document.getElementById('upcoming-agenda');
    if(!agendaList) return;
    agendaList.innerHTML = '';
    
    // Sort logic
    const todayStr = new Date().toISOString().split('T')[0];
    const upcoming = events.filter(e => e.date >= todayStr && filters[e.category]).sort((a, b) => {
        if (a.date === b.date) return a.time.localeCompare(b.time);
        return a.date.localeCompare(b.date);
    });

    if (upcoming.length === 0) {
        agendaList.innerHTML = '<p class="empty-state">No upcoming events.</p>';
        return;
    }

    upcoming.forEach(e => {
        let color = e.category === 'personal' ? 'var(--cat-personal)' : (e.category === 'work' ? 'var(--cat-work)' : 'var(--cat-important)');
        const dateObj = new Date(e.date);
        const niceDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        agendaList.innerHTML += `
            <li onclick="openEditModal('${e.id}')" style="display:flex; align-items:flex-start; gap:12px; margin-bottom:15px; cursor:pointer; padding:10px; border-radius:8px; transition:0.2s;" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='transparent'">
                <div style="width:12px; height:12px; border-radius:50%; background:${color}; margin-top:5px;"></div>
                <div style="flex:1;">
                    <h4 style="font-size:14px; margin-bottom:4px; color:var(--text-main);">${e.title}</h4>
                    <p style="font-size:12px; color:var(--text-muted);"><span class="material-symbols-rounded" style="font-size:12px; vertical-align:middle;">schedule</span> ${niceDate} • ${e.time}</p>
                </div>
            </li>
        `;
    });
}

// ==========================================
// 6. ✨ AKSH STUDIO ADVANCED INTENT & NLP ENGINE
// ==========================================
const aiInput = document.getElementById('ai-prompt-input');
const btnAiSend = document.getElementById('btn-ai-send');
const aiChat = document.getElementById('ai-chat-history');

function addAiMessage(msg, isUser = false) {
    if(!aiChat) return;
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

if (btnAiSend) {
    btnAiSend.onclick = async () => {
        const text = aiInput.value.trim();
        if(!text) return;
        
        addAiMessage(text, true);
        aiInput.value = "";

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

            // ADVANCED FEATURE 1: INTENT CLASSIFICATION
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
                        addAiMessage(`🗑️ Cleaned up your schedule. Deleted ${count} events from "${targetCategory}".`);
                    } catch(err) {
                        addAiMessage("Encountered an issue adjusting your database constraints.");
                    }
                    return;
                }
            }

            // ADVANCED FEATURE 2: SEARCH QUERYING
            if (lowerText.includes('show') || lowerText.includes('find') || lowerText.includes('what do i have')) {
                let matches = [];
                if (lowerText.includes('work')) matches = events.filter(e => e.category === 'work');
                else if (lowerText.includes('important')) matches = events.filter(e => e.category === 'important');
                else if (lowerText.includes('personal')) matches = events.filter(e => e.category === 'personal');
                else matches = events;

                if (matches.length === 0) {
                    addAiMessage("🔍 I searched your workspace but found no active listings.");
                } else {
                    let report = "🔍 Here is what I discovered:\n";
                    matches.slice(0, 5).forEach(m => { report += `• ${m.title} (${m.date} at ${m.time})\n`; });
                    addAiMessage(report);
                }
                return;
            }

            // ADVANCED FEATURE 3: DYNAMIC SCHEDULING (Fixes the date/time bugs)
            const referenceDate = new Date(); 
            const parsedResults = chrono.parse(text, referenceDate, { forwardDate: true });
            
            if (parsedResults.length === 0) {
                addAiMessage("🤖 I couldn't isolate an explicit timeframe. Try: 'Sync next Friday at 3pm'");
                return;
            }

            const result = parsedResults[0];
            const startDate = result.start.date();

            // Prevent ambiguous past dating
            if (startDate < referenceDate && !result.start.isCertain('day')) startDate.setDate(startDate.getDate() + 7);

            // Correct local extraction (Prevents ISO timezone shifting)
            const year = startDate.getFullYear();
            const month = String(startDate.getMonth() + 1).padStart(2, '0');
            const day = String(startDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            let hours = startDate.getHours();
            let minutes = startDate.getMinutes();
            const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

            let cleanTitle = text.replace(result.text, '').trim();
            cleanTitle = cleanTitle.replace(/^(on|at|for|from|to|me to)\s+/i, '').replace(/\s+(on|at|for|from|to)$/i, '').trim();
            if (!cleanTitle) cleanTitle = "AI Generated Milestone";

            let category = 'personal';
            if (['meet', 'sync', 'project', 'client', 'work', 'session', 'hours'].some(k => lowerText.includes(k))) category = 'work';
            if (['urgent', 'deadline', 'priority', 'important', 'exam', 'flight'].some(k => lowerText.includes(k))) category = 'important';

            try {
                await addDoc(collection(db, `users/${currentUser.uid}/calendarEvents`), {
                    title: cleanTitle,
                    date: dateStr,
                    time: timeStr,
                    category: category,
                    desc: "Auto-scheduled via Smart Input."
                });
                
                const niceDate = startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                addAiMessage(`✨ Logged "${cleanTitle}" under [${category.toUpperCase()}] mapped to ${niceDate} at ${timeStr}.`);
            } catch(e) {
                addAiMessage("Database synchronization error. Please check your network.");
                console.error(e);
            }
        }, 600);
    };
}

if (aiInput) {
    aiInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') btnAiSend.click();
    });
}
