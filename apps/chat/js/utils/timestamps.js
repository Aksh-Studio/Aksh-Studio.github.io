function isValidDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime());
}

export function normalizeTimestamp(value) {
    if (value === null || value === undefined) {
        return null;
    }

    // Firestore Timestamp-like object
    if (typeof value?.toDate === "function") {
        const date = value.toDate();
        return isValidDate(date) ? date : null;
    }

    // Firestore serialized timestamp
    if (
        typeof value === "object" &&
        value !== null &&
        typeof value.seconds === "number"
    ) {
        const date = new Date(
            value.seconds * 1000 +
            (typeof value.nanoseconds === "number"
                ? value.nanoseconds / 1e6
                : 0)
        );
        return isValidDate(date) ? date : null;
    }

    // Native Date
    if (value instanceof Date) {
        return isValidDate(value) ? new Date(value.getTime()) : null;
    }

    // Number: seconds or milliseconds
    if (typeof value === "number" && Number.isFinite(value)) {
        const ms =
            Math.abs(value) < 10000000000
                ? value * 1000
                : value;

        const date = new Date(ms);
        return isValidDate(date) ? date : null;
    }

    // ISO/date string
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;

        const date = new Date(trimmed);
        return isValidDate(date) ? date : null;
    }

    return null;
}

export function timestampMs(value) {
    const date = normalizeTimestamp(value);
    return date ? date.getTime() : null;
}

export function formatTime(value) {
    const date = normalizeTimestamp(value);
    if (!date) return "";

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

export function formatDate(value) {
    const date = normalizeTimestamp(value);
    if (!date) return "";

    return date.toLocaleDateString();
}
