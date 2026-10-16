/**
 * Aksh Photoshop - Utility Functions
 */
window.PSUtils = {
    clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    },

    hexToRgba(hex, alpha = 255) {
        let clean = hex.replace('#', '');
        if (clean.length === 3) {
            clean = clean.split('').map(c => c + c).join('');
        }
        const num = parseInt(clean, 16);
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255,
            a: alpha
        };
    },

    rgbToHex(r, g, b) {
        const toHex = (c) => this.clamp(Math.round(c), 0, 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    },

    rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [h, s, l];
    },

    hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    },

    getCanvasCoords(evt, canvasEl) {
        const rect = canvasEl.getBoundingClientRect();
        const clientX = evt.touches && evt.touches.length > 0 ? evt.touches[0].clientX : evt.clientX;
        const clientY = evt.touches && evt.touches.length > 0 ? evt.touches[0].clientY : evt.clientY;

        const scaleX = canvasEl.width / rect.width;
        const scaleY = canvasEl.height / rect.height;

        return {
            x: Math.floor((clientX - rect.left) * scaleX),
            y: Math.floor((clientY - rect.top) * scaleY)
        };
    },

    downloadBlob(canvas, filename, mimeType = 'image/png', quality = 0.92) {
        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, mimeType, quality);
    }
};
