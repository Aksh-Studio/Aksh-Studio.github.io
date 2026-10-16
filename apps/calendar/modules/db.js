// ============================================================================
// Aksh Calendar - Firestore Database & Real-Time Sync Module (modules/db.js)
// ============================================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Initialize or reuse existing Firebase app instance
let app;
if (getApps().length > 0) {
  app = getApp();
} else if (window.firebaseConfig) {
  app = initializeApp(window.firebaseConfig);
}

export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;

// Track all active snapshot listeners to prevent permission-denied errors on logout
let activeUnsubscribers = [];

const LOCAL_STORAGE_KEYS = {
  EVENTS: "aksh_calendar_events_v1",
  TASKS: "aksh_calendar_tasks_v1",
  SLOTS: "aksh_calendar_slots_v1",
  SETTINGS: "aksh_calendar_settings_v1"
};

/**
 * Unsubscribes all active Firestore listeners safely
 */
export function cleanupCalendarListeners() {
  while (activeUnsubscribers.length > 0) {
    const unsub = activeUnsubscribers.pop();
    if (typeof unsub === "function") {
      try {
        unsub();
      } catch (err) {
        console.warn("[Calendar DB] Listener cleanup warning:", err.message);
      }
    }
  }
}

/**
 * LocalStorage Fallback Helpers (for offline mode or unauthenticated preview)
 */
function getLocalData(key, defaultVal = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
}

function setLocalData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("[Calendar DB] LocalStorage write failed:", e);
  }
}

/**
 * Resolves the current authenticated user ID safely
 */
function getActiveUserId(explicitUid = null) {
  if (explicitUid) return explicitUid;
  if (auth && auth.currentUser && auth.currentUser.uid) {
    return auth.currentUser.uid;
  }
  return null;
}

// ============================================================================
// REAL-TIME SNAPSHOT SUBSCRIPTIONS (SAFE AGAINST PERMISSION-DENIED)
// ============================================================================

/**
 * Master subscription function for Calendar Settings, Events, Tasks, and Slots
 */
export function subscribeToCalendarData(userId, callbacks = {}) {
  const uid = getActiveUserId(userId);

  // Always clean up old listeners before attaching new ones
  cleanupCalendarListeners();

  if (!db || !uid) {
    // Fallback to local storage if not signed in yet
    if (callbacks.onSettings) callbacks.onSettings(getLocalData(LOCAL_STORAGE_KEYS.SETTINGS, { defaultView: "month" }));
    if (callbacks.onEvents) callbacks.onEvents(getLocalData(LOCAL_STORAGE_KEYS.EVENTS, []));
    if (callbacks.onTasks) callbacks.onTasks(getLocalData(LOCAL_STORAGE_KEYS.TASKS, []));
    if (callbacks.onSlots) callbacks.onSlots(getLocalData(LOCAL_STORAGE_KEYS.SLOTS, []));
    return cleanupCalendarListeners;
  }

  // 1. User Calendar Settings Listener (/calendars/{uid})
  const calDocRef = doc(db, "calendars", uid);
  const unsubSettings = onSnapshot(
    calDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLocalData(LOCAL_STORAGE_KEYS.SETTINGS, data);
        if (callbacks.onSettings) callbacks.onSettings(data);
      } else {
        const defaultSettings = {
          ownerId: uid,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
          defaultView: "month",
          updatedAt: serverTimestamp()
        };
        setDoc(calDocRef, defaultSettings, { merge: true }).catch((err) => {
          console.warn("[Calendar DB] Could not initialize calendar doc:", err.message);
        });
        if (callbacks.onSettings) callbacks.onSettings(defaultSettings);
      }
    },
    (error) => {
      console.warn("[Calendar DB] Settings listener fallback:", error.message);
      if (callbacks.onSettings) callbacks.onSettings(getLocalData(LOCAL_STORAGE_KEYS.SETTINGS, { defaultView: "month" }));
    }
  );
  activeUnsubscribers.push(unsubSettings);

  // 2. Events Subcollection Listener (/calendars/{uid}/events)
  if (callbacks.onEvents) {
    const unsubEvents = listenToEvents(uid, callbacks.onEvents);
    if (unsubEvents) activeUnsubscribers.push(unsubEvents);
  }

  // 3. Tasks Subcollection Listener (/calendars/{uid}/tasks)
  if (callbacks.onTasks) {
    const unsubTasks = listenToTasks(uid, callbacks.onTasks);
    if (unsubTasks) activeUnsubscribers.push(unsubTasks);
  }

  // 4. Appointment Slots Subcollection Listener (/calendars/{uid}/appointmentSlots)
  if (callbacks.onSlots) {
    const unsubSlots = listenToAppointmentSlots(uid, callbacks.onSlots);
    if (unsubSlots) activeUnsubscribers.push(unsubSlots);
  }

  return cleanupCalendarListeners;
}

/**
 * Listen to user's events in real-time
 */
export function listenToEvents(userId, callback) {
  const uid = getActiveUserId(userId);
  if (!db || !uid) {
    if (callback) callback(getLocalData(LOCAL_STORAGE_KEYS.EVENTS, []));
    return () => {};
  }

  const eventsRef = collection(db, "calendars", uid, "events");
  const unsub = onSnapshot(
    eventsRef,
    (snapshot) => {
      const events = [];
      snapshot.forEach((docSnap) => {
        events.push({ id: docSnap.id, ...docSnap.data() });
      });
      setLocalData(LOCAL_STORAGE_KEYS.EVENTS, events);
      if (callback) callback(events);
    },
    (error) => {
      console.warn("[Calendar DB] Events listener permission/network fallback:", error.message);
      if (callback) callback(getLocalData(LOCAL_STORAGE_KEYS.EVENTS, []));
    }
  );

  activeUnsubscribers.push(unsub);
  return unsub;
}

/**
 * Listen to user's tasks in real-time
 */
export function listenToTasks(userId, callback) {
  const uid = getActiveUserId(userId);
  if (!db || !uid) {
    if (callback) callback(getLocalData(LOCAL_STORAGE_KEYS.TASKS, []));
    return () => {};
  }

  const tasksRef = collection(db, "calendars", uid, "tasks");
  const unsub = onSnapshot(
    tasksRef,
    (snapshot) => {
      const tasks = [];
      snapshot.forEach((docSnap) => {
        tasks.push({ id: docSnap.id, ...docSnap.data() });
      });
      setLocalData(LOCAL_STORAGE_KEYS.TASKS, tasks);
      if (callback) callback(tasks);
    },
    (error) => {
      console.warn("[Calendar DB] Tasks listener fallback:", error.message);
      if (callback) callback(getLocalData(LOCAL_STORAGE_KEYS.TASKS, []));
    }
  );

  activeUnsubscribers.push(unsub);
  return unsub;
}

/**
 * Listen to user's appointment slots in real-time
 */
export function listenToAppointmentSlots(userId, callback) {
  const uid = getActiveUserId(userId);
  if (!db || !uid) {
    if (callback) callback(getLocalData(LOCAL_STORAGE_KEYS.SLOTS, []));
    return () => {};
  }

  const slotsRef = collection(db, "calendars", uid, "appointmentSlots");
  const unsub = onSnapshot(
    slotsRef,
    (snapshot) => {
      const slots = [];
      snapshot.forEach((docSnap) => {
        slots.push({ id: docSnap.id, ...docSnap.data() });
      });
      setLocalData(LOCAL_STORAGE_KEYS.SLOTS, slots);
      if (callback) callback(slots);
    },
    (error) => {
      console.warn("[Calendar DB] Appointment slots listener fallback:", error.message);
      if (callback) callback(getLocalData(LOCAL_STORAGE_KEYS.SLOTS, []));
    }
  );

  activeUnsubscribers.push(unsub);
  return unsub;
}

// ============================================================================
// EVENTS CRUD OPERATIONS
// ============================================================================

export async function saveEvent(eventData, userId = null) {
  const uid = getActiveUserId(userId || eventData?.userId || eventData?.ownerId);
  const eventId = eventData.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const payload = {
    ...eventData,
    id: eventId,
    userId: uid || "local-user",
    ownerId: uid || "local-user",
    updatedAt: new Date().toISOString()
  };

  // Always update local cache immediately for snappy UI
  const localEvents = getLocalData(LOCAL_STORAGE_KEYS.EVENTS, []);
  const existingIdx = localEvents.findIndex((e) => e.id === eventId);
  if (existingIdx >= 0) {
    localEvents[existingIdx] = payload;
  } else {
    localEvents.push(payload);
  }
  setLocalData(LOCAL_STORAGE_KEYS.EVENTS, localEvents);

  if (db && uid) {
    try {
      const eventRef = doc(db, "calendars", uid, "events", String(eventId));
      await setDoc(eventRef, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.error("[Calendar DB] Failed to save event to Firestore:", err.message);
    }
  }

  return payload;
}

export const createEvent = saveEvent;
export const updateEvent = saveEvent;
export const saveEventToDB = saveEvent;

export async function deleteEvent(eventId, userId = null) {
  if (!eventId) return false;
  const uid = getActiveUserId(userId);

  const localEvents = getLocalData(LOCAL_STORAGE_KEYS.EVENTS, []).filter((e) => e.id !== eventId);
  setLocalData(LOCAL_STORAGE_KEYS.EVENTS, localEvents);

  if (db && uid) {
    try {
      const eventRef = doc(db, "calendars", uid, "events", String(eventId));
      await deleteDoc(eventRef);
    } catch (err) {
      console.error("[Calendar DB] Failed to delete event from Firestore:", err.message);
    }
  }
  return true;
}

export const deleteEventFromDB = deleteEvent;

// ============================================================================
// TASKS CRUD OPERATIONS
// ============================================================================

export async function saveTask(taskData, userId = null) {
  const uid = getActiveUserId(userId || taskData?.userId);
  const taskId = taskData.id || `tsk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const payload = {
    ...taskData,
    id: taskId,
    completed: Boolean(taskData.completed),
    userId: uid || "local-user",
    updatedAt: new Date().toISOString()
  };

  const localTasks = getLocalData(LOCAL_STORAGE_KEYS.TASKS, []);
  const idx = localTasks.findIndex((t) => t.id === taskId);
  if (idx >= 0) {
    localTasks[idx] = payload;
  } else {
    localTasks.push(payload);
  }
  setLocalData(LOCAL_STORAGE_KEYS.TASKS, localTasks);

  if (db && uid) {
    try {
      const taskRef = doc(db, "calendars", uid, "tasks", String(taskId));
      await setDoc(taskRef, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.error("[Calendar DB] Failed to save task:", err.message);
    }
  }

  return payload;
}

export const createTask = saveTask;
export const updateTask = saveTask;
export const saveTaskToDB = saveTask;

export async function deleteTask(taskId, userId = null) {
  if (!taskId) return false;
  const uid = getActiveUserId(userId);

  const localTasks = getLocalData(LOCAL_STORAGE_KEYS.TASKS, []).filter((t) => t.id !== taskId);
  setLocalData(LOCAL_STORAGE_KEYS.TASKS, localTasks);

  if (db && uid) {
    try {
      const taskRef = doc(db, "calendars", uid, "tasks", String(taskId));
      await deleteDoc(taskRef);
    } catch (err) {
      console.error("[Calendar DB] Failed to delete task:", err.message);
    }
  }
  return true;
}

export const deleteTaskFromDB = deleteTask;

// ============================================================================
// APPOINTMENT SLOTS CRUD OPERATIONS
// ============================================================================

export async function saveAppointmentSlot(slotData, userId = null) {
  const uid = getActiveUserId(userId || slotData?.userId);
  const slotId = slotData.id || `slot_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const payload = {
    ...slotData,
    id: slotId,
    userId: uid || "local-user",
    updatedAt: new Date().toISOString()
  };

  const localSlots = getLocalData(LOCAL_STORAGE_KEYS.SLOTS, []);
  const idx = localSlots.findIndex((s) => s.id === slotId);
  if (idx >= 0) {
    localSlots[idx] = payload;
  } else {
    localSlots.push(payload);
  }
  setLocalData(LOCAL_STORAGE_KEYS.SLOTS, localSlots);

  if (db && uid) {
    try {
      const slotRef = doc(db, "calendars", uid, "appointmentSlots", String(slotId));
      await setDoc(slotRef, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.error("[Calendar DB] Failed to save appointment slot:", err.message);
    }
  }

  return payload;
}

export const createAppointmentSlot = saveAppointmentSlot;
export const saveSlotToDB = saveAppointmentSlot;

export async function deleteAppointmentSlot(slotId, userId = null) {
  if (!slotId) return false;
  const uid = getActiveUserId(userId);

  const localSlots = getLocalData(LOCAL_STORAGE_KEYS.SLOTS, []).filter((s) => s.id !== slotId);
  setLocalData(LOCAL_STORAGE_KEYS.SLOTS, localSlots);

  if (db && uid) {
    try {
      const slotRef = doc(db, "calendars", uid, "appointmentSlots", String(slotId));
      await deleteDoc(slotRef);
    } catch (err) {
      console.error("[Calendar DB] Failed to delete appointment slot:", err.message);
    }
  }
  return true;
}

export const deleteSlotFromDB = deleteAppointmentSlot;

// ============================================================================
// CALENDAR SETTINGS CRUD OPERATIONS
// ============================================================================

export async function saveCalendarSettings(settings = {}, userId = null) {
  const uid = getActiveUserId(userId);
  const cleanSettings = {
    ownerId: uid || "local-user",
    timezone: String(settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata").slice(0, 64),
    defaultView: String(settings.defaultView || "month").slice(0, 32),
    updatedAt: new Date().toISOString()
  };

  setLocalData(LOCAL_STORAGE_KEYS.SETTINGS, cleanSettings);

  if (db && uid) {
    try {
      const calDocRef = doc(db, "calendars", uid);
      await setDoc(
        calDocRef,
        {
          ownerId: uid,
          timezone: cleanSettings.timezone,
          defaultView: cleanSettings.defaultView,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    } catch (err) {
      console.warn("[Calendar DB] Settings sync warning:", err.message);
    }
  }

  return cleanSettings;
}

export const saveUserSettings = saveCalendarSettings;

// Expose globally for non-module scripts if needed
window.CalendarDB = {
  db,
  subscribeToCalendarData,
  cleanupCalendarListeners,
  listenToEvents,
  listenToTasks,
  listenToAppointmentSlots,
  saveEvent,
  deleteEvent,
  saveTask,
  deleteTask,
  saveAppointmentSlot,
  deleteAppointmentSlot,
  saveCalendarSettings
};
