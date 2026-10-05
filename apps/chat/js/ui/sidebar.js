import { state } from "../state.js";
import { fetchProfile } from "../services/users.js";
import { formatTime, normalizeTimestamp } from "../utils/timestamps.js";
import { createElement, safeSrc } from "../utils/dom.js";
import { openChat } from "./chat.js";
import { decryptMessage } from "../cipher.js";

const chatListEl = document.getElementById("chat-list");
const searchInput = document.getElementById("search-input");

export let currentChats = [];

export function initSidebar() {
    searchInput?.addEventListener("input", () => {
        renderChatList();
    });
}

export async function updateChats(chats) {
    currentChats = chats || [];
    state.chats = currentChats;
    await renderChatList();
}

let renderVersion = 0;

export async function renderChatList() {
    if (!chatListEl) return;
    
    const currentVersion = ++renderVersion;

    // Preserve search text & filter
    const term = searchInput ? searchInput.value.toLowerCase().trim() : "";
    
    // Performance optimization: Preload all unique DM participant profiles in parallel!
    const uniqueDmuids = new Set();
    currentChats.forEach(chat => {
        if (chat.type === "dm" && !chat.isSystem && Array.isArray(chat.participants)) {
            const otherUid = chat.participants.find(uid => uid !== state.currentUser?.uid);
            if (otherUid) uniqueDmuids.add(otherUid);
        }
    });

    if (uniqueDmuids.size > 0) {
        await Promise.all(Array.from(uniqueDmuids).map(uid => fetchProfile(uid)));
    }
    
    if (renderVersion !== currentVersion) return;
    
    chatListEl.innerHTML = "";
    
    let renderedCount = 0;

    for (const chat of currentChats) {
        // Skip if deleted for me and not currently active
        if (chat[`deletedFor_${state.currentUser?.uid}`] === true && state.activeChatId !== chat.id) {
            continue;
        }

        let title = chat.name || "Unknown Chat";
        let avatar = chat.icon || "./chat-logo.png";
        
        // Handle DM profile from cached profile
        if (chat.type === "dm") {
            if (chat.isSystem) {
                title = chat.name || "System Channel";
                avatar = chat.icon || "https://cdn-icons-png.flaticon.com/512/1041/1041883.png"; // Example help icon
            } else {
                const otherUid = chat.participants?.find(uid => uid !== state.currentUser?.uid);
                if (otherUid) {
                    const profile = state.profileCache.get(otherUid) || {};
                    title = profile.nickname || profile.fullName || profile.name || "User";
                    avatar = profile.photoURL || "./chat-logo.png";
                }
            }
        } else if (chat.type === "group" && chat.isSystem) {
            title = chat.name || "System Group";
            avatar = chat.icon || "https://cdn-icons-png.flaticon.com/512/615/615075.png"; // Example global icon
        }
        
        // Filter by search term
        if (term && !title.toLowerCase().includes(term)) {
            continue;
        }

        renderedCount++;
        
        const isActive = state.activeChatId === chat.id;
        const div = createElement("div", `chat-item ${isActive ? 'active' : ''}`);
        div.dataset.chatId = chat.id;
        
        const img = createElement("img", "avatar", { src: safeSrc(avatar), alt: "" });
        
        const infoDiv = createElement("div", "chat-info");
        const titleRow = createElement("div", "chat-title-row");
        const titleEl = createElement("span", "chat-title", { textContent: title });
        
        const msgTime = chat.lastMessageTime || chat.updatedAt;
        const timeEl = createElement("span", "chat-time", { textContent: formatTime(msgTime) });
        
        titleRow.appendChild(titleEl);
        titleRow.appendChild(timeEl);
        
        const previewRow = createElement("div", "chat-preview-row", { style: "display: flex; justify-content: space-between; align-items: center;" });
        const rawPreview = chat.lastMessage || (chat.lastMessageTime ? "Message" : "");
        const previewText = decryptMessage(rawPreview);
        const previewEl = createElement("div", "chat-preview", { textContent: previewText, style: "flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" });
        previewRow.appendChild(previewEl);

        // Unread badge logic
        if (chat.lastMessageTime && state.currentUser) {
            const myReadTime = chat.readReceipts && chat.readReceipts[state.currentUser.uid];
            const myReadDate = normalizeTimestamp(myReadTime);
            const lastMsgDate = normalizeTimestamp(chat.lastMessageTime);
            const myReadMs = myReadDate ? myReadDate.getTime() : 0;
            const lastMsgMs = lastMsgDate ? lastMsgDate.getTime() : 0;
            
            // Only show unread if last message was not from self
            const isFromSelf = chat.lastMessageSenderId === state.currentUser.uid;
            if (!isFromSelf && lastMsgMs > myReadMs && state.activeChatId !== chat.id) {
                const badge = createElement("div", "unread-badge", { textContent: "•", style: "color: var(--primary); font-size: 24px; line-height: 1; margin-left: 6px;" });
                previewRow.appendChild(badge);
            }
        }
        
        infoDiv.appendChild(titleRow);
        infoDiv.appendChild(previewRow);
        
        div.appendChild(img);
        div.appendChild(infoDiv);
        
        div.addEventListener("click", () => {
            document.querySelectorAll(".chat-item").forEach(el => el.classList.remove("active"));
            div.classList.add("active");
            openChat(chat.id, { title, avatar, ...chat });
        });
        
        chatListEl.appendChild(div);
    }

    if (renderedCount === 0) {
        const emptyMsg = createElement("div", "sidebar-empty", { 
            textContent: term ? "No matching chats found." : "No chats yet. Start a new conversation!",
            style: "padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 13px;"
        });
        chatListEl.appendChild(emptyMsg);
    }
}
