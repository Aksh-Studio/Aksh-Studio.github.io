import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { app, currentUser } from "./auth.js";

// Initialize Firestore using the app initialized in auth.js
export const db = getFirestore(app);

/**
 * Attaches a real-time listener to the user's event collection.
 * @param {Function} callback - Triggers whenever data changes (passes the event array)
 */
export function subscribeToEvents(callback) {
    if (!currentUser) return;
    
    const eventsRef = collection(db, `users/${currentUser.uid}/calendarEvents`);
    const q = query(eventsRef, orderBy("date", "asc"));
    
    return onSnapshot(q, (snapshot) => {
        const events = [];
        snapshot.forEach((docSnap) => {
            events.push({ id: docSnap.id, ...docSnap.data() });
        });
        callback(events);
    });
}

/**
 * Adds a new event to Firestore.
 */
export async function addEvent(eventData) {
    if (!currentUser) return;
    const eventsRef = collection(db, `users/${currentUser.uid}/calendarEvents`);
    return await addDoc(eventsRef, {
        ...eventData,
        timestamp: serverTimestamp()
    });
}

/**
 * Updates an existing event.
 */
export async function updateEvent(eventId, eventData) {
    if (!currentUser) return;
    const eventRef = doc(db, `users/${currentUser.uid}/calendarEvents`, eventId);
    return await updateDoc(eventRef, eventData);
}

/**
 * Deletes an event.
 */
export async function deleteEvent(eventId) {
    if (!currentUser) return;
    const eventRef = doc(db, `users/${currentUser.uid}/calendarEvents`, eventId);
    return await deleteDoc(eventRef);
}
