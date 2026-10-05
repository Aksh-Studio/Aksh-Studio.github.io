/**
 * Client-Side Message Transformation Utility
 * Encodes outgoing text before storage and decodes incoming text for rendering.
 * Gracefully preserves and reads legacy plain text.
 */

const SITE_ORIGIN = "https://aksh-studio.github.io";
const INTERNAL_SALT = "aksh_chat_vault_2026_xK9";
const PAYLOAD_PREFIX = "enc:v1:";

function createKeyStream(keyStr) {
    const S = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        S[i] = i;
    }

    let j = 0;
    for (let i = 0; i < 256; i++) {
        j = (j + S[i] + keyStr.charCodeAt(i % keyStr.length)) % 256;
        const temp = S[i];
        S[i] = S[j];
        S[j] = temp;
    }
    return S;
}

function transformBytes(bytes, keyStr) {
    const S = createKeyStream(keyStr);
    const result = new Uint8Array(bytes.length);
    let i = 0;
    let j = 0;

    for (let k = 0; k < bytes.length; k++) {
        i = (i + 1) % 256;
        j = (j + S[i]) % 256;

        const temp = S[i];
        S[i] = S[j];
        S[j] = temp;

        const K = S[(S[i] + S[j]) % 256];
        result[k] = bytes[k] ^ K;
    }
    return result;
}

function getSiteKey() {
    const origin = (typeof window !== "undefined" && window.location.origin.includes("aksh-studio.github.io"))
        ? window.location.origin
        : SITE_ORIGIN;
    return origin + "::" + INTERNAL_SALT;
}

/**
 * Encodes plain text message into a Base64 payload prefixed with enc:v1:
 * @param {string} plainText
 * @returns {string}
 */
export function encryptMessage(plainText) {
    if (!plainText || typeof plainText !== "string") return "";
    try {
        const key = getSiteKey();
        const encoder = new TextEncoder();
        const textBytes = encoder.encode(plainText);
        const cipherBytes = transformBytes(textBytes, key);

        let binary = "";
        for (let i = 0; i < cipherBytes.length; i++) {
            binary += String.fromCharCode(cipherBytes[i]);
        }
        return PAYLOAD_PREFIX + btoa(binary);
    } catch (err) {
        console.warn("Message encoding fallback to plain text:", err);
        return plainText;
    }
}

/**
 * Decodes scrambled payload back into original plain text.
 * Gracefully returns plain text if message is unencrypted or legacy.
 * @param {string} payload
 * @returns {string}
 */
export function decryptMessage(payload) {
    if (!payload || typeof payload !== "string") return "";

    // If message does not start with prefix, return as-is (legacy compatibility)
    if (!payload.startsWith(PAYLOAD_PREFIX)) {
        return payload;
    }

    try {
        const rawBase64 = payload.slice(PAYLOAD_PREFIX.length);
        const key = getSiteKey();
        const binary = atob(rawBase64);
        const cipherBytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            cipherBytes[i] = binary.charCodeAt(i);
        }

        const plainBytes = transformBytes(cipherBytes, key);
        return new TextDecoder().decode(plainBytes);
    } catch (err) {
        console.warn("Message decoding failed, returning raw string:", err);
        return payload;
    }
}
