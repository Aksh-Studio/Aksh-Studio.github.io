import { db, doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc, arrayRemove } from './firebase.js';
import { currentUser } from './auth.js';

const ownerEmail = 'akshat124.am12@gmail.com';
let uploadedGroupIconBase64 = null;

export const initGroupEngine = () => {
    const headerInfo = document.getElementById('header-room-info');
    const infoPanel = document.getElementById('group-info-panel');
    const closeBtn = document.getElementById('btn-close-info');

    if (headerInfo && infoPanel) {
        headerInfo.addEventListener('click', () => {
            const roomName = document.getElementById('active-room-name').innerText;
            const roomIcon = document.getElementById('active-room-icon').innerText;
            
            document.getElementById('info-room-name').innerText = roomName;
            document.getElementById('info-avatar-icon').innerText = roomIcon;
            
            populateContactInfoPanel();
            infoPanel.style.display = 'flex';
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            infoPanel.style.display = 'none';
        });
    }
};

const populateContactInfoPanel = async () => {
    const membersListEl = document.getElementById('group-members-list');
    if (!membersListEl) return;
    membersListEl.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center;">Loading participants...</p>';

    const currentRoomData = window.currentRoomData;
    const curId = currentUser?.id || currentUser?.uid;
    const isOwner = currentUser?.isOwner || String(currentUser?.email || '').toLowerCase().trim() === ownerEmail;
    const isAdmin = Array.isArray(currentRoomData?.admins) && currentRoomData.admins.includes(curId);
    const canKick = isOwner || isAdmin;

    const safeParticipants = Array.isArray(currentRoomData?.participants) ? currentRoomData.participants : [];

    if (safeParticipants.length === 0) {
        membersListEl.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center;">Direct Chat</p>';
        return;
    }

    membersListEl.innerHTML = '';
    for (const uid of safeParticipants) {
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            const u = userDoc.exists() ? userDoc.data() : {};
            const name = u.fullName || u.name || 'User';
            const isMemAdmin = Array.isArray(currentRoomData?.admins) && currentRoomData.admins.includes(uid);
            
            const kickBtn = (uid !== curId && canKick && currentRoomData?.type === 'group') 
                ? `<button onclick="window.removeGroupMember('${uid}')" style="background: #ea0038; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer;">Remove</button>` 
                : '';

            membersListEl.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-size: 14px; font-weight: 600; color: var(--text-main);">${name}</span>
                        <span style="font-size: 11px; color: var(--primary);">${isMemAdmin ? 'Admin' : 'Member'}</span>
                    </div>
                    ${kickBtn}
                </div>
            `;
        } catch(e) {}
    }
};

export const injectGroupAdminModal = () => {
    if (document.getElementById('group-admin-modal')) return;
    const modalHTML = `
        <div id="group-admin-modal" class="guest-overlay" style="display: none; z-index: 10002;">
            <div class="guest-modal" style="padding: 25px; width: 90%; max-width: 400px; max-height: 90vh; overflow-y: auto;">
                <h3 style="margin-bottom: 15px; color: var(--primary);">Group Settings</h3>
                <div id="group-edit-section">
                    <input type="text" id="edit-group-name" placeholder="Group Name" style="width: 100%; padding: 12px; margin-bottom: 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text-main);">
                    <input type="text" id="edit-group-icon" placeholder="Or paste Logo URL here..." style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text-main);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                        <img id="group-icon-preview" src="https://cdn-icons-png.flaticon.com/512/149/149071.png" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">
                        <button id="btn-upload-group-icon" style="flex: 1; padding: 10px; background: transparent; color: var(--primary); border: 1px dashed var(--primary); border-radius: 8px; cursor: pointer; font-size: 12px;">Upload Image</button>
                        <input type="file" id="hidden-group-icon-input" accept="image/*" style="display: none;">
                    </div>
                </div>
                <div id="add-member-section">
                    <h4 style="font-size: 13px; text-align: left; margin-bottom: 8px; color: var(--text-muted);">Add Member</h4>
                    <input type="text" id="search-member-input" placeholder="Search by name or email..." style="width: 100%; padding: 12px; margin-bottom: 5px; border-radius: 8px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text-main);" autocomplete="off">
                    <div id="search-member-results" style="max-height: 180px; overflow-y: auto; margin-bottom: 15px; border: 1px solid var(--border); border-radius: 8px; padding: 5px; display: none;"></div>
                </div>
                <div id="manage-members-section">
                    <h4 style="font-size: 13px; text-align: left; margin-bottom: 8px; color: var(--text-muted);">Participants</h4>
                    <div id="admin-member-list" style="max-height: 150px; overflow-y: auto; margin-bottom: 15px; border: 1px solid var(--border); border-radius: 8px; padding: 5px;"></div>
                </div>
                <div id="transfer-admin-section">
                    <h4 style="font-size: 13px; text-align: left; margin-bottom: 8px; color: var(--text-muted);">Transfer Admin Status</h4>
                    <select id="transfer-admin-select" style="width: 100%; padding: 12px; margin-bottom: 20px; border-radius: 8px; border: 1px solid var(--border); background: var(--app-bg); color: var(--text-main);">
                        <option value="">Select a member...</option>
                    </select>
                </div>
                <button id="btn-save-group" style="width: 100%; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; margin-bottom: 10px; cursor: pointer; font-weight: 600;">Save Changes</button>
                <button id="btn-delete-group" style="width: 100%; padding: 12px; background: #ea0038; color: white; border: none; border-radius: 8px; margin-bottom: 10px; cursor: pointer; font-weight: 600;">Delete Group</button>
                <button id="btn-cancel-group" style="width: 100%; padding: 12px; background: transparent; color: var(--text-muted); border: none; cursor: pointer;">Close</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('btn-cancel-group').addEventListener('click', () => { 
        document.getElementById('group-admin-modal').style.display = 'none'; 
        uploadedGroupIconBase64 = null; 
    });

    document.getElementById('btn-upload-group-icon').addEventListener('click', () => document.getElementById('hidden-group-icon-input').click());
    document.getElementById('hidden-group-icon-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !file.type.startsWith('image/')) return alert("Only images allowed.");
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 300;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                uploadedGroupIconBase64 = canvas.toDataURL('image/jpeg', 0.8);
                document.getElementById('group-icon-preview').src = uploadedGroupIconBase64;
                document.getElementById('edit-group-icon').value = ''; 
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('btn-save-group').addEventListener('click', async () => {
        const currentRoomId = window.appState?.activeChatId;
        if (!currentRoomId) return;

        const newName = document.getElementById('edit-group-name').value.trim();
        const urlIcon = document.getElementById('edit-group-icon').value.trim();
        const newAdminId = document.getElementById('transfer-admin-select').value;
        const updates = {};

        if (newName) updates.name = newName;
        if (urlIcon) updates.icon = urlIcon; 
        else if (uploadedGroupIconBase64) updates.icon = uploadedGroupIconBase64;
        if (newAdminId) updates.admins = [newAdminId]; 
        
        if (Object.keys(updates).length > 0) {
            try { 
                await setDoc(doc(db, "chats", currentRoomId), updates, { merge: true }); 
                alert("Group settings saved."); 
            } catch(e) { 
                alert("Error saving settings."); 
            }
        }
        document.getElementById('group-admin-modal').style.display = 'none';
        uploadedGroupIconBase64 = null;
    });

    document.getElementById('btn-delete-group').addEventListener('click', async () => {
        const currentRoomId = window.appState?.activeChatId;
        if (!currentRoomId) return;

        if (confirm("WARNING: This will permanently delete this group and all messages. Proceed?")) {
            try {
                const msgsSnap = await getDocs(collection(db, `chats/${currentRoomId}/messages`));
                const deletePromises = [];
                msgsSnap.forEach(d => deletePromises.push(deleteDoc(doc(db, `chats/${currentRoomId}/messages`, d.id))));
                await Promise.all(deletePromises);
                await deleteDoc(doc(db, "chats", currentRoomId));
                document.getElementById('group-admin-modal').style.display = 'none';
                window.location.reload(); 
            } catch(e) { alert("Insufficient Permissions to delete group."); }
        }
    });
};

export const populateGroupManagement = async (participants, admins) => {
    const listEl = document.getElementById('admin-member-list');
    const transferSelectEl = document.getElementById('transfer-admin-select');
    const searchInput = document.getElementById('search-member-input');
    const searchResults = document.getElementById('search-member-results');
    
    if (!listEl || !transferSelectEl || !searchInput) return;
    
    listEl.innerHTML = '';
    transferSelectEl.innerHTML = '<option value="">Select a member to make Admin...</option>';
    searchResults.innerHTML = '<p style="font-size:12px; color:var(--text-muted); padding: 5px;">Loading network...</p>';
    searchResults.style.display = 'block';
    searchInput.value = '';

    const curId = currentUser?.id || currentUser?.uid;
    const isOwner = currentUser?.isOwner || String(currentUser?.email || '').toLowerCase().trim() === ownerEmail;
    const isAdmin = Array.isArray(admins) && admins.includes(curId);
    const canEdit = isOwner || isAdmin;

    const safeParticipants = Array.isArray(participants) ? participants : [];

    for (const uid of safeParticipants) {
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                const u = userDoc.data();
                const safeEmail = String(u.email || '');
                const name = u.fullName || u.firstName || (safeEmail ? safeEmail.split('@')[0] : 'User');
                const isMemAdmin = Array.isArray(admins) && admins.includes(uid);
                
                if (!isMemAdmin) transferSelectEl.innerHTML += `<option value="${uid}">${name}</option>`;

                const kickBtnHTML = (uid !== curId && canEdit) ? `<button onclick="window.removeGroupMember('${uid}')" style="background: #ea0038; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer;">Remove</button>` : '';

                listEl.innerHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--app-bg);">
                        <span style="font-size: 13px; color: var(--text-main);">${name} <span style="color:var(--primary); font-size:10px;">${isMemAdmin ? '(Admin)' : ''}</span></span>
                        ${kickBtnHTML}
                    </div>
                `;
            }
        } catch(e) {}
    }

    let allUsers = [];
    try {
        const snap = await getDocs(collection(db, "users"));
        snap.forEach(d => {
            const u = d.data();
            const safeEmail = u.email ? String(u.email).trim() : '';
            const safeName = (u.fullName || u.name || u.firstName || (safeEmail ? safeEmail.split('@')[0] : 'Unknown User')).trim();
            if (!safeName || (safeName === 'Unknown User' && !safeEmail)) return;
            const searchStr = `${safeName.toLowerCase()} ${safeEmail.toLowerCase()}`;
            allUsers.push({ id: d.id, name: safeName, email: safeEmail, searchStr: searchStr });
        });
        allUsers.sort((a, b) => a.name.localeCompare(b.name));
    } catch(e) {}

    const renderSearch = (term = '') => {
        searchResults.style.display = 'block';
        const cleanTerms = term.trim().toLowerCase().split(' ').filter(Boolean);

        const filtered = allUsers.filter(u => {
            if (cleanTerms.length === 0) return true; 
            return cleanTerms.every(t => u.searchStr.includes(t));
        });

        if (filtered.length === 0) {
            searchResults.innerHTML = '<p style="font-size:12px; color:var(--text-muted); padding: 5px;">No network users found.</p>';
            return;
        }

        let htmlString = '';
        filtered.forEach(u => {
            const isAlreadyInGroup = safeParticipants.includes(u.id);
            const btnHTML = isAlreadyInGroup 
                ? `<button disabled style="background: transparent; color: var(--text-muted); border: 1px solid var(--border); border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: not-allowed;">Added</button>`
                : `<button onclick="window.addGroupMember('${u.id}')" style="background: var(--primary); color: white; border: none; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer;">Add</button>`;

            htmlString += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; flex-direction: column; text-align: left; overflow: hidden; max-width: 70%;">
                        <span style="font-size: 13px; color: var(--text-main); font-weight: 600; white-space: nowrap; text-overflow: ellipsis;">${u.name}</span>
                        <span style="font-size: 11px; color: var(--text-muted); white-space: nowrap; text-overflow: ellipsis;">${u.email}</span>
                    </div>
                    ${btnHTML}
                </div>
            `;
        });
        searchResults.innerHTML = htmlString;
    };

    renderSearch(); 
    const newInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newInput, searchInput);
    newInput.addEventListener('input', (e) => renderSearch(e.target.value));
};

window.addGroupMember = async (newMemberId) => {
    const currentRoomId = window.appState?.activeChatId;
    const currentRoomData = window.currentRoomData;
    if (!currentRoomId) return;

    try {
        const safeParticipants = Array.isArray(currentRoomData?.participants) ? currentRoomData.participants : [];
        if (safeParticipants.includes(newMemberId)) return;
        const updatedParticipants = [...safeParticipants, newMemberId];
        await setDoc(doc(db, "chats", currentRoomId), { participants: updatedParticipants }, { merge: true });
        document.getElementById('search-member-input').value = '';
        document.getElementById('search-member-results').innerHTML = '';
        document.getElementById('search-member-results').style.display = 'none';
    } catch(e) { alert("Failed to add member."); }
};

window.removeGroupMember = async (uidToRemove) => {
    const activeChatId = window.appState?.activeChatId;
    const activeChatData = window.currentRoomData;
    const curId = window.currentUserAuth?.id || window.currentUserAuth?.uid;
    const isOwner = window.currentUserAuth?.isOwner || window.currentUserAuth?.email === ownerEmail;
    
    if (!activeChatId || !activeChatData || !curId) return;

    const isAdmin = activeChatData.admins?.includes(curId);

    if (!isAdmin && !isOwner) {
        alert("Only group admins or the Owner can remove members.");
        return;
    }
    
    if (confirm("Remove user from group?")) {
        await updateDoc(doc(db, "chats", activeChatId), {
            participants: arrayRemove(uidToRemove),
            admins: arrayRemove(uidToRemove)
        });
        alert("User removed successfully.");
    }
};
