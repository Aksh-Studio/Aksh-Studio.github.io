/**
 * Aksh Photoshop - Mathematical & Canvas Utilities
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

    colorDistance(r1, g1, b1, a1, r2, g2, b2, a2) {
        const dr = r1 - r2;
        const dg = g1 - g2;
        const db = b1 - b2;
        const da = a1 - a2;
        return Math.sqrt(dr * dr + dg * dg + db * db + da * da * 0.5);
    },

    getCanvasCoords(evt, canvasEl) {
        if (!canvasEl) return { x: 0, y: 0 };
        const rect = canvasEl.getBoundingClientRect();
        const clientX = evt.touches && evt.touches.length > 0 ? evt.touches[0].clientX : (evt.clientX !== undefined ? evt.clientX : (evt.changedTouches ? evt.changedTouches[0].clientX : 0));
        const clientY = evt.touches && evt.touches.length > 0 ? evt.touches[0].clientY : (evt.clientY !== undefined ? evt.clientY : (evt.changedTouches ? evt.changedTouches[0].clientY : 0));

        if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };

        const scaleX = canvasEl.width / rect.width;
        const scaleY = canvasEl.height / rect.height;

        return {
            x: Math.round((clientX - rect.left) * scaleX),
            y: Math.round((clientY - rect.top) * scaleY)
        };
    },

    downloadBlob(blob, filename) {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    },

    downloadCanvas(canvas, filename, mimeType = 'image/png', quality = 0.92) {
        canvas.toBlob((blob) => {
            if (blob) {
                this.downloadBlob(blob, filename);
            }
        }, mimeType, quality);
    },

    downloadText(text, filename, mimeType = 'application/json') {
        const blob = new Blob([text], { type: mimeType });
        this.downloadBlob(blob, filename);
    },

    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    },

    /**
     * Catmull-Rom / Hermite spline interpolation for smooth brush strokes
     */
    interpolatePoints(p0, p1, p2, p3, numPoints = 8) {
        const points = [];
        for (let i = 0; i < numPoints; i++) {
            const t = i / numPoints;
            const t2 = t * t;
            const t3 = t2 * t;

            const x = 0.5 * (
                (2 * p1.x) +
                (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
            );
            const y = 0.5 * (
                (2 * p1.y) +
                (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
            );
            points.push({ x, y });
        }
        return points;
    }
};
