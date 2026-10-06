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
    if (!file || file.size > MAX_FILE_SIZE) {
        alert("File size exceeds 5MB limit.");
        return;
    }
    if (!roomId || !currentUser.uid) return;

    compressImage(file, async (compressedDataUrl) => {
        try {
            const encryptedUrl = encryptMessage(compressedDataUrl);
            
            const messageData = {
                senderId: currentUser.uid,
                text: '',
                imageUrl: encryptedUrl,
                timestamp: Timestamp.now(),
                readBy: [currentUser.uid]
            };

            await addDoc(collection(db, `rooms/${roomId}/messages`), messageData);
            
            await updateDoc(doc(db, 'rooms', roomId), {
                lastMessageTime: Timestamp.now(),
                lastMessageSenderId: currentUser.uid
            });
        } catch (e) {
            console.error("Error uploading image:", e);
        }
    });
}

export async function handleDocumentUpload(file, roomId) {
    if (!file || file.size > MAX_FILE_SIZE) {
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
                text: '',
                documentUrl: encryptedUrl,
                documentName: encryptedName,
                timestamp: Timestamp.now(),
                readBy: [currentUser.uid]
            };

            await addDoc(collection(db, `rooms/${roomId}/messages`), messageData);
            
            await updateDoc(doc(db, 'rooms', roomId), {
                lastMessageTime: Timestamp.now(),
                lastMessageSenderId: currentUser.uid
            });
        } catch (e) {
            console.error("Error uploading document:", e);
        }
    };
    reader.readAsDataURL(file);
}
