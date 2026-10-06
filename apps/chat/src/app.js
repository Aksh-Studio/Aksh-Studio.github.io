import { initAuth } from './auth.js';
import { setCurrentRoom } from './chatEngine.js';
import { setupDropdowns } from './advancedEngine.js';
import { setupHelpEngine } from './help/helpEngine.js';
import { auth, db, collection, query, where, getDocs, setDoc, doc, getDoc } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    initTheme();
    
    initAuth((user) => {
        setupTabs();
        setupDropdowns();
        setupHelpEngine();
        setupSearch();
        // Load default view or deep link
    });
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.add(`${savedTheme}-theme`);
    
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.onclick = () => {
            const isLight = document.body.classList.contains('light-theme');
            document.body.classList.remove(isLight ? 'light-theme' : 'dark-theme');
            document.body.classList.add(isLight ? 'dark-theme' : 'light-theme');
            localStorage.setItem('theme', isLight ? 'dark' : 'light');
        };
    }
}

function setupTabs() {
    const tabs = ['all', 'network', 'unread', 'groups'];
    tabs.forEach(tab => {
        const el = document.getElementById(`tab-${tab}`);
        if (el) {
            el.onclick = () => switchTab(tab);
        }
    });
}

function switchTab(activeTab) {
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${activeTab}`)?.classList.add('active');
    // Logic to filter chat list based on activeTab
}

function setupSearch() {
    const searchInput = document.getElementById('user-search-input');
    if (searchInput) {
        searchInput.oninput = async (e) => {
            const val = e.target.value.trim();
            if (val.length < 3) return;
            
            try {
                const q = query(collection(db, 'users'), where('displayName', '>=', val), where('displayName', '<=', val + '\uf8ff'));
                const snap = await getDocs(q);
                const resultsContainer = document.getElementById('search-results');
                if (resultsContainer) {
                    resultsContainer.innerHTML = '';
                    snap.forEach(userDoc => {
                        const data = userDoc.data();
                        const el = document.createElement('div');
                        el.textContent = data.displayName;
                        el.onclick = () => initializeDMRoom(auth.currentUser.uid, userDoc.id);
                        resultsContainer.appendChild(el);
                    });
                }
            } catch (error) {
                console.error("Search error", error);
            }
        };
    }
}

async function initializeDMRoom(uid1, uid2) {
    const sorted = [uid1, uid2].sort();
    const roomId = `dm_${sorted[0]}_${sorted[1]}`;
    
    try {
        const roomRef = doc(db, 'rooms', roomId);
        const roomSnap = await getDoc(roomRef);
        
        if (!roomSnap.exists()) {
            await setDoc(roomRef, {
                type: 'dm',
                members: [uid1, uid2],
                createdAt: Date.now()
            });
        }
        
        navigateToRoom(roomId, roomSnap.exists() ? roomSnap.data() : { type: 'dm', members: [uid1, uid2] });
    } catch (error) {
        console.error("Error initializing DM room", error);
    }
}

function navigateToRoom(roomId, roomData) {
    setCurrentRoom(roomId, roomData);
    document.getElementById('chat-view')?.classList.add('active');
    document.getElementById('list-view')?.classList.remove('active');
}
