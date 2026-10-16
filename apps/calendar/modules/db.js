import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Keep track of active snapshot listeners so we can unsubscribe on logout
let activeUnsubscribers = [];

export function cleanupCalendarListeners() {
  activeUnsubscribers.forEach((unsub) => {
    if (typeof unsub === "function") {
      try {
        unsub();
      } catch (e) {
        console.warn("Failed to unsubscribe listener:", e);
      }
    }
  });
  activeUnsubscribers = [];
}

/**
 * Safely subscribes to user-scoped Calendar collections (events, tasks, appointmentSlots)
 * Prevents [code=permission-denied] by waiting for a valid UID and handling errors gracefully.
 */
export function subscribeToCalendarData(db, userId, callbacks = {}) {
  // 1. Guard against null/undefined userId
  if (!userId) {
    cleanupCalendarListeners();
    return;
  }

  // Clear any existing listeners before attaching new ones
  cleanupCalendarListeners();

  // 2. Subscribe to User's Calendar Settings Document (/calendars/{userId})
  const calDocRef = doc(db, "calendars", userId);
  const unsubSettings = onSnapshot(
    calDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        if (callbacks.onSettings) callbacks.onSettings(docSnap.data());
      } else {
        // Initialize default calendar document safely matching Firestore rules
        setDoc(calDocRef, {
          ownerId: userId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
          defaultView: "month",
          updatedAt: serverTimestamp()
        }, { merge: true }).catch((err) => console.warn("Calendar init error:", err));
      }
    },
    (error) => {
      console.error("Calendar settings listener error:", error.message);
    }
  );
  activeUnsubscribers.push(unsubSettings);

  // 3. Subscribe to Events Subcollection (/calendars/{userId}/events)
  const eventsRef = collection(db, "calendars", userId, "events");
  const unsubEvents = onSnapshot(
    eventsRef,
    (snapshot) => {
      const events = [];
      snapshot.forEach((docSnap) => {
        events.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (callbacks.onEvents) callbacks.onEvents(events);
    },
    (error) => {
      console.error("Events snapshot listener error:", error.message);
    }
  );
  activeUnsubscribers.push(unsubEvents);

  // 4. Subscribe to Tasks Subcollection (/calendars/{userId}/tasks)
  const tasksRef = collection(db, "calendars", userId, "tasks");
  const unsubTasks = onSnapshot(
    tasksRef,
    (snapshot) => {
      const tasks = [];
      snapshot.forEach((docSnap) => {
        tasks.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (callbacks.onTasks) callbacks.onTasks(tasks);
    },
    (error) => {
      console.error("Tasks snapshot listener error:", error.message);
    }
  );
  activeUnsubscribers.push(unsubTasks);

  // 5. Subscribe to Appointment Slots (/calendars/{userId}/appointmentSlots)
  const slotsRef = collection(db, "calendars", userId, "appointmentSlots");
  const unsubSlots = onSnapshot(
    slotsRef,
    (snapshot) => {
      const slots = [];
      snapshot.forEach((docSnap) => {
        slots.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (callbacks.onSlots) callbacks.onSlots(slots);
    },
    (error) => {
      console.error("Appointment slots listener error:", error.message);
    }
  );
  activeUnsubscribers.push(unsubSlots);

  return cleanupCalendarListeners;
}
