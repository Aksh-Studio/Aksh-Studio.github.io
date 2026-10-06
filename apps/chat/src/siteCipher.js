const SITE_ORIGIN = "https://aksh-studio.github.io";
const INTERNAL_SALT = "aksh_chat_vault_2026_xK9";
const KEY = SITE_ORIGIN + INTERNAL_SALT;

function rc4(key, str) {
    let s = [], j = 0, x, res = '';
    for (let i = 0; i < 256; i++) {
        s[i] = i;
    }
    for (let i = 0; i < 256; i++) {
        j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
        x = s[i];
        s[i] = s[j];
        s[j] = x;
    }
    let i = 0;
    j = 0;
    for (let y = 0; y < str.length; y++) {
        i = (i + 1) % 256;
        j = (j + s[i]) % 256;
        x = s[i];
        s[i] = s[j];
        s[j] = x;
        res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
    }
    return res;
}

export function encryptMessage(plainText) {
    const encrypted = rc4(KEY, plainText);
    const b64 = btoa(unescape(encodeURIComponent(encrypted)));
    return `enc:v1:${b64}`;
}

export function decryptMessage(encryptedPayload) {
    if (typeof encryptedPayload === 'string' && encryptedPayload.startsWith('enc:v1:')) {
        const b64 = encryptedPayload.substring(7);
        try {
            const encrypted = decodeURIComponent(escape(atob(b64)));
            return rc4(KEY, encrypted);
        } catch (e) {
            return encryptedPayload;
        }
    }
    return encryptedPayload;
}
