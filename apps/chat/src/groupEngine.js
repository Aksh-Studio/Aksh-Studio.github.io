import { db, auth, doc, getDoc, updateDoc, arrayUnion, arrayRemove, deleteDoc, writeBatch, collection, getDocs } from './firebase.js';

const userProfileCache = new Map();

export async function getCachedUserProfile(uid) {
    if (userProfileCache.has(uid)) {
        const cached = userProfileCache.get(uid);
        if (Date.now() - cached.timestamp < 60000) {
            return cached.data;
        }
    }
    
    try {
        const docSnap = await getDoc(doc(db, 'users', uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            userProfileCache.set(uid, { data, timestamp: Date.now() });
            return data;
        }
    } catch (error) {
        console.error("Error fetching user profile", error);
    }
    return null;
}

export function injectGroupSettingsModal(roomId, roomData) {
    const modal = document.createElement('div');
    modal.id = 'group-settings-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Group Settings</h2>
            <input type="text" id="group-name-input" placeholder="Group Name" value="${roomData.name || ''}" />
            <input type="text" id="group-icon-input" placeholder="Icon URL" value="${roomData.iconUrl || ''}" />
            <button id="save-group-settings">Save</button>
            <div id="group-members-list"></div>
            <button id="delete-group-btn" style="color:red;">Delete Group</button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('save-group-settings').onclick = async () => {
        const newName = document.getElementById('group-name-input').value;
        const newIcon = document.getElementById('group-icon-input').value;
        await updateGroupSettings(roomId, newName, newIcon);
    };

    document.getElementById('delete-group-btn').onclick = async () => {
        await deleteGroupComplete(roomId);
        modal.remove();
    };
    
    // Add logic to populate members and add kick/promote buttons if admin
}

export async function updateGroupSettings(roomId, name, iconUrl) {
    try {
        await updateDoc(doc(db, 'rooms', roomId), { name, iconUrl });
        console.log("Group settings updated");
    } catch (error) {
        console.error("Error updating group settings", error);
    }
}

export async function addMember(roomId, uid) {
    try {
        await updateDoc(doc(db, 'rooms', roomId), { members: arrayUnion(uid) });
    } catch (error) {
        console.error("Error adding member", error);
    }
}

export async function kickMember(roomId, uid, requesterId, roomData) {
    if (roomData.owner === requesterId || roomData.admins?.includes(requesterId)) {
        try {
            await updateDoc(doc(db, 'rooms', roomId), { members: arrayRemove(uid) });
        } catch (error) {
            console.error("Error kicking member", error);
        }
    } else {
        console.warn("Unauthorized to kick members");
    }
}

export async function promoteAdmin(roomId, uid, requesterId, roomData) {
    if (roomData.owner === requesterId) {
        try {
            await updateDoc(doc(db, 'rooms', roomId), { admins: arrayUnion(uid) });
        } catch (error) {
            console.error("Error promoting admin", error);
        }
    }
}

export async function deleteGroupComplete(roomId) {
    try {
        const batch = writeBatch(db);
        const messagesRef = collection(db, 'rooms', roomId, 'messages');
        const msgs = await getDocs(messagesRef);
        
        let count = 0;
        let batchPromises = [];
        
        msgs.forEach(msgDoc => {
            batch.delete(msgDoc.ref);
            count++;
            if (count === 400) {
                batchPromises.push(batch.commit());
                count = 0;
            }
        });
        
        if (count > 0) {
            batchPromises.push(batch.commit());
        }
        
        await Promise.all(batchPromises);
        await deleteDoc(doc(db, 'rooms', roomId));
        console.log("Group and messages deleted completely");
    } catch (error) {
        console.error("Error deleting group", error);
    }
}
