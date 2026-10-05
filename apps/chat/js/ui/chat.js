import { state, clearRoomState } from "../state.js";
import { 
    listenToMessages, sendMessage, deleteForMe, deleteForEveryone, 
    editMessage, starMessage, unstarMessage, toggleReaction, removeReaction 
} from "../services/messages.js";
import { fetchProfile } from "../services/users.js";
import { uploadAttachment } from "../services/media.js";
import { formatTime, formatDate, normalizeTimestamp } from "../utils/timestamps.js";
import { escapeHtml, createElement, safeSrc } from "../utils/dom.js";
import { clearChat, updateReadReceipt, pinMessage, unpinMessage, leaveGroup } from "../services/chats.js";
import { showMessageMenu, showChatMenu } from "./menus.js";
import { openForwardModal, openGroupInfoModal, openContactInfoModal } from "./modals.js";

const chatArea = document.getElementById("chat-area");
const activeChatEl = document.getElementById("active-chat");
const chatHeaderTitle = document.getElementById("chat-header-title");
const chatHeaderSubtitle = document.getElementById("chat-header-subtitle");
const chatHeaderAvatar = document.getElementById("chat-header-avatar");
const messageListEl = document.getElementById("message-list");
const messageInput = document.getElementById("message-input");
const btnSend = document.getElementById("btn-send");
const fileInput = document.getElementById("file-input");
const btnAttach = document.getElementById("btn-attach");
const selectionToolbar = document.getElementById("selection-toolbar");
const selectionCount = document.getElementById("selection-count");
const btnCancelSelection = document.getElementById("btn-cancel-selection");
const btnBulkForward = document.getElementById("btn-bulk-forward");
const btnBulkDelete = document.getElementById("btn-bulk-delete");

let activeSearchTerm = "";

export function isMessageVisibleToCurrentUser(msg, chatId) {
    if (!msg) return false;
    if (state.hiddenMessageIds.has(msg.id)) return false;
    
    const dateObj = normalizeTimestamp(msg.createdAt);
    if (!dateObj) return true; // Keep pending messages visible
    
    const msgTimeMs = dateObj.getTime();
    const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
    const sixtyDaysAgo = Date.now() - SIXTY_DAYS_MS;
    
    let clearMs = 0;
    
    // Check metadata clearTimestamp
    const meta = state.chatMeta[chatId];
    if (meta && meta.clearTimestamp) {
        const clearDateObj = normalizeTimestamp(meta.clearTimestamp);
        if (clearDateObj) clearMs = Math.max(clearMs, clearDateObj.getTime());
    }

    // Check chat doc clearedAt_<uid>
    const docClear = state.activeChatData?.[`clearedAt_${state.currentUser?.uid}`];
    if (docClear) {
        const d = normalizeTimestamp(docClear);
        if (d) clearMs = Math.max(clearMs, d.getTime());
    }
    
    const effectiveCutoff = Math.max(clearMs, sixtyDaysAgo);
    return msgTimeMs > effectiveCutoff;
}

export function initChatUI() {
    btnSend?.addEventListener("click", handleSend);
    messageInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
    
    btnAttach?.addEventListener("click", () => fileInput.click());
    fileInput?.addEventListener("change", handleFileSelected);
    
    document.getElementById("btn-mobile-back")?.addEventListener("click", () => {
        closeActiveChat();
    });
    
    // Search Button
    document.getElementById("btn-chat-search")?.addEventListener("click", () => {
        let searchBar = document.getElementById("chat-search-bar");
        if (searchBar) {
            searchBar.classList.toggle("hidden");
            if (!searchBar.classList.contains("hidden")) {
                const input = searchBar.querySelector("input");
                input.focus();
                activeSearchTerm = input.value.toLowerCase().trim();
            } else {
                searchBar.querySelector("input").value = "";
                activeSearchTerm = "";
                renderMessages();
            }
            return;
        }
        
        searchBar = createElement("div", "chat-search-bar", { id: "chat-search-bar" });
        searchBar.style.display = "flex";
        searchBar.style.alignItems = "center";
        searchBar.style.padding = "8px 16px";
        searchBar.style.background = "var(--bg-secondary)";
        searchBar.style.borderBottom = "1px solid var(--border)";
        searchBar.style.gap = "8px";
        
        const input = createElement("input", "modal-input", { placeholder: "Search messages in chat..." });
        input.style.flex = "1";
        
        const info = createElement("span", "", { textContent: "0 results", style: "font-size: 12px; color: var(--text-muted); min-width: 60px; text-align: right;" });
        
        const closeBtn = createElement("button", "icon-btn small", { innerHTML: '<span class="material-symbols-rounded">close</span>' });
        closeBtn.onclick = () => {
            searchBar.classList.add("hidden");
            input.value = "";
            activeSearchTerm = "";
            renderMessages();
        };

        input.addEventListener("input", () => {
            activeSearchTerm = input.value.toLowerCase().trim();
            if (!activeSearchTerm) {
                info.textContent = "0 results";
                renderMessages();
                return;
            }
            
            let count = 0;
            state.currentMessages.forEach(m => {
                if (m.type === "text" && m.text && m.text.toLowerCase().includes(activeSearchTerm) && isMessageVisibleToCurrentUser(m, state.activeChatId)) {
                    count++;
                }
            });
            info.textContent = `${count} result(s)`;
            renderMessages(activeSearchTerm);
        });
        
        searchBar.appendChild(input);
        searchBar.appendChild(info);
        searchBar.appendChild(closeBtn);
        
        activeChatEl.insertBefore(searchBar, messageListEl);
        input.focus();
    });

    document.getElementById("btn-chat-menu")?.addEventListener("click", (e) => {
        showChatMenu(e, state.activeChatData, handleChatMenuAction);
    });
    
    const headerInfo = document.querySelector(".chat-header-info");
    if (headerInfo) {
        headerInfo.style.cursor = "pointer";
        headerInfo.addEventListener("click", () => {
            handleChatMenuAction("info");
        });
    }
    
    // Selection Toolbar
    btnCancelSelection?.addEventListener("click", () => {
        state.selectedMessageIds.clear();
        renderSelectionToolbar();
        renderMessages(activeSearchTerm);
    });
    
    btnBulkForward?.addEventListener("click", () => {
        const selectedMsgs = state.currentMessages.filter(m => state.selectedMessageIds.has(m.id));
        if (selectedMsgs.length === 0) return;
        openForwardModal(selectedMsgs);
    });
    
    btnBulkDelete?.addEventListener("click", async () => {
        const selectedMsgs = state.currentMessages.filter(m => state.selectedMessageIds.has(m.id));
        if (selectedMsgs.length === 0) return;
        
        if (confirm(`Delete ${selectedMsgs.length} selected message(s) for you?`)) {
            const ids = selectedMsgs.map(m => m.id);
            try {
                await deleteForMe(state.activeChatId, ids);
                state.selectedMessageIds.clear();
                renderSelectionToolbar();
                renderMessages(activeSearchTerm);
            } catch (err) {
                alert("Failed to delete messages: " + (err.message || "Unknown error"));
            }
        }
    });

    // Listen to hiddenMessages & chatMeta events
    document.addEventListener("hiddenMessagesUpdated", () => {
        if (state.activeChatId) renderMessages(activeSearchTerm);
    });
    document.addEventListener("chatMetaUpdated", () => {
        if (state.activeChatId) renderMessages(activeSearchTerm);
    });
}

function closeActiveChat() {
    clearRoomState();
    state.activeChatId = null;
    state.activeChatData = null;
    activeSearchTerm = "";
    
    const searchBar = document.getElementById("chat-search-bar");
    if (searchBar) {
        searchBar.classList.add("hidden");
        const input = searchBar.querySelector("input");
        if (input) input.value = "";
    }

    activeChatEl?.classList.add("hidden");
    chatArea?.classList.add("empty");
    chatArea?.classList.remove("active");
    
    document.querySelectorAll(".chat-item").forEach(el => el.classList.remove("active"));
}

function renderSelectionToolbar() {
    if (!selectionToolbar) return;
    if (state.selectedMessageIds.size > 0) {
        selectionToolbar.classList.remove("hidden");
        if (selectionCount) {
            selectionCount.textContent = `${state.selectedMessageIds.size} selected`;
        }
    } else {
        selectionToolbar.classList.add("hidden");
    }
}

async function handleChatMenuAction(action) {
    if (!state.activeChatId) return;
    const operationRoomId = state.activeChatId;
    try {
        if (action === "clear") {
            if (confirm("Clear this chat? Messages will be cleared for you.")) {
                await clearChat(operationRoomId);
                if (state.activeChatId === operationRoomId) {
                    state.currentMessages = [];
                    renderMessages();
                }
            }
        } else if (action === "delete") {
            if (state.activeChatData?.systemRoom) {
                alert("Cannot delete system chats.");
                return;
            }
            if (confirm("Delete this chat permanently for you? This cannot be undone.")) {
                const { deleteChatForMe } = await import("../services/chats.js");
                await deleteChatForMe(operationRoomId);
                if (state.activeChatId === operationRoomId) {
                    closeActiveChat();
                }
            }
        } else if (action === "export") {
            let exportText = `========================================\n`;
            exportText += `AKSH CHAT EXPORT\n`;
            exportText += `Chat: ${state.activeChatData.title || "Conversation"}\n`;
            exportText += `Export Date: ${new Date().toLocaleString()}\n`;
            exportText += `========================================\n\n`;
            
            for (const msg of state.currentMessages) {
                if (!isMessageVisibleToCurrentUser(msg, state.activeChatId)) continue;
                
                const dateObj = normalizeTimestamp(msg.createdAt);
                const tsStr = dateObj ? `${formatDate(dateObj)} ${formatTime(dateObj)}` : "Pending/Unknown Time";
                
                let senderName = "Unknown";
                if (msg.senderId === state.currentUser?.uid) {
                    senderName = "You";
                } else {
                    const prof = await fetchProfile(msg.senderId);
                    senderName = prof.nickname || prof.fullName || prof.name || msg.senderId;
                }
                
                let content = "";
                if (msg.deletedForEveryone) {
                    content = "[This message was deleted]";
                } else if (msg.type === "text") {
                    content = msg.text || "";
                    if (msg.edited) content += " (edited)";
                    if (msg.forwarded) content = "[Forwarded] " + content;
                } else {
                    content = `[Attachment: ${msg.attachment?.name || msg.type}] (Size: ${msg.attachment?.size ? Math.round(msg.attachment.size/1024) + ' KB' : 'Unknown'})`;
                    if (msg.attachment?.url) content += `\nLink: ${msg.attachment.url}`;
                }
                
                exportText += `[${tsStr}] ${senderName}:\n${content}\n\n`;
            }
            
            const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `aksh_chat_${state.activeChatId}_export.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else if (action === "info") {
            if (state.activeChatData.type === "group") {
                openGroupInfoModal(state.activeChatData);
            } else {
                openContactInfoModal(state.activeChatData);
            }
        } else if (action === "leave_group") {
            if (state.activeChatData.createdBy === state.currentUser?.uid) {
                alert("Group owners cannot leave without transferring ownership.");
                return;
            }
            if (confirm("Are you sure you want to leave this group?")) {
                await leaveGroup(operationRoomId);
                if (state.activeChatId === operationRoomId) {
                    closeActiveChat();
                }
            }
        }
    } catch (e) {
        console.error(e);
        alert("Action failed: " + (e.message || "Unknown error"));
    }
}

export async function openChat(chatId, metadata) {
    if (state.activeChatId === chatId) return;
    
    clearRoomState();
    
    state.activeChatId = chatId;
    state.activeChatData = metadata;
    activeSearchTerm = "";
    
    // UI state transitions
    activeChatEl?.classList.remove("hidden");
    chatArea?.classList.remove("empty");
    chatArea?.classList.add("active");
    
    if (chatHeaderTitle) chatHeaderTitle.textContent = metadata.title || "Chat";
    if (chatHeaderAvatar) chatHeaderAvatar.src = safeSrc(metadata.avatar);
    
    if (chatHeaderSubtitle) {
        if (metadata.type === "group") {
            const count = metadata.participants?.length || 0;
            chatHeaderSubtitle.textContent = `Group: ${count} participants`;
        } else {
            chatHeaderSubtitle.textContent = "Direct Message";
        }
    }
    
    // Pinned banner
    setupPinBanner(chatId, metadata);
    
    if (messageListEl) {
        messageListEl.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">Loading conversation...</div>';
    }
    
    // Mark as read on opening
    updateReadReceipt(chatId).catch(() => {});

    // Listen to messages
    state.unsubscribers.messages = listenToMessages(chatId, (messages) => {
        if (state.activeChatId !== chatId) return;
        state.currentMessages = messages;
        renderMessages(activeSearchTerm);
        
        // Throttled read receipt: only if last message was from someone else
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.senderId !== state.currentUser?.uid) {
            updateReadReceipt(chatId).catch(() => {});
        }
    });
}

function setupPinBanner(chatId, metadata) {
    const pinContainer = document.getElementById("pin-container");
    if (!pinContainer) return;
    pinContainer.innerHTML = "";
    
    if (state.pinExpiryTimer) {
        clearTimeout(state.pinExpiryTimer);
        state.pinExpiryTimer = null;
    }
    
    const expiryDate = metadata.pinExpiry ? normalizeTimestamp(metadata.pinExpiry) : null;
    if (metadata.pinnedMessage && expiryDate && expiryDate.getTime() > Date.now()) {
        const banner = createElement("div", "pin-banner");
        banner.style.padding = "8px 16px";
        banner.style.background = "var(--bg-tertiary)";
        banner.style.borderBottom = "1px solid var(--border)";
        banner.style.display = "flex";
        banner.style.justifyContent = "space-between";
        banner.style.alignItems = "center";
        banner.style.cursor = "pointer";
        
        const textDiv = createElement("div", "", { 
            textContent: `📌 Pinned: ${metadata.pinnedMessage.text || "Attachment"}`,
            style: "font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;"
        });
        
        banner.onclick = () => {
            if (!metadata.pinnedMessageId) return;
            const targetEl = document.querySelector(`.msg-wrapper[data-id="${metadata.pinnedMessageId}"]`);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
                const bubbleTarget = targetEl.querySelector(".msg-bubble");
                if (bubbleTarget) {
                    bubbleTarget.style.transition = "background-color 0.4s";
                    const oldBg = bubbleTarget.style.backgroundColor;
                    bubbleTarget.style.backgroundColor = "rgba(0, 168, 132, 0.25)";
                    setTimeout(() => {
                        bubbleTarget.style.backgroundColor = oldBg;
                    }, 1400);
                }
            }
        };
        
        const isOwner = state.currentUser?.email?.toLowerCase() === "akshat124.am12@gmail.com";
        const isAdmin = metadata.admins && metadata.admins.includes(state.currentUser?.uid);
        
        banner.appendChild(textDiv);

        if (isOwner || isAdmin) {
            const unpinBtn = createElement("button", "icon-btn small", { 
                innerHTML: '<span class="material-symbols-rounded" style="font-size: 16px;">close</span>',
                title: "Unpin message"
            });
            unpinBtn.style.padding = "2px 6px";
            unpinBtn.onclick = async (e) => {
                e.stopPropagation();
                try {
                    await unpinMessage(chatId);
                    pinContainer.innerHTML = "";
                    if (state.activeChatData) {
                        delete state.activeChatData.pinnedMessage;
                        delete state.activeChatData.pinnedMessageId;
                    }
                } catch (err) {
                    alert("Failed to unpin message");
                }
            };
            banner.appendChild(unpinBtn);
        }
        
        pinContainer.appendChild(banner);
        
        const timeUntilExpiry = expiryDate.getTime() - Date.now();
        state.pinExpiryTimer = setTimeout(() => {
            pinContainer.innerHTML = "";
        }, timeUntilExpiry);
    }
}

export async function renderMessages(searchTerm = null) {
    if (!messageListEl || !state.activeChatId) return;
    
    const operationRoomId = state.activeChatId;
    const isAtBottom = messageListEl.scrollHeight - messageListEl.scrollTop <= messageListEl.clientHeight + 80;
    
    // Preload sender profiles in parallel for performance
    const senderUids = new Set();
    state.currentMessages.forEach(m => {
        if (m.senderId) senderUids.add(m.senderId);
    });
    if (senderUids.size > 0) {
        await Promise.all(Array.from(senderUids).map(uid => fetchProfile(uid)));
    }
    
    if (state.activeChatId !== operationRoomId) return;

    messageListEl.innerHTML = "";
    
    let visibleCount = 0;

    for (const msg of state.currentMessages) {
        if (!isMessageVisibleToCurrentUser(msg, state.activeChatId)) continue;
        
        visibleCount++;
        const isMine = msg.senderId === state.currentUser?.uid;
        const profile = state.profileCache.get(msg.senderId) || {};
        
        const wrap = createElement("div", `msg-wrapper ${isMine ? 'mine' : 'theirs'}`);
        wrap.dataset.id = msg.id;
        
        // Selection checkbox
        const checkbox = createElement("input", "msg-checkbox", { type: "checkbox" });
        checkbox.checked = state.selectedMessageIds.has(msg.id);
        checkbox.style.margin = "0 6px";
        checkbox.style.cursor = "pointer";
        checkbox.addEventListener("change", (e) => {
            if (e.target.checked) {
                state.selectedMessageIds.add(msg.id);
            } else {
                state.selectedMessageIds.delete(msg.id);
            }
            renderSelectionToolbar();
        });
        wrap.appendChild(checkbox);
        
        const bubble = createElement("div", "msg-bubble");
        
        // Sender name for group chats
        if (!isMine && state.activeChatData?.type === "group") {
            const senderDisplayName = profile.nickname || profile.fullName || profile.name || "User";
            const senderName = createElement("div", "msg-sender", { textContent: senderDisplayName });
            senderName.style.fontSize = "12px";
            senderName.style.fontWeight = "600";
            senderName.style.color = "var(--primary)";
            senderName.style.marginBottom = "3px";
            bubble.appendChild(senderName);
        }
        
        if (msg.deletedForEveryone) {
            bubble.classList.add("deleted");
            bubble.appendChild(createElement("span", "", { 
                textContent: "🚫 This message was deleted",
                style: "font-style: italic; color: var(--text-muted); font-size: 13px;"
            }));
        } else {
            // Reply Preview
            if (msg.replyTo) {
                const replyDiv = createElement("div", "msg-replied");
                replyDiv.style.fontSize = "12px";
                replyDiv.style.background = "rgba(0,0,0,0.06)";
                replyDiv.style.padding = "4px 8px";
                replyDiv.style.borderRadius = "4px";
                replyDiv.style.marginBottom = "6px";
                replyDiv.style.borderLeft = "3px solid var(--primary)";
                replyDiv.style.cursor = "pointer";
                
                const repUser = createElement("div", "", { 
                    textContent: msg.replyTo.senderId === state.currentUser?.uid ? "You" : "Reply", 
                    style: "font-weight: 600; font-size: 11px; color: var(--primary);" 
                });
                const repText = createElement("div", "", { 
                    textContent: msg.replyTo.text || "Attachment", 
                    style: "overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" 
                });
                
                replyDiv.appendChild(repUser);
                replyDiv.appendChild(repText);
                
                replyDiv.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (!msg.replyTo.messageId) return;
                    const targetEl = document.querySelector(`.msg-wrapper[data-id="${msg.replyTo.messageId}"]`);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
                        const bubbleTarget = targetEl.querySelector(".msg-bubble");
                        if (bubbleTarget) {
                            bubbleTarget.style.transition = "background-color 0.4s";
                            const oldBg = bubbleTarget.style.backgroundColor;
                            bubbleTarget.style.backgroundColor = "rgba(0, 168, 132, 0.25)";
                            setTimeout(() => {
                                bubbleTarget.style.backgroundColor = oldBg;
                            }, 1400);
                        }
                    }
                });
                bubble.appendChild(replyDiv);
            }
            
            // Forwarded Indicator
            if (msg.forwarded) {
                const fwdDiv = createElement("div", "msg-forwarded", { 
                    textContent: "➦ Forwarded",
                    style: "font-size: 11px; color: var(--text-muted); font-style: italic; margin-bottom: 4px;"
                });
                bubble.appendChild(fwdDiv);
            }
            
            // Attachment Rendering
            if (msg.attachment && msg.attachment.url) {
                const attachType = msg.attachment.type || "";
                const isImage = attachType.startsWith("image/") || msg.type === "image";
                
                if (isImage) {
                    const imgContainer = createElement("div", "msg-img-container", { style: "margin: 4px 0;" });
                    const imageEl = createElement("img", "msg-attachment-img", { 
                        src: safeSrc(msg.attachment.url),
                        alt: msg.attachment.name || "Image",
                        style: "max-width: 240px; max-height: 200px; border-radius: 8px; cursor: pointer; display: block; object-fit: cover;"
                    });
                    imageEl.onclick = (e) => {
                        e.stopPropagation();
                        window.open(msg.attachment.url, "_blank");
                    };
                    imgContainer.appendChild(imageEl);
                    bubble.appendChild(imgContainer);
                } else {
                    const docBox = createElement("a", "msg-attachment-doc", {
                        href: safeSrc(msg.attachment.url),
                        target: "_blank",
                        style: "display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 6px; text-decoration: none; color: inherit; margin: 4px 0;"
                    });
                    docBox.onclick = (e) => e.stopPropagation();
                    
                    const icon = createElement("span", "material-symbols-rounded", { textContent: "description", style: "font-size: 28px; color: var(--primary);" });
                    const fileInfo = createElement("div", "", { style: "overflow: hidden;" });
                    const fileName = createElement("div", "", { 
                        textContent: msg.attachment.name || "Document", 
                        style: "font-weight: 500; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;" 
                    });
                    const sizeStr = msg.attachment.size ? `${(msg.attachment.size / 1024).toFixed(1)} KB` : "";
                    const fileSize = createElement("div", "", { textContent: sizeStr, style: "font-size: 11px; color: var(--text-muted);" });
                    
                    fileInfo.appendChild(fileName);
                    fileInfo.appendChild(fileSize);
                    docBox.appendChild(icon);
                    docBox.appendChild(fileInfo);
                    bubble.appendChild(docBox);
                }
            }
            
            // Text Message with Search Highlight
            if (msg.text) {
                const textEl = createElement("div", "msg-text", { style: "word-break: break-word; white-space: pre-wrap;" });
                if (searchTerm && msg.text.toLowerCase().includes(searchTerm.toLowerCase())) {
                    const escaped = escapeHtml(msg.text);
                    const safeTerm = escapeHtml(searchTerm);
                    const regex = new RegExp(`(${safeTerm})`, "gi");
                    textEl.innerHTML = escaped.replace(regex, '<mark style="background: #ffe066; padding: 0 2px; border-radius: 2px;">$1</mark>');
                } else {
                    textEl.textContent = msg.text;
                }
                bubble.appendChild(textEl);
            }
        }
        
        // Timestamp & Edited Tag
        const timeWrap = createElement("div", "msg-time-wrap", { style: "display: flex; gap: 4px; align-items: center; justify-content: flex-end; margin-top: 4px;" });
        const time = createElement("span", "msg-time", { textContent: formatTime(msg.createdAt) });
        timeWrap.appendChild(time);
        
        if (msg.edited) {
            const editedTag = createElement("span", "msg-edited", { textContent: "(edited)", style: "font-size: 10px; color: var(--text-muted); font-style: italic;" });
            timeWrap.appendChild(editedTag);
        }
        
        // Reactions Badges
        if (msg.reactions && typeof msg.reactions === "object" && Object.keys(msg.reactions).length > 0) {
            const reactionContainer = createElement("div", "msg-reactions", { style: "display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap;" });
            
            const counts = {};
            for (const uid in msg.reactions) {
                const r = msg.reactions[uid];
                if (r) counts[r] = (counts[r] || 0) + 1;
            }
            
            for (const r in counts) {
                const myReaction = msg.reactions[state.currentUser?.uid];
                const isMyReact = myReaction === r;
                
                const rBadge = createElement("div", "reaction-badge", { 
                    textContent: `${r} ${counts[r]}`,
                    style: `background: ${isMyReact ? 'var(--primary-light, #e0f2fe)' : 'var(--bg-tertiary)'}; border: 1px solid ${isMyReact ? 'var(--primary)' : 'var(--border)'}; padding: 2px 7px; border-radius: 12px; font-size: 12px; cursor: pointer; user-select: none;`
                });
                
                rBadge.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    try {
                        if (isMyReact) {
                            await removeReaction(state.activeChatId, msg.id);
                        } else {
                            await toggleReaction(state.activeChatId, msg.id, r);
                        }
                    } catch (err) {
                        console.warn("Reaction toggle error:", err);
                    }
                });
                reactionContainer.appendChild(rBadge);
            }
            bubble.appendChild(reactionContainer);
        }
        
        wrap.appendChild(bubble);
        wrap.appendChild(timeWrap);
        
        // Context Menu Handler on Bubble
        bubble.style.cursor = "pointer";
        bubble.addEventListener("click", (e) => {
            showMessageMenu(e, msg, isMine, handleMessageAction);
        });
        
        messageListEl.appendChild(wrap);
    }
    
    if (visibleCount === 0) {
        const emptyState = createElement("div", "messages-empty", {
            textContent: searchTerm ? "No messages matching search." : "No messages yet. Send a message to start the conversation!",
            style: "padding: 32px; text-align: center; color: var(--text-muted); font-size: 13px;"
        });
        messageListEl.appendChild(emptyState);
    }
    
    if (isAtBottom) {
        messageListEl.scrollTop = messageListEl.scrollHeight;
    }
}

async function handleMessageAction(action, msg) {
    if (!state.activeChatId) return;
    try {
        if (action === "edit") {
            state.editMessageId = msg.id;
            messageInput.value = msg.text || "";
            messageInput.focus();
        } else if (action === "delete_me") {
            await deleteForMe(state.activeChatId, [msg.id]);
        } else if (action === "delete_everyone") {
            if (confirm("Delete this message for everyone?")) {
                await deleteForEveryone(state.activeChatId, [msg.id]);
            }
        } else if (action === "reply") {
            state.replyMessageId = msg.id;
            state.replyMessageData = msg;
            
            const banner = document.getElementById("reply-banner");
            const textEl = document.getElementById("reply-text");
            const userEl = document.getElementById("reply-user");
            
            if (banner && textEl && userEl) {
                textEl.textContent = msg.text || (msg.attachment ? "Attachment" : "Message");
                const prof = state.profileCache.get(msg.senderId) || {};
                userEl.textContent = msg.senderId === state.currentUser?.uid ? "You" : (prof.nickname || prof.fullName || prof.name || "User");
                banner.classList.remove("hidden");
                
                document.getElementById("btn-cancel-reply").onclick = () => {
                    state.replyMessageId = null;
                    state.replyMessageData = null;
                    banner.classList.add("hidden");
                };
            }
            messageInput.focus();
        } else if (action === "forward") {
            openForwardModal([msg]);
        } else if (action === "copy") {
            if (msg.text) {
                await navigator.clipboard.writeText(msg.text);
                const originalText = messageInput.placeholder;
                messageInput.placeholder = "Copied to clipboard!";
                setTimeout(() => { messageInput.placeholder = originalText; }, 1500);
            }
        } else if (action === "star") {
            await starMessage(state.activeChatId, msg.id, msg);
        } else if (action === "unstar") {
            await unstarMessage(msg.id);
        } else if (action === "pin") {
            await pinMessage(state.activeChatId, msg);
            setupPinBanner(state.activeChatId, { ...state.activeChatData, pinnedMessage: { text: msg.text || "Attachment", senderId: msg.senderId }, pinnedMessageId: msg.id, pinExpiry: Date.now() + 30 * 24 * 60 * 60 * 1000 });
        } else if (action === "unpin") {
            await unpinMessage(state.activeChatId);
            const pinContainer = document.getElementById("pin-container");
            if (pinContainer) pinContainer.innerHTML = "";
        } else if (action === "react") {
            if (msg.emoji) {
                await toggleReaction(state.activeChatId, msg.id, msg.emoji);
            }
        }
    } catch (err) {
        console.error(err);
        alert("Action failed: " + (err.message || "Unknown error"));
    }
}

async function handleSend() {
    const text = messageInput.value.trim();
    const chatId = state.activeChatId;
    if (!chatId || !text) return;
    
    const originalText = messageInput.value;
    
    try {
        if (state.editMessageId) {
            await editMessage(chatId, state.editMessageId, text);
            state.editMessageId = null;
        } else {
            await sendMessage(chatId, text, "text", null, state.replyMessageData);
        }
        
        // Clear input only on success
        messageInput.value = "";
        
        if (state.activeChatId === chatId) {
            messageListEl.scrollTop = messageListEl.scrollHeight;
            
            // Clear reply banner
            state.replyMessageId = null;
            state.replyMessageData = null;
            document.getElementById("reply-banner")?.classList.add("hidden");
        }
    } catch (e) {
        console.error(e);
        messageInput.value = originalText;
        alert("Failed to send message: " + (e.message || "Network or permission error"));
    }
}

async function handleFileSelected(e) {
    const file = e.target.files[0];
    const chatId = state.activeChatId;
    if (!file || !chatId) return;
    
    e.target.value = "";
    
    const sendBtn = document.getElementById("btn-send");
    if (sendBtn) sendBtn.disabled = true;
    
    const operationRoomId = state.activeChatId;
    try {
        const meta = await uploadAttachment(chatId, file);
        if (state.activeChatId !== operationRoomId) return;
        
        const isImg = file.type.startsWith("image/");
        await sendMessage(chatId, "", isImg ? "image" : "file", meta, state.replyMessageData);
        
        state.replyMessageId = null;
        state.replyMessageData = null;
        document.getElementById("reply-banner")?.classList.add("hidden");
    } catch (err) {
        console.error(err);
        alert("Upload failed: " + (err.message || "Failed to upload file."));
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}
