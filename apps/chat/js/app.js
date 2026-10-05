// js/app.js
import { auth, googleProvider } from './config.js';
import { signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { state } from './state.js';
import { ui } from './ui.js';
import { dbService } from './db.js';

class App {
    constructor() {
        this.init();
    }

    init() {
        ui.init();
        
        ui.googleSigninBtn.addEventListener('click', () => {
            signInWithPopup(auth, googleProvider).catch(console.error);
        });

        onAuthStateChanged(auth, (user) => {
            state.currentUser = user;
            ui.updateUserProfile(user);

            if (user) {
                this.loadUserData(user);
                this.setupPresence(user);
            } else {
                this.clearUserData();
            }
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

    clearUserData() {
        if (state.unsubSpaces) state.unsubSpaces();
        if (state.unsubDMs) state.unsubDMs();
        if (state.unsubReadReceipts) state.unsubReadReceipts();
        state.clearActiveListeners();
        state.clearThreadListeners();
        ui.spacesList.innerHTML = '';
        ui.dmsList.innerHTML = '';
        ui.messageList.innerHTML = '';
        state.spaces = [];
        state.dms = [];
        state.readReceipts = {};
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});
