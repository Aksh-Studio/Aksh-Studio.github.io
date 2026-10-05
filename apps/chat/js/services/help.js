import { db } from "../firebase-config.js";
import { state } from "../state.js";
import { 
    collection, doc, getDocs, setDoc, deleteDoc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const OWNER_EMAIL = "akshat124.am12@gmail.com";

export function isAppOwner() {
    return Boolean(
        state.currentUser?.email && 
        state.currentUser.email.toLowerCase().trim() === OWNER_EMAIL
    );
}

/**
 * Submit a help ticket / complaint.
 * Complies strictly with Firestore Rule: validComplaintCreate()
 * Keys allowed: ["name", "email", "subject", "details", "date", "status"]
 */
export async function submitComplaint(subject, details) {
    if (!state.currentUser) throw new Error("Must be signed in to submit a ticket.");
    
    const subjectTrimmed = (subject || "").trim();
    const detailsTrimmed = (details || "").trim();

    if (!subjectTrimmed) throw new Error("Please provide a subject.");
    if (!detailsTrimmed) throw new Error("Please provide details for your issue.");

    const userEmail = state.currentUser.email 
        ? state.currentUser.email.trim() 
        : "No email provided";
        
    const userName = state.currentProfile?.fullName || 
                     state.currentProfile?.nickname || 
                     state.currentUser.displayName || 
                     "Anonymous User";

    const timestamp = Date.now();
    const ticketId = `ticket_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;

    // Strictly match schema required by validComplaintCreate
    const payload = {
        name: String(userName),
        email: String(userEmail),
        subject: String(subjectTrimmed),
        details: String(detailsTrimmed),
        date: timestamp,
        status: "Unresolved"
    };

    const docRef = doc(db, "help_complaints", ticketId);
    await setDoc(docRef, payload);
    return ticketId;
}

/**
 * Owner-only: Fetch all submitted complaints
 */
export async function fetchComplaints() {
    if (!isAppOwner()) {
        throw new Error("Unauthorized: Only the application owner can view complaints.");
    }

    const snap = await getDocs(collection(db, "help_complaints"));
    const list = [];
    snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Sort newest first
    list.sort((a, b) => (Number(b.date) || 0) - (Number(a.date) || 0));
    return list;
}

/**
 * Owner-only: Delete a complaint
 */
export async function deleteComplaint(ticketId) {
    if (!isAppOwner()) {
        throw new Error("Unauthorized: Only the application owner can delete complaints.");
    }
    const docRef = doc(db, "help_complaints", ticketId);
    await deleteDoc(docRef);
}

/**
 * Owner-only: Update complaint status (e.g. Resolved / In Progress / Unresolved)
 */
export async function updateComplaintStatus(ticketId, newStatus) {
    if (!isAppOwner()) {
        throw new Error("Unauthorized: Only the application owner can update complaints.");
    }
    const docRef = doc(db, "help_complaints", ticketId);
    await updateDoc(docRef, { status: newStatus });
}
