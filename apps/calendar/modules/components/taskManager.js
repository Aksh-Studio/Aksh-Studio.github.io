// taskManager.js
import { addEvent, updateEvent } from '../db.js';
import { state } from '../state.js';

/**
 * Creates a new task that acts like an event but with completion tracking.
 */
export async function createTask(title, dueDate, dueTime) {
    const taskData = {
        title: title,
        date: dueDate,
        time: dueTime,
        category: 'important', // Tasks default to important
        type: 'task',
        completed: false
    };
    
    return await addEvent(taskData);
}

/**
 * Toggles a task's completion status in the database.
 */
export async function toggleTaskCompletion(taskId) {
    const task = state.events.find(e => e.id === taskId);
    if (!task || task.type !== 'task') return;

    const newStatus = !task.completed;
    return await updateEvent(taskId, { completed: newStatus });
}

/**
 * Returns only the active, uncompleted tasks from the state.
 */
export function getPendingTasks() {
    return state.events.filter(e => e.type === 'task' && !e.completed);
}
