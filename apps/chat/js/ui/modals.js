import { searchUsers, blockUser, unblockUser, updateProfile, fetchProfile } from "../services/users.js";
import { 
    createDirectMessage, createGroup, leaveGroup, updateGroupName, 
    updateGroupIcon, addGroupMembers, removeGroupMember, toggleGroupAdmin, deleteGroup 
} from "../services/chats.js";
import { sendMessage } from "../services/messages.js";
import { uploadAttachment } from "../services/media.js";
import { logout } from "../auth.js";
import { state, clearRoomState } from "../state.js";
import { createElement, safeSrc } from "../utils/dom.js";
import { formatTime, formatDate } from "../utils/timestamps.js";
import { submitComplaint, fetchComplaints, deleteComplaint, updateComplaintStatus, isAppOwner } from "../services/help.js";
import { openChat } from "./chat.js";

export function initModals() {
    document.getElementById("btn-search-network")?.addEventListener("click", openSearchNetworkModal);
    document.getElementById("btn-new-chat")?.addEventListener("click", openSearchNetworkModal);
    document.getElementById("btn-new-group")?.addEventListener("click", openNewGroupModal);
    document.getElementById("btn-settings")?.addEventListener("click", openSettingsModal);
    document.getElementById("btn-help")?.addEventListener("click", openHelpModal);
    document.getElementById("btn-owner-dashboard")?.addEventListener("click", openOwnerDashboardModal);
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

export async function openSearchNetworkModal() {
    const content = createElement("div", "modal-content");
    content.style.width = "420px";
    content.style.maxWidth = "90vw";

    const subtitle = createElement("p", "", {
        textContent: "Discover contacts across the Aksh Network or search by name / email.",
        style: "font-size: 13px; color: var(--text-muted); margin-bottom: 4px;"
    });
    content.appendChild(subtitle);

    const input = createElement("input", "modal-input", { placeholder: "Search users by name or email..." });
    const results = createElement("div", "search-results");
    results.style.maxHeight = "280px";
    results.style.overflowY = "auto";
    results.style.marginTop = "8px";

    async function executeSearch(query = "") {
        results.innerHTML = '<div style="padding: 16px; color: var(--text-muted); text-align: center;">Loading network contacts...</div>';
        try {
            const users = await searchUsers(query);
            results.innerHTML = "";

            if (!users || users.length === 0) {
                results.innerHTML = '<div style="padding: 16px; color: var(--text-muted); text-align: center;">No matching users found in the network.</div>';
                return;
            }

            users.forEach(u => {
                if (u.uid === state.currentUser?.uid) return;

                const row = createElement("div", "user-row", { 
                    style: "display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px; cursor: pointer; border-radius: 8px; transition: background 0.15s;" 
                });

                const left = createElement("div", "", { style: "display: flex; align-items: center; gap: 10px; overflow: hidden;" });
                left.appendChild(createElement("img", "avatar small", { src: safeSrc(u.photoURL) }));

                const infoCol = createElement("div", "", { style: "overflow: hidden;" });
                const nameRow = createElement("div", "", { style: "display: flex; align-items: center; gap: 6px;" });
                const nameSpan = createElement("span", "", { 
                    textContent: u.nickname || u.fullName || "User",
                    style: "font-weight: 500; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                });
                nameRow.appendChild(nameSpan);

                if (u.isOwner) {
                    const ownerBadge = createElement("span", "", {
                        textContent: "👑 Owner",
                        style: "font-size: 10px; font-weight: 600; background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 6px;"
                    });
                    nameRow.appendChild(ownerBadge);
                }

                if (u.isBlocked) {
                    const blockedBadge = createElement("span", "", {
                        textContent: "🚫 Blocked",
                        style: "font-size: 10px; font-weight: 600; background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 6px;"
                    });
                    nameRow.appendChild(blockedBadge);
                }

                infoCol.appendChild(nameRow);

                if (u.email) {
                    const emailSpan = createElement("span", "", {
                        textContent: u.email,
                        style: "font-size: 11px; color: var(--text-muted); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                    });
                    infoCol.appendChild(emailSpan);
                }

                left.appendChild(infoCol);
                row.appendChild(left);

                // Check if existing DM chat exists
                const existingChat = (state.chats || []).find(c => 
                    c.type === "dm" && 
                    Array.isArray(c.participants) && 
                    c.participants.includes(u.uid)
                );

                const actionSpan = createElement("span", "", {
                    textContent: existingChat ? "Chat" : "Start",
                    style: "font-size: 12px; font-weight: 500; color: var(--primary); padding: 4px 8px; border-radius: 4px; background: var(--bg-secondary);"
                });
                row.appendChild(actionSpan);

                row.addEventListener("click", async () => {
                    if (u.isBlocked) {
                        if (confirm(`You have blocked ${u.nickname || u.fullName || "this user"}. Unblock to send messages?`)) {
                            try {
                                await unblockUser(u.uid);
                            } catch (e) {
                                alert("Failed to unblock: " + e.message);
                                return;
                            }
                        } else {
                            return;
                        }
                    }

                    try {
                        let targetChatId = null;
                        let targetChatData = null;

                        if (existingChat) {
                            targetChatId = existingChat.id;
                            targetChatData = {
                                ...existingChat,
                                title: u.nickname || u.fullName || "User",
                                avatar: u.photoURL
                            };
                        } else {
                            targetChatId = await createDirectMessage(u.uid);
                            targetChatData = {
                                id: targetChatId,
                                type: "dm",
                                participants: [state.currentUser.uid, u.uid],
                                title: u.nickname || u.fullName || "User",
                                avatar: u.photoURL
                            };
                        }

                        modalObj.closeFn();
                        openChat(targetChatId, targetChatData);
                    } catch (err) {
                        alert(err.message || "Failed to start direct message");
                    }
                });

                results.appendChild(row);
            });
        } catch (err) {
            results.innerHTML = '<div style="padding: 16px; color: var(--error); text-align: center;">Error searching network users.</div>';
        }
    }

    let searchTimeout = null;
    input.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            executeSearch(e.target.value);
        }, 250);
    });

    content.appendChild(input);
    content.appendChild(results);
    const modalObj = createModalOverlay("Search Network", content);
    
    // Initial fetch of discoverable contacts
    executeSearch("");
    setTimeout(() => input.focus(), 50);
}

export function openNewChatModal() {
    return openSearchNetworkModal();
}

export function openNewGroupModal() {
    const content = createElement("div", "modal-content");
    const nameInput = createElement("input", "modal-input", { placeholder: "Group Name (max 50 chars)" });
    const searchInput = createElement("input", "modal-input", { placeholder: "Search users to add...", style: "margin-top: 8px;" });
    const results = createElement("div", "search-results");
    results.style.maxHeight = "200px";
    results.style.overflowY = "auto";
    const selectedDiv = createElement("div", "selected-users", { textContent: "Selected: 0 member(s)", style: "font-size: 13px; color: var(--text-muted); margin: 8px 0;" });
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
    
    const saveBtn = createElement("button", "btn btn-primary", { textContent: "Save Changes", style: "margin-top: 4px;" });
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

    // Help Centre Button
    const helpBtn = createElement("button", "btn", { textContent: "Help Centre", style: "background: var(--bg-secondary); border: 1px solid var(--border); margin-top: 4px;" });
    helpBtn.addEventListener("click", () => {
        modalObj.closeFn();
        openHelpModal();
    });
    content.appendChild(helpBtn);

    // Owner Dashboard Button (Owner only)
    if (isAppOwner()) {
        const ownerBtn = createElement("button", "btn", { textContent: "👑 Owner Dashboard", style: "background: #f59e0b; color: white; margin-top: 4px;" });
        ownerBtn.addEventListener("click", () => {
            modalObj.closeFn();
            openOwnerDashboardModal();
        });
        content.appendChild(ownerBtn);
    }
    
    // Sign out button
    const logoutBtn = createElement("button", "btn", { textContent: "Sign Out", style: "background: var(--error); color: white; margin-top: 12px;" });
    logoutBtn.addEventListener("click", async () => {
        modalObj.closeFn();
        await logout();
    });
    content.appendChild(logoutBtn);
    
    const modalObj = createModalOverlay("Settings", content);
}

/**
 * Help Centre Modal for Normal Users
 */
export function openHelpModal() {
    const content = createElement("div", "modal-content");
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.gap = "12px";

    const desc = createElement("p", "", { 
        textContent: "Need help or want to submit feedback? Send a message directly to the Aksh Studio administration.",
        style: "font-size: 13px; color: var(--text-muted);"
    });
    content.appendChild(desc);

    const userEmail = state.currentUser?.email || "No email";
    const userName = state.currentProfile?.fullName || state.currentUser?.displayName || "User";
    const userTag = createElement("div", "", { 
        textContent: `Submitting as: ${userName} (${userEmail})`,
        style: "font-size: 12px; background: var(--bg-secondary); padding: 8px; border-radius: 6px;"
    });
    content.appendChild(userTag);

    const subjectLabel = createElement("label", "", { textContent: "Subject", style: "font-size: 12px; font-weight: 600;" });
    const subjectInput = createElement("input", "modal-input", { placeholder: "Brief summary of your issue or request" });
    content.appendChild(subjectLabel);
    content.appendChild(subjectInput);

    const detailsLabel = createElement("label", "", { textContent: "Details / Description", style: "font-size: 12px; font-weight: 600;" });
    const detailsInput = createElement("textarea", "modal-input", { 
        placeholder: "Describe what happened or what you need assistance with...",
        style: "height: 100px; resize: vertical;"
    });
    content.appendChild(detailsLabel);
    content.appendChild(detailsInput);

    const submitBtn = createElement("button", "btn btn-primary", { textContent: "Submit Ticket", style: "margin-top: 8px;" });

    submitBtn.addEventListener("click", async () => {
        const subj = subjectInput.value.trim();
        const det = detailsInput.value.trim();

        if (!subj) {
            alert("Please enter a subject.");
            subjectInput.focus();
            return;
        }
        if (!det) {
            alert("Please provide details for your ticket.");
            detailsInput.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        try {
            await submitComplaint(subj, det);
            alert("Your request has been submitted successfully. The administration will review it shortly.");
            modalObj.closeFn();
        } catch (err) {
            alert("Failed to submit request: " + (err.message || "Unknown error"));
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Ticket";
        }
    });

    content.appendChild(submitBtn);
    const modalObj = createModalOverlay("Help Centre", content);
    setTimeout(() => subjectInput.focus(), 50);
}

/**
 * Owner Dashboard Modal for App Owner
 */
export async function openOwnerDashboardModal() {
    if (!isAppOwner()) {
        alert("Unauthorized access.");
        return;
    }

    const content = createElement("div", "modal-content");
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.gap = "14px";
    content.style.width = "480px";
    content.style.maxWidth = "90vw";

    const headerNote = createElement("p", "", { 
        textContent: "Viewing all submitted user tickets & complaints in real time.",
        style: "font-size: 13px; color: var(--text-muted);"
    });
    content.appendChild(headerNote);

    const listContainer = createElement("div", "tickets-list", {
        style: "max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;"
    });
    listContainer.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--text-muted);">Loading complaints database...</div>';
    content.appendChild(listContainer);

    const modalObj = createModalOverlay("👑 Owner Help Dashboard", content);

    async function loadTickets() {
        try {
            const tickets = await fetchComplaints();
            listContainer.innerHTML = "";

            if (tickets.length === 0) {
                listContainer.innerHTML = '<div style="text-align: center; padding: 32px; color: var(--text-muted); font-size: 14px;">No complaints or support tickets registered yet.</div>';
                return;
            }

            tickets.forEach(ticket => {
                const card = createElement("div", "ticket-card", {
                    style: "background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 6px;"
                });

                const topRow = createElement("div", "", { style: "display: flex; justify-content: space-between; align-items: flex-start;" });
                const subj = createElement("h4", "", { textContent: ticket.subject || "No Subject", style: "font-size: 14px; font-weight: 600;" });
                
                const isResolved = ticket.status === "Resolved";
                const statusBadge = createElement("span", "", {
                    textContent: ticket.status || "Unresolved",
                    style: `font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: ${isResolved ? '#d1fae5' : '#fee2e2'}; color: ${isResolved ? '#065f46' : '#991b1b'};`
                });
                topRow.appendChild(subj);
                topRow.appendChild(statusBadge);

                const detailsText = createElement("p", "", {
                    textContent: ticket.details || "",
                    style: "font-size: 13px; color: var(--text-main); white-space: pre-wrap; background: var(--bg-main); padding: 8px; border-radius: 6px; border: 1px solid var(--border);"
                });

                const metaRow = createElement("div", "", { 
                    style: "display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 2px;" 
                });
                const userSpan = createElement("span", "", { textContent: `From: ${ticket.name} (${ticket.email})` });
                const dateStr = ticket.date ? new Date(ticket.date).toLocaleString() : "Unknown date";
                const dateSpan = createElement("span", "", { textContent: dateStr });
                metaRow.appendChild(userSpan);
                metaRow.appendChild(dateSpan);

                const actionsRow = createElement("div", "", { style: "display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;" });
                
                const toggleBtn = createElement("button", "btn small", {
                    textContent: isResolved ? "Mark Unresolved" : "Mark Resolved",
                    style: "font-size: 12px; padding: 4px 10px; background: var(--bg-tertiary);"
                });
                toggleBtn.onclick = async () => {
                    toggleBtn.disabled = true;
                    try {
                        const newStatus = isResolved ? "Unresolved" : "Resolved";
                        await updateComplaintStatus(ticket.id, newStatus);
                        await loadTickets();
                    } catch (e) {
                        alert("Update failed: " + e.message);
                        toggleBtn.disabled = false;
                    }
                };

                const delBtn = createElement("button", "btn small", {
                    textContent: "Delete",
                    style: "font-size: 12px; padding: 4px 10px; background: var(--error); color: white;"
                });
                delBtn.onclick = async () => {
                    if (confirm("Permanently delete this ticket?")) {
                        delBtn.disabled = true;
                        try {
                            await deleteComplaint(ticket.id);
                            card.remove();
                            if (listContainer.children.length === 0) {
                                listContainer.innerHTML = '<div style="text-align: center; padding: 32px; color: var(--text-muted);">No complaints registered.</div>';
                            }
                        } catch (e) {
                            alert("Delete failed: " + e.message);
                            delBtn.disabled = false;
                        }
                    }
                };

                actionsRow.appendChild(toggleBtn);
                actionsRow.appendChild(delBtn);

                card.appendChild(topRow);
                card.appendChild(detailsText);
                card.appendChild(metaRow);
                card.appendChild(actionsRow);

                listContainer.appendChild(card);
            });
        } catch (err) {
            console.error("Dashboard error:", err);
            listContainer.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--error);">Error loading complaints: ${err.message}</div>`;
        }
    }

    loadTickets();
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

/**
 * Rich Group Management Modal
 */
export function openGroupInfoModal(chatData) {
    const content = createElement("div", "modal-content");
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.gap = "14px";

    const isOwner = chatData.createdBy === state.currentUser?.uid || isAppOwner();
    const isAdmin = isOwner || (chatData.admins && chatData.admins.includes(state.currentUser?.uid));

    // Group Header: Icon & Name
    const headerRow = createElement("div", "", { style: "display: flex; align-items: center; gap: 12px;" });
    const iconImg = createElement("img", "avatar", { src: safeSrc(chatData.icon) || "./chat-logo.png", style: "width: 56px; height: 56px;" });
    headerRow.appendChild(iconImg);

    const nameInfoCol = createElement("div", "", { style: "flex: 1;" });
    const nameEl = createElement("h3", "", { textContent: chatData.name || "Group", style: "font-size: 16px;" });
    const countEl = createElement("p", "", { 
        textContent: `${chatData.participants?.length || 0} participants • ${chatData.admins?.length || 0} admin(s)`,
        style: "font-size: 12px; color: var(--text-muted); margin-top: 2px;"
    });
    nameInfoCol.appendChild(nameEl);
    nameInfoCol.appendChild(countEl);
    headerRow.appendChild(nameInfoCol);
    content.appendChild(headerRow);

    // Admin Group Editing Section
    if (isAdmin) {
        const editSection = createElement("div", "", { 
            style: "display: flex; flex-direction: column; gap: 8px; padding: 10px; background: var(--bg-secondary); border-radius: 8px;" 
        });
        
        const editTitle = createElement("span", "", { textContent: "Edit Group Details (Admin)", style: "font-size: 12px; font-weight: 600; color: var(--primary);" });
        editSection.appendChild(editTitle);

        const nameEditRow = createElement("div", "", { style: "display: flex; gap: 6px;" });
        const nameEditInput = createElement("input", "modal-input", { value: chatData.name || "", placeholder: "New group name", style: "flex: 1; padding: 6px 10px;" });
        const saveNameBtn = createElement("button", "btn btn-primary small", { textContent: "Save", style: "padding: 6px 12px;" });
        
        saveNameBtn.onclick = async () => {
            const newName = nameEditInput.value.trim();
            if (!newName) return;
            saveNameBtn.disabled = true;
            try {
                await updateGroupName(chatData.id, newName);
                nameEl.textContent = newName;
                chatData.name = newName;
                if (state.activeChatId === chatData.id) {
                    const headerTitle = document.getElementById("chat-header-title");
                    if (headerTitle) headerTitle.textContent = newName;
                }
                alert("Group name updated.");
            } catch (err) {
                alert("Failed to update name: " + err.message);
            } finally {
                saveNameBtn.disabled = false;
            }
        };
        nameEditRow.appendChild(nameEditInput);
        nameEditRow.appendChild(saveNameBtn);
        editSection.appendChild(nameEditRow);

        // Icon URL or upload
        const iconEditRow = createElement("div", "", { style: "display: flex; gap: 6px;" });
        const iconInput = createElement("input", "modal-input", { value: chatData.icon || "", placeholder: "Icon image URL (https://...)", style: "flex: 1; padding: 6px 10px;" });
        const saveIconBtn = createElement("button", "btn btn-primary small", { textContent: "Set Icon", style: "padding: 6px 12px;" });

        saveIconBtn.onclick = async () => {
            const url = iconInput.value.trim();
            if (!url) return;
            saveIconBtn.disabled = true;
            try {
                await updateGroupIcon(chatData.id, url);
                iconImg.src = safeSrc(url);
                chatData.icon = url;
                if (state.activeChatId === chatData.id) {
                    const headerAvatar = document.getElementById("chat-header-avatar");
                    if (headerAvatar) headerAvatar.src = safeSrc(url);
                }
                alert("Group icon updated.");
            } catch (err) {
                alert("Failed to update icon: " + err.message);
            } finally {
                saveIconBtn.disabled = false;
            }
        };
        iconEditRow.appendChild(iconInput);
        iconEditRow.appendChild(saveIconBtn);
        editSection.appendChild(iconEditRow);

        content.appendChild(editSection);
    }

    // Add Member Button (Admin only)
    if (isAdmin) {
        const addMemberBtn = createElement("button", "btn btn-primary", { 
            textContent: "+ Add Participants",
            style: "width: 100%; font-size: 13px; padding: 8px 14px;"
        });
        addMemberBtn.onclick = () => {
            openAddGroupMembersModal(chatData, () => {
                modalObj.closeFn();
                openGroupInfoModal(chatData);
            });
        };
        content.appendChild(addMemberBtn);
    }

    // Participant List Header
    const listTitle = createElement("p", "", { textContent: "Participants", style: "font-weight: 600; font-size: 13px;" });
    content.appendChild(listTitle);

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
                const row = createElement("div", "user-row", { 
                    style: "display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px; border-bottom: 1px solid var(--border);" 
                });
                
                const leftDiv = createElement("div", "", { style: "display: flex; align-items: center; gap: 8px; overflow: hidden;" });
                leftDiv.appendChild(createElement("img", "avatar small", { src: safeSrc(prof.photoURL) }));
                
                let displayName = prof.nickname || prof.fullName || prof.name || "User";
                if (uid === state.currentUser?.uid) displayName += " (You)";
                
                const nameSpan = createElement("span", "", { textContent: displayName, style: "font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" });
                leftDiv.appendChild(nameSpan);

                const isTargetOwner = chatData.createdBy === uid;
                const isTargetAdmin = chatData.admins && chatData.admins.includes(uid);
                
                if (isTargetOwner) {
                    leftDiv.appendChild(createElement("span", "", { textContent: "[Owner]", style: "font-size: 11px; font-weight: 600; color: #f59e0b;" }));
                } else if (isTargetAdmin) {
                    leftDiv.appendChild(createElement("span", "", { textContent: "[Admin]", style: "font-size: 11px; font-weight: 600; color: var(--primary);" }));
                }

                row.appendChild(leftDiv);

                // Admin action controls on other participants
                if (isAdmin && uid !== state.currentUser?.uid && !isTargetOwner) {
                    const actionGroup = createElement("div", "", { style: "display: flex; gap: 4px;" });

                    // Toggle Admin Button
                    const toggleAdminBtn = createElement("button", "icon-btn small", { 
                        title: isTargetAdmin ? "Dismiss as Admin" : "Make Group Admin",
                        innerHTML: isTargetAdmin 
                            ? '<span class="material-symbols-rounded" style="font-size: 16px;">shield</span>' 
                            : '<span class="material-symbols-rounded" style="font-size: 16px;">verified_user</span>'
                    });
                    toggleAdminBtn.onclick = async () => {
                        try {
                            await toggleGroupAdmin(chatData.id, uid, !isTargetAdmin);
                            modalObj.closeFn();
                            openGroupInfoModal(chatData);
                        } catch (e) {
                            alert("Action failed: " + e.message);
                        }
                    };
                    actionGroup.appendChild(toggleAdminBtn);

                    // Remove Member Button
                    const removeBtn = createElement("button", "icon-btn small", { 
                        title: "Remove from group",
                        innerHTML: '<span class="material-symbols-rounded" style="font-size: 16px; color: var(--error);">person_remove</span>'
                    });
                    removeBtn.onclick = async () => {
                        if (confirm(`Remove ${displayName} from group?`)) {
                            try {
                                await removeGroupMember(chatData.id, uid);
                                row.remove();
                                countEl.textContent = `${chatData.participants?.length || 0} participants`;
                            } catch (e) {
                                alert("Failed to remove member: " + e.message);
                            }
                        }
                    };
                    actionGroup.appendChild(removeBtn);

                    row.appendChild(actionGroup);
                }

                results.appendChild(row);
            }
        }).catch(err => {
            results.innerHTML = '<div style="padding: 8px; color: var(--text-muted);">Failed to load participants.</div>';
        });
    }
    content.appendChild(results);

    // Leave Group button
    const leaveBtn = createElement("button", "btn", { textContent: "Leave Group", style: "background: var(--bg-tertiary); color: var(--text-main); width: 100%; margin-top: 10px;" });
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

    // Delete Group button (for Owner or Group Admin)
    if (isAdmin) {
        const delGroupBtn = createElement("button", "btn", { 
            textContent: "Delete Group", 
            style: "background: var(--error); color: white; width: 100%; margin-top: 4px;" 
        });
        delGroupBtn.addEventListener("click", async () => {
            if (confirm("Are you sure you want to permanently delete this group? All messages and group data will be erased.")) {
                delGroupBtn.disabled = true;
                delGroupBtn.textContent = "Deleting...";
                try {
                    await deleteGroup(chatData.id);
                    modalObj.closeFn();
                    if (state.activeChatId === chatData.id) {
                        clearRoomState();
                        state.activeChatId = null;
                        document.getElementById("active-chat")?.classList.add("hidden");
                        document.getElementById("chat-area")?.classList.add("empty");
                        document.getElementById("chat-area")?.classList.remove("active");
                    }
                } catch (err) {
                    alert("Failed to delete group: " + (err.message || "Permission denied"));
                    delGroupBtn.disabled = false;
                    delGroupBtn.textContent = "Delete Group";
                }
            }
        });
        content.appendChild(delGroupBtn);
    }
    
    const modalObj = createModalOverlay("Group Info", content);
}

/**
 * Modal to add members to an existing group
 */
export function openAddGroupMembersModal(chatData, onSuccess) {
    const content = createElement("div", "modal-content");
    const searchInput = createElement("input", "modal-input", { placeholder: "Search users to add..." });
    const results = createElement("div", "search-results");
    results.style.maxHeight = "220px";
    results.style.overflowY = "auto";
    const selectedDiv = createElement("div", "selected-users", { textContent: "Selected: 0 member(s)", style: "font-size: 13px; color: var(--text-muted); margin: 8px 0;" });
    const addBtn = createElement("button", "btn btn-primary", { textContent: "Add to Group", disabled: true, style: "width: 100%;" });

    let selectedUids = new Set();
    const existingParticipants = new Set(chatData.participants || []);

    function renderSelected() {
        selectedDiv.textContent = `Selected: ${selectedUids.size} member(s)`;
        addBtn.disabled = selectedUids.size === 0;
    }

    searchInput.addEventListener("input", async (e) => {
        const term = e.target.value.trim();
        if (!term) { results.innerHTML = ""; return; }
        const users = await searchUsers(term);
        results.innerHTML = "";
        let count = 0;
        users.forEach(u => {
            if (existingParticipants.has(u.uid)) return;
            count++;
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
        if (count === 0) {
            results.innerHTML = '<div style="padding: 12px; color: var(--text-muted); text-align: center;">No non-member users found.</div>';
        }
    });

    addBtn.addEventListener("click", async () => {
        if (selectedUids.size === 0) return;
        addBtn.disabled = true;
        addBtn.textContent = "Adding...";
        try {
            await addGroupMembers(chatData.id, Array.from(selectedUids));
            alert("Members added successfully!");
            modalObj.closeFn();
            if (onSuccess) onSuccess();
        } catch (err) {
            alert("Failed to add members: " + err.message);
            addBtn.disabled = false;
            addBtn.textContent = "Add to Group";
        }
    });

    content.appendChild(searchInput);
    content.appendChild(selectedDiv);
    content.appendChild(results);
    content.appendChild(addBtn);

    const modalObj = createModalOverlay("Add Participants", content);
    setTimeout(() => searchInput.focus(), 50);
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
