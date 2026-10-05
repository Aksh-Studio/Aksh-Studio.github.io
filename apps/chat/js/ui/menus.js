import { createElement } from "../utils/dom.js";
import { state } from "../state.js";

let currentMenu = null;
let mobileBackdrop = null;

function showMobileBackdrop() {
    if (window.innerWidth <= 768) {
        if (!mobileBackdrop) {
            mobileBackdrop = createElement("div", "mobile-menu-backdrop");
            mobileBackdrop.addEventListener("click", () => closeMenu());
            document.body.appendChild(mobileBackdrop);
        }
        mobileBackdrop.classList.add("active");
    }
}

function hideMobileBackdrop() {
    if (mobileBackdrop) {
        mobileBackdrop.classList.remove("active");
    }
}

function outsideClickListener(e) {
    if (currentMenu && !currentMenu.contains(e.target)) {
        closeMenu();
    }
}

function escapeListener(e) {
    if (e.key === "Escape") {
        closeMenu();
    }
}

export function closeMenu() {
    hideMobileBackdrop();
    if (currentMenu) {
        if (currentMenu.isConnected) {
            document.body.removeChild(currentMenu);
        }
        currentMenu = null;
        document.removeEventListener("click", outsideClickListener);
        document.removeEventListener("keydown", escapeListener);
    }
}

export function showMessageMenu(e, msg, isMine, onAction) {
    closeMenu();
    showMobileBackdrop();
    
    const menu = createElement("div", "context-menu");
    menu.style.position = "fixed";
    
    // Position menu defensively within viewport
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 300);
    menu.style.left = `${Math.max(10, x)}px`;
    menu.style.top = `${Math.max(10, y)}px`;
    menu.style.zIndex = "10000";
    
    // Quick Reactions Header
    const reactionRow = createElement("div", "reaction-picker-row", { 
        style: "display: flex; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border); font-size: 18px; justify-content: space-around;" 
    });
    const emojis = ["👍", "❤️", "😂", "😮", "😢", "👏"];
    emojis.forEach(emoji => {
        const span = createElement("span", "emoji-btn", { 
            textContent: emoji,
            style: "cursor: pointer; transition: transform 0.15s; user-select: none;"
        });
        span.onmouseover = () => span.style.transform = "scale(1.25)";
        span.onmouseout = () => span.style.transform = "scale(1)";
        span.addEventListener("click", () => {
            onAction("react", { ...msg, emoji });
            closeMenu();
        });
        reactionRow.appendChild(span);
    });
    menu.appendChild(reactionRow);
    
    const actions = [];
    
    // Reply & Forward
    actions.push({ label: "Reply", action: "reply" });
    actions.push({ label: "Forward", action: "forward" });
    
    // Copy for text messages
    if (msg.type === "text" && msg.text && !msg.deletedForEveryone) {
        actions.push({ label: "Copy", action: "copy" });
    }
    
    // Dynamic Star / Unstar
    const isStarred = state.starredMessageIds.has(msg.id);
    actions.push({ label: isStarred ? "Unstar" : "Star", action: isStarred ? "unstar" : "star" });
    
    // Pin / Unpin
    const isGroup = state.activeChatData?.type === "group";
    const isAdmin = state.activeChatData?.admins?.includes(state.currentUser?.uid);
    const isAppOwner = state.currentUser?.email?.toLowerCase() === "akshat124.am12@gmail.com";
    const isPinned = state.activeChatData?.pinnedMessageId === msg.id;
    
    if (!isGroup || isAdmin || isAppOwner) {
        actions.push({ label: isPinned ? "Unpin" : "Pin", action: isPinned ? "unpin" : "pin" });
    }
    
    // Edit for sender
    if (isMine && msg.type === "text" && !msg.deletedForEveryone) {
        actions.push({ label: "Edit", action: "edit" });
    }
    
    // Delete for Me
    actions.push({ label: "Delete for Me", action: "delete_me" });
    
    // Delete for Everyone for sender, or owner in global_channel
    const isOwner = state.currentUser?.email?.toLowerCase() === "akshat124.am12@gmail.com";
    const isGlobalOwner = isOwner && state.activeChatId === "global_channel";
    if ((isMine || isGlobalOwner) && !msg.deletedForEveryone) {
        actions.push({ label: "Delete for Everyone", action: "delete_everyone" });
    }
    
    actions.forEach(act => {
        const item = createElement("div", "context-menu-item", { textContent: act.label });
        item.addEventListener("click", () => {
            onAction(act.action, msg);
            closeMenu();
        });
        menu.appendChild(item);
    });
    
    document.body.appendChild(menu);
    currentMenu = menu;
    
    setTimeout(() => {
        document.addEventListener("click", outsideClickListener);
        document.addEventListener("keydown", escapeListener);
    }, 10);
}

export function showChatMenu(e, chat, onAction) {
    closeMenu();
    showMobileBackdrop();
    
    const menu = createElement("div", "context-menu");
    menu.style.position = "fixed";
    
    const rightOffset = Math.max(10, window.innerWidth - e.clientX);
    const topOffset = Math.min(e.clientY + 10, window.innerHeight - 200);
    menu.style.right = `${rightOffset}px`;
    menu.style.top = `${topOffset}px`;
    menu.style.zIndex = "10000";
    
    const isSystem = chat?.systemRoom || chat?.id === "global_channel" || chat?.id === "aksh_help";
    
    let infoLabel = "Contact Info";
    if (isSystem) infoLabel = "Channel Info";
    else if (chat?.type === "group") infoLabel = "Group Info";

    const actions = [
        { label: infoLabel, action: "info" },
        { label: "Clear Chat", action: "clear" },
        { label: "Export Chat", action: "export" }
    ];
    
    // Only non-system rooms can be deleted or left
    if (!isSystem) {
        actions.push({ label: "Delete Chat", action: "delete" });
        if (chat?.type === "group") {
            actions.push({ label: "Leave Group", action: "leave_group" });
        }
    }
    
    actions.forEach(act => {
        const item = createElement("div", "context-menu-item", { textContent: act.label });
        item.addEventListener("click", () => {
            onAction(act.action);
            closeMenu();
        });
        menu.appendChild(item);
    });
    
    document.body.appendChild(menu);
    currentMenu = menu;
    
    setTimeout(() => {
        document.addEventListener("click", outsideClickListener);
        document.addEventListener("keydown", escapeListener);
    }, 10);
}
