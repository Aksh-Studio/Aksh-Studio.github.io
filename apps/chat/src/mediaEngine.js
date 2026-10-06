import { db, collection, addDoc, updateDoc, doc, Timestamp } from './firebase.js';
import { encryptMessage } from './siteCipher.js';
import { currentUser } from './auth.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let width = img.width;
            let height = img.height;
            const max_width = 800;

            if (width > max_width) {
                height = Math.round((height * max_width) / width);
                width = max_width;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            callback(dataUrl);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

export async function handleImageUpload(file, roomId) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
        alert("File size exceeds 5MB limit.");
        return;
    }
    if (!roomId || !currentUser.uid) return;

    compressImage(file, async (compressedDataUrl) => {
        try {
            const encryptedUrl = encryptMessage(compressedDataUrl);
            const encryptedName = encryptMessage(file.name || 'image.jpg');
            
            const messageData = {
                senderId: currentUser.uid,
                senderName: currentUser.displayName,
                text: '',
                fileUrl: encryptedUrl,
                fileName: encryptedName,
                fileType: 'image/jpeg',
                timestamp: Timestamp.now(),
                readBy: [currentUser.uid]
            };

            await addDoc(collection(db, `chats/${roomId}/messages`), messageData);
            
            await updateDoc(doc(db, 'chats', roomId), {
                lastMessageTime: Timestamp.now(),
                lastMessageSenderId: currentUser.uid
            });
        } catch (e) {
            console.error("Error uploading image:", e);
        }
    });
}

export async function handleDocumentUpload(file, roomId) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
        alert("File size exceeds 5MB limit.");
        return;
    }
    if (!roomId || !currentUser.uid) return;

    const reader = new FileReader();
    reader.onload = async function(event) {
        const dataUrl = event.target.result;
        
        try {
            const encryptedUrl = encryptMessage(dataUrl);
            const encryptedName = encryptMessage(file.name);
            
            const messageData = {
                senderId: currentUser.uid,
                senderName: currentUser.displayName,
                text: '',
                fileUrl: encryptedUrl,
                fileName: encryptedName,
                fileType: file.type || 'application/octet-stream',
                timestamp: Timestamp.now(),
                readBy: [currentUser.uid]
            };

            await addDoc(collection(db, `chats/${roomId}/messages`), messageData);
            
            await updateDoc(doc(db, 'chats', roomId), {
                lastMessageTime: Timestamp.now(),
                lastMessageSenderId: currentUser.uid
            });
        } catch (e) {
            console.error("Error uploading document:", e);
        }
    };
    reader.readAsDataURL(file);
}

export function initMediaEngine() {
    const attachBtn = document.getElementById('btn-attach-file');
    const fileInput = document.getElementById('chat-file-input');
    
    if (attachBtn && fileInput) {
        attachBtn.onclick = () => {
            fileInput.click();
        };

        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const roomId = window.appState ? window.appState.activeChatId : null;
            if (!roomId) return;
            
            if (file.type.startsWith('image/')) {
                handleImageUpload(file, roomId);
            } else {
                handleDocumentUpload(file, roomId);
            }
            
            fileInput.value = ''; // reset
        };
    }
}
