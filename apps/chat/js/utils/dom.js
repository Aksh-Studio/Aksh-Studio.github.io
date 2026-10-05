export function createElement(tag, className = "", attributes = {}) {
    const el = document.createElement(tag);

    if (className) {
        el.className = className;
    }

    for (const [key, value] of Object.entries(attributes)) {
        if (value === null || value === undefined) continue;

        if (key === "textContent") {
            el.textContent = String(value);
            continue;
        }

        if (key === "className") {
            el.className = String(value);
            continue;
        }

        if (key === "style" && typeof value === "object") {
            Object.assign(el.style, value);
            continue;
        }

        if (key === "style" && typeof value === "string") {
            el.style.cssText = value;
            continue;
        }

        if (key === "disabled") {
            el.disabled = Boolean(value);
            continue;
        }

        if (key === "checked") {
            el.checked = Boolean(value);
            continue;
        }

        if (key.startsWith("on") && typeof value === "function") {
            el.addEventListener(key.slice(2), value);
            continue;
        }

        el.setAttribute(key, String(value));
    }

    return el;
}

export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function safeSrc(url, fallback = "./chat-logo.png") {
    if (typeof url !== "string") return fallback;

    const trimmed = url.trim();
    if (!trimmed) return fallback;

    if (
        trimmed.startsWith("javascript:") ||
        trimmed.startsWith("vbscript:") ||
        trimmed.startsWith("data:text/") ||
        trimmed.startsWith("//")
    ) {
        return fallback;
    }

    if (trimmed.startsWith("data:image/")) {
        return trimmed;
    }

    if (trimmed.startsWith("./") || trimmed.startsWith("../")) {
        return trimmed;
    }

    if (trimmed.startsWith("/")) {
        return trimmed;
    }

    try {
        const parsed = new URL(trimmed, window.location.href);

        if (parsed.protocol === "https:" || parsed.protocol === "http:") {
            return parsed.href;
        }
    } catch {
        // Ignore malformed URLs.
    }

    return fallback;
}
