// js/app.js
import { auth } from './config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { state } from './state.js';
import { ui } from './ui.js';
import { dbService } from './db.js';

class App {
    constructor() {
        this.init();
    }

    init() {
        ui.init();

        onAuthStateChanged(auth, (user) => {
            if (!user) {
                window.location.href = '../../index.html';
                return;
            }
            
            state.currentUser = user;
            ui.updateUserProfile(user);
            this.loadUserData(user);
            this.setupPresence(user);
        });
    }

    setupPresence(user) {
        dbService.updateUserPresence(user.uid, 'active');
        
        document.addEventListener('visibilitychange', () => {
            if (state.currentUser) {
                const presence = document.visibilityState === 'visible' ? 'active' : 'away';
                dbService.updateUserPresence(state.currentUser.uid, presence);
                const badge = document.getElementById('user-status-badge');
                if (badge) {
                    badge.className = `status-badge ${presence}`;
                }
            }
        });
        
        window.addEventListener('focus', () => {
            if (state.currentUser) {
                dbService.updateUserPresence(state.currentUser.uid, 'active');
                const badge = document.getElementById('user-status-badge');
                if (badge) badge.className = 'status-badge active';
            }
        });
    }

    loadUserData(user) {
        // Listen to global users for DM picker
        state.unsubUsers = dbService.listenToAllUsers((snapshot) => {
            snapshot.docs.forEach(doc => {
                state.users[doc.id] = { uid: doc.id, ...doc.data() };
            });
            // Re-render space info if panel is open to update presences
            if (!ui.spaceInfoPanel.classList.contains('closed')) {
                ui.renderSpaceInfo();
            }
        });

        // Listen to read receipts
        state.unsubReadReceipts = dbService.listenToReadReceipts(user.uid, (snapshot) => {
            snapshot.docs.forEach(doc => {
                state.readReceipts[doc.id] = doc.data();
            });
            ui.renderSpaces(state.spaces);
            ui.renderDMs(state.dms);
        });

        // Listen to spaces
        state.unsubSpaces = dbService.listenToSpaces(user.uid, (snapshot) => {
            state.spaces = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            ui.renderSpaces(state.spaces);
        });

        // Listen to DMs
        state.unsubDMs = dbService.listenToDirectChats(user.uid, (snapshot) => {
            state.dms = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
            ui.renderDMs(state.dms);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});
