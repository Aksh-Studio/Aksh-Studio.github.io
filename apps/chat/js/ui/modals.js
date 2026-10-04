import { searchUsers, blockUser, unblockUser, updateProfile, fetchProfile } from "../services/users.js";
import { createDirectMessage, createGroup, leaveGroup } from "../services/chats.js";
import { sendMessage } from "../services/messages.js";
import { uploadAttachment } from "../services/media.js";
import { logout } from "../auth.js";
import { state, clearRoomState } from "../state.js";
import { createElement, safeSrc } from "../utils/dom.js";

export function initModals() {
    document.getElementById("btn-new-chat")?.addEventListener("click", openNewChatModal);
    document.getElementById("btn-new-group")?.addEventListener("click", openNewGroupModal);
    document.getElementById("btn-settings")?.addEventListener("click", openSettingsModal);
}

function createModalOverlay(title, contentEl, onClose) {
    const overlay = createElement("div", "overlay flex-center");
    overlay.style.zIndex = "2000";
    const modal = createElement("div", "modal");
    
    const header = createElement("div", "modal-header");
    const h2 = createElement("h2", "", { textContent: title });
    const closeBtn = createElement("button", "icon-btn", { innerHTML: '<span class="material-symbols-rounded">close</span>' });
    
    const closeFn = () => {
        if (!overlay.isConnected) return;
        document.body.removeChild(overlay);
        document.removeEventListener("keydown", escapeListener);
        if (onClose) onClose();
    };
    
    const escapeListener = (e) => {
        if (e.key === "Escape") closeFn();
    };
    
    closeBtn.addEventListener("click", closeFn);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeFn();
    });
    
    document.addEventListener("keydown", escapeListener);
    
    header.appendChild(h2);
    header.appendChild(closeBtn);
    modal.appendChild(header);
    modal.appendChild(contentEl);
    overlay.appendChild(modal);
    
    document.body.appendChild(overlay);
    return { overlay, modal, closeFn };
}

export async function openNewChatModal() {
    const content = createElement("div", "modal-content");
    const input = createElement("input", "modal-input", { placeholder: "Search users by name or email..." });
    const results = createElement("div", "search-results");
    results.style.maxHeight = "250px";
    results.style.overflowY = "auto";
    
    input.addEventListener("input", async (e) => {
        const term = e.target.value.trim();
        if (!term) {
            results.innerHTML = "";
            return;
        }
        results.innerHTML = '<div style="padding: 12px; color: var(--text-muted); text-align: center;">Searching...</div>';
        try {
            const users = await searchUsers(term);
            results.innerHTML = "";
            let count = 0;
            users.forEach(u => {
                if (u.uid === state.currentUser?.uid) return;
                count++;
                const row = createElement("div", "user-row", { style: "display: flex; align-items: center; gap: 10px; padding: 8px; cursor: pointer; border-radius: 8px;" });
                row.appendChild(createElement("img", "avatar small", { src: safeSrc(u.photoURL) }));
                const nameSpan = createElement("span", "", { textContent: u.nickname || u.fullName || u.name || "User" });
                row.appendChild(nameSpan);
                row.addEventListener("click", async () => {
                    try {
                        await createDirectMessage(u.uid);
                        modalObj.closeFn();
                    } catch (err) {
                        alert(err.message || "Failed to create chat");
                    }
                });
                results.appendChild(row);
            });
            if (count === 0) {
                results.innerHTML = '<div style="padding: 12px; color: var(--text-muted); text-align: center;">No users found.</div>';
            }
        } catch (err) {
            results.innerHTML = '<div style="padding: 12px; color: var(--error); text-align: center;">Error searching users.</div>';
        }
    });
    
    content.appendChild(input);
    content.appendChild(results);
    const modalObj = createModalOverlay("New Chat", content);
    setTimeout(() => input.focus(), 50);
}

export function openNewGroupModal() {
    const content = createElement("div", "modal-content");
    const nameInput = createElement("input", "modal-input", { placeholder: "Group Name (max 50 chars)" });
    const searchInput = createElement("input", "modal-input", { placeholder: "Search users to add...", style: "margin-top: 8px;" });
    const results = createElement("div", "search-results");
    results.style.maxHeight = "200px";
    results.style.overflowY = "auto";
    const selectedDiv = createElement("div", "selected-users", { textContent: "Selected: 0 members", style: "font-size: 13px; color: var(--text-muted); margin: 8px 0;" });
    const createBtn = createElement("button", "btn btn-primary", { textContent: "Create Group", disabled: true, style: "width: 100%; margin-top: 12px;" });
    
    let selectedUids = new Set();
    
    function renderSelected() {
        selectedDiv.textContent = `Selected: ${selectedUids.size} member(s)`;
        createBtn.disabled = selectedUids.size === 0 || !nameInput.value.trim();
    }
    
    nameInput.addEventListener("input", renderSelected);
    
    searchInput.addEventListener("input", async (e) => {
        const term = e.target.value.trim();
        if (!term) { results.innerHTML = ""; return; }
        const users = await searchUsers(term);
        results.innerHTML = "";
        users.forEach(u => {
            if (u.uid === state.currentUser?.uid) return;
            const row = createElement("div", "user-row", { style: "display: flex; align-items: center; gap: 8px; padding: 6px; cursor: pointer; border-radius: 6px;" });
            const isSel = selectedUids.has(u.uid);
            if (isSel) row.style.background = "var(--bg-tertiary)";
            
            row.appendChild(createElement("img", "avatar small", { src: safeSrc(u.photoURL) }));
            row.appendChild(createElement("span", "", { textContent: u.nickname || u.fullName || u.name || "User" }));
            
            row.addEventListener("click", () => {
                if (selectedUids.has(u.uid)) {
                    selectedUids.delete(u.uid);
                    row.style.background = "";
                } else {
                    selectedUids.add(u.uid);
                    row.style.background = "var(--bg-tertiary)";
                }
                renderSelected();
            });
            results.appendChild(row);
        });
    });
    
    createBtn.addEventListener("click", async () => {
        const nameTrimmed = nameInput.value.trim();
        if (!nameTrimmed) return;
        if (nameTrimmed.length > 50) {
            alert("Group name must be 50 characters or less");
            return;
        }
        createBtn.disabled = true;
        createBtn.textContent = "Creating...";
        try {
            await createGroup(nameTrimmed, Array.from(selectedUids));
            modalObj.closeFn();
        } catch (e) {
            alert("Failed to create group: " + e.message);
            createBtn.disabled = false;
            createBtn.textContent = "Create Group";
        }
    });
    
    content.appendChild(nameInput);
    content.appendChild(selectedDiv);
    content.appendChild(searchInput);
    content.appendChild(results);
    content.appendChild(createBtn);
    
    const modalObj = createModalOverlay("New Group", content);
    setTimeout(() => nameInput.focus(), 50);
}

export function openSettingsModal() {
    const content = createElement("div", "modal-content");
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.gap = "12px";
    
    const profile = state.currentProfile || {};
    
    // Profile Image
    const imgWrapper = createElement("div", "", { style: "text-align: center; margin-bottom: 8px;" });
    const img = createElement("img", "avatar", { src: safeSrc(profile.photoURL) || "./chat-logo.png", style: "width: 80px; height: 80px; border-radius: 50%; object-fit: cover;" });
    imgWrapper.appendChild(img);
    content.appendChild(imgWrapper);
    
    // Name Input
    const nameLabel = createElement("label", "", { textContent: "Full Name", style: "font-size: 12px; color: var(--text-muted);" });
    const nameInput = createElement("input", "modal-input", { value: profile.fullName || "", placeholder: "Your full name" });
    
    // Nickname Input
    const nickLabel = createElement("label", "", { textContent: "Nickname", style: "font-size: 12px; color: var(--text-muted);" });
    const nickInput = createElement("input", "modal-input", { value: profile.nickname || "", placeholder: "Your nickname" });
    
    content.appendChild(nameLabel);
    content.appendChild(nameInput);
    content.appendChild(nickLabel);
    content.appendChild(nickInput);
    
    const emailInfo = createElement("p", "", { textContent: `Email: ${profile.email || "No email"}`, style: "font-size: 14px; color: var(--text-muted);" });
    content.appendChild(emailInfo);
    
    const saveBtn = createElement("button", "btn btn-primary", { textContent: "Save Changes", style: "margin-top: 8px;" });
    saveBtn.addEventListener("click", async () => {
        const newName = nameInput.value.trim();
        const newNick = nickInput.value.trim();
        
        if (!newName || !newNick) {
            alert("Name and Nickname cannot be empty.");
            return;
        }
        
        const oldText = saveBtn.textContent;
        saveBtn.textContent = "Saving...";
        saveBtn.disabled = true;
        
        try {
            await updateProfile({ fullName: newName, nickname: newNick });
            if (state.currentProfile) {
                state.currentProfile.fullName = newName;
                state.currentProfile.nickname = newNick;
            }
            alert("Profile updated successfully.");
            modalObj.closeFn();
        } catch (e) {
            console.error(e);
            alert("Failed to update profile: " + (e.message || "Unknown error"));
        } finally {
            saveBtn.textContent = oldText;
            saveBtn.disabled = false;
        }
    });
    content.appendChild(saveBtn);
    
    // Sign out button
    const logoutBtn = createElement("button", "btn", { textContent: "Sign Out", style: "background: var(--error); color: white; margin-top: 8px;" });
    logoutBtn.addEventListener("click", async () => {
        modalObj.closeFn();
        await logout();
    });
    content.appendChild(logoutBtn);
    
    const modalObj = createModalOverlay("Settings", content);
}

export function openForwardModal(messages) {
    if (!messages || messages.length === 0) return;
    
    const content = createElement("div", "modal-content");
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.gap = "12px";
    
    const title = createElement("h3", "", { textContent: `Forward ${messages.length} message(s)` });
    content.appendChild(title);
    
    const searchInput = createElement("input", "modal-input", { placeholder: "Search destination chats..." });
    content.appendChild(searchInput);
    
    const results = createElement("div", "search-results");
    results.style.maxHeight = "220px";
    results.style.overflowY = "auto";
    content.appendChild(results);
    
    const selectedChats = new Set();
    
    function renderChats() {
        results.innerHTML = "";
        const term = searchInput.value.toLowerCase().trim();
        const chats = state.chats || [];
        
        let count = 0;
        chats.forEach(c => {
            let cName = c.name || "Chat";
            if (c.type === "dm") {
                const otherParticipant = c.participants?.find(p => p !== state.currentUser?.uid);
                const cachedProfile = state.profileCache.get(otherParticipant);
                if (cachedProfile) {
                    cName = cachedProfile.nickname || cachedProfile.fullName || cachedProfile.name || "Direct Message";
                } else {
                    cName = "Direct Message";
                }
            }
            
            if (term && !cName.toLowerCase().includes(term)) return;
            count++;
            
            const row = createElement("label", "user-row", { style: "display: flex; align-items: center; gap: 8px; padding: 6px; cursor: pointer;" });
            const cb = createElement("input", "", { type: "checkbox" });
            cb.checked = selectedChats.has(c.id);
            cb.addEventListener("change", (e) => {
                if (e.target.checked) selectedChats.add(c.id);
                else selectedChats.delete(c.id);
            });
            
            row.appendChild(cb);
            row.appendChild(createElement("span", "", { textContent: cName }));
            results.appendChild(row);
        });
        if (count === 0) {
            results.innerHTML = '<div style="padding: 12px; color: var(--text-muted); text-align: center;">No chats found.</div>';
        }
    }
    
    searchInput.addEventListener("input", renderChats);
    renderChats();
    
    const actionRow = createElement("div", "", { style: "display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;" });
    const btnCancel = createElement("button", "btn", { textContent: "Cancel" });
    const btnForward = createElement("button", "btn btn-primary", { textContent: "Forward" });
    
    btnCancel.addEventListener("click", () => modalObj.closeFn());
    
    btnForward.addEventListener("click", async () => {
        if (selectedChats.size === 0) {
            alert("Select at least one chat to forward to.");
            return;
        }
        
        const oldText = btnForward.textContent;
        btnForward.textContent = "Forwarding...";
        btnForward.disabled = true;
        
        try {
            let successCount = 0;
            let failCount = 0;
            
            for (const destChatId of selectedChats) {
                for (const msg of messages) {
                    try {
                        let finalAttachment = null;
                        
                        // For attachments: re-upload a copy to ensure destination storage rules pass
                        if (msg.attachment && msg.attachment.url) {
                            try {
                                const response = await fetch(msg.attachment.url);
                                if (!response.ok) throw new Error("Failed to fetch attachment");
                                const blob = await response.blob();
                                const file = new File([blob], msg.attachment.name || "forwarded_file", { type: msg.attachment.type || blob.type });
                                
                                if (file.size > 5 * 1024 * 1024) throw new Error("File exceeds 5MB limit");
                                
                                finalAttachment = await uploadAttachment(destChatId, file);
                            } catch (err) {
                                console.error("Attachment forward failed:", err);
                                throw new Error("Attachment transfer failed");
                            }
                        }
                        
                        await sendMessage(destChatId, msg.text || "", msg.type || "text", finalAttachment, null, true);
                        successCount++;
                    } catch (e) {
                        console.error("Forward operation error:", e);
                        failCount++;
                    }
                }
            }
            
            alert(`Forwarded: ${successCount} successful, ${failCount} failed.`);
            modalObj.closeFn();
            
            state.selectedMessageIds.clear();
            const btnCancelSel = document.getElementById("btn-cancel-selection");
            if (btnCancelSel) btnCancelSel.click();
        } catch (e) {
            console.error(e);
            alert("An error occurred during forwarding.");
        } finally {
            btnForward.textContent = oldText;
            btnForward.disabled = false;
        }
    });
    
    actionRow.appendChild(btnCancel);
    actionRow.appendChild(btnForward);
    content.appendChild(actionRow);
    
    const modalObj = createModalOverlay("Forward Message", content);
}

export function openGroupInfoModal(chatData) {
    const content = createElement("div", "modal-content");
    const count = chatData.participants?.length || 0;
    const title = createElement("h3", "", { textContent: `Participants (${count})`, style: "margin-bottom: 8px;" });
    content.appendChild(title);
    
    const results = createElement("div", "search-results");
    results.style.maxHeight = "220px";
    results.style.overflowY = "auto";
    
    // Load participant profiles efficiently in parallel
    if (chatData.participants?.length) {
        Promise.all(chatData.participants.map(uid => fetchProfile(uid))).then((profiles) => {
            results.innerHTML = "";
            for (let i = 0; i < chatData.participants.length; i++) {
                const uid = chatData.participants[i];
                const prof = profiles[i] || {};
                const row = createElement("div", "user-row", { style: "display: flex; align-items: center; gap: 8px; padding: 6px;" });
                row.appendChild(createElement("img", "avatar small", { src: safeSrc(prof.photoURL) }));
                
                let displayName = prof.nickname || prof.fullName || prof.name || "User";
                if (uid === state.currentUser?.uid) displayName += " (You)";
                
                const nameEl = createElement("span", "", { textContent: displayName });
                row.appendChild(nameEl);
                
                let badges = [];
                if (chatData.createdBy === uid) badges.push("Owner");
                if (chatData.admins && chatData.admins.includes(uid) && chatData.createdBy !== uid) badges.push("Admin");
                
                if (badges.length > 0) {
                    row.appendChild(createElement("span", "", { textContent: ` [${badges.join(", ")}]`, style: "font-size: 11px; color: var(--primary);" }));
                }
                results.appendChild(row);
            }
        }).catch(err => {
            results.innerHTML = '<div style="padding: 8px; color: var(--text-muted);">Failed to load participants.</div>';
        });
    }
    
    content.appendChild(results);
    
    // Leave Group button
    const leaveBtn = createElement("button", "btn", { textContent: "Leave Group", style: "background: var(--error); color: white; width: 100%; margin-top: 16px;" });
    leaveBtn.addEventListener("click", async () => {
        if (chatData.createdBy === state.currentUser?.uid) {
            alert("Group owners cannot leave without transferring ownership.");
            return;
        }
        if (confirm("Are you sure you want to leave this group?")) {
            leaveBtn.disabled = true;
            leaveBtn.textContent = "Leaving...";
            try {
                await leaveGroup(chatData.id);
                modalObj.closeFn();
                if (state.activeChatId === chatData.id) {
                    clearRoomState();
                    state.activeChatId = null;
                    document.getElementById("active-chat")?.classList.add("hidden");
                    document.getElementById("chat-area")?.classList.add("empty");
                    document.getElementById("chat-area")?.classList.remove("active");
                }
            } catch (err) {
                alert("Failed to leave group: " + (err.message || "Unknown error"));
                leaveBtn.disabled = false;
                leaveBtn.textContent = "Leave Group";
            }
        }
    });
    content.appendChild(leaveBtn);
    
    const modalObj = createModalOverlay("Group Info", content);
}

export function openContactInfoModal(chatData) {
    const otherUid = chatData.participants?.find(u => u !== state.currentUser?.uid);
    if (!otherUid) return;
    
    fetchProfile(otherUid).then((prof) => {
        const content = createElement("div", "modal-content text-center");
        content.style.display = "flex";
        content.style.flexDirection = "column";
        content.style.alignItems = "center";
        content.style.gap = "14px";
        
        const img = createElement("img", "avatar", { src: safeSrc(prof.photoURL) });
        img.style.width = "90px";
        img.style.height = "90px";
        img.style.borderRadius = "50%";
        
        const nameEl = createElement("h2", "", { textContent: prof.nickname || prof.fullName || prof.name || "User" });
        const emailEl = createElement("p", "text-muted", { textContent: prof.email || "No email", style: "font-size: 13px;" });
        
        content.appendChild(img);
        content.appendChild(nameEl);
        content.appendChild(emailEl);
        
        const isBlocked = state.blockedUserIds.has(otherUid);
        const blockBtn = createElement("button", "btn", { 
            textContent: isBlocked ? "Unblock User" : "Block User",
            style: isBlocked ? "background: var(--text-muted); color: white;" : "background: var(--error); color: white;"
        });
        
        blockBtn.addEventListener("click", async () => {
            blockBtn.disabled = true;
            try {
                if (state.blockedUserIds.has(otherUid)) {
                    await unblockUser(otherUid);
                    blockBtn.textContent = "Block User";
                    blockBtn.style.background = "var(--error)";
                } else {
                    await blockUser(otherUid);
                    blockBtn.textContent = "Unblock User";
                    blockBtn.style.background = "var(--text-muted)";
                }
            } catch (err) {
                alert("Action failed: " + (err.message || "Unknown error"));
            } finally {
                blockBtn.disabled = false;
            }
        });
        
        content.appendChild(blockBtn);
        createModalOverlay("Contact Info", content);
    }).catch(err => {
        console.error(err);
        alert("Failed to load contact info.");
    });
}
