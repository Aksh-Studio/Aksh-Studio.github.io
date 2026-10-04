import { state } from "../state.js";
import { initSidebar, updateChats } from "./sidebar.js";
import { initChatUI } from "./chat.js";
import { initModals } from "./modals.js";
import { listenToChats } from "../services/chats.js";
import { login } from "../auth.js";

const appRoot = document.getElementById("app-root");
const loadingOverlay = document.getElementById("loading-overlay");
const authOverlay = document.getElementById("auth-overlay");
const mainLayout = document.getElementById("main-layout");
const btnSignin = document.getElementById("btn-signin");
const chatArea = document.getElementById("chat-area");
const activeChatEl = document.getElementById("active-chat");

export function initAppUI() {
    btnSignin?.addEventListener("click", () => {
        login().catch(console.error);
    });
    
    initSidebar();
    initChatUI();
    initModals();
}

export function updateAuthState(user, profile) {
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
    
    if (user) {
        appRoot?.classList.remove("loading");
        authOverlay?.classList.add("hidden");
        mainLayout?.classList.remove("hidden");
        
        state.unsubscribers.chats = listenToChats((chats) => {
            updateChats(chats);
        });
    } else {
        appRoot?.classList.remove("loading");
        authOverlay?.classList.remove("hidden");
        mainLayout?.classList.add("hidden");
        
        // Reset chat area & active chat on logout per Rule 1
        activeChatEl?.classList.add("hidden");
        chatArea?.classList.add("empty");
        chatArea?.classList.remove("active");
        
        document.querySelectorAll(".chat-item").forEach(el => el.classList.remove("active"));
    }
}
