/**
 * Aksh Photoshop - Non-Destructive Preview & Pixel Filters
 */
window.PSAdjustments = {
    values: {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        hue: 0,
        blur: 0
    },

    init() {
        const sliders = ['brightness', 'contrast', 'saturation', 'hue', 'blur'];
        sliders.forEach(key => {
            const el = document.getElementById(`adj-${key}`);
            const valEl = document.getElementById(`val-${key}`);
            if (!el) return;

            el.addEventListener('input', () => {
                this.values[key] = parseFloat(el.value);
                if (valEl) {
                    valEl.textContent = key === 'hue' ? `${el.value}°` : (key === 'blur' ? `${el.value}px` : el.value);
                }
                this.updateLivePreview();
            });
        });

        const resetBtn = document.getElementById('btn-reset-adjustments');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetSliders();
                window.PSLayers.compositeAll();
            });
        }

        const applyBtn = document.getElementById('btn-apply-adjustments');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.bakeAdjustments());
        }
    },

    hasActiveAdjustments() {
        return Object.values(this.values).some(v => v !== 0);
    },

    resetSliders() {
        this.values = { brightness: 0, contrast: 0, saturation: 0, hue: 0, blur: 0 };
        ['brightness', 'contrast', 'saturation', 'hue', 'blur'].forEach(key => {
            const el = document.getElementById(`adj-${key}`);
            const valEl = document.getElementById(`val-${key}`);
            if (el) el.value = 0;
            if (valEl) valEl.textContent = key === 'hue' ? '0°' : (key === 'blur' ? '0px' : '0');
        });
    },

    createFilteredCanvas(sourceCanvas) {
        const temp = document.createElement('canvas');
        temp.width = sourceCanvas.width;
        temp.height = sourceCanvas.height;
        const ctx = temp.getContext('2d');

        const b = 100 + this.values.brightness;
        const c = 100 + this.values.contrast;
        const s = 100 + this.values.saturation;
        const h = this.values.hue;
        const blur = this.values.blur;

        ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) hue-rotate(${h}deg) blur(${blur}px)`;
        ctx.drawImage(sourceCanvas, 0, 0);
        ctx.filter = 'none';
        return temp;
    },

    updateLivePreview() {
        if (!this.hasActiveAdjustments()) {
            window.PSLayers.compositeAll();
            return;
        }
        window.PSLayers.compositeAll((layerCanvas) => this.createFilteredCanvas(layerCanvas));
    },

    bakeAdjustments() {
        const active = window.PSLayers.getActiveLayer();
        if (!active || !this.hasActiveAdjustments()) return;

        const filtered = this.createFilteredCanvas(active.canvas);
        active.ctx.clearRect(0, 0, active.canvas.width, active.canvas.height);
        active.ctx.drawImage(filtered, 0, 0);

        this.resetSliders();
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSHistory.saveState('Apply Adjustments');
    },

    applyDirectFilter(type) {
        const active = window.PSLayers.getActiveLayer();
        if (!active) return;

        const w = active.canvas.width;
        const h = active.canvas.height;
        const imgData = active.ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        if (type === 'invert') {
            for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i];
                data[i + 1] = 255 - data[i + 1];
                data[i + 2] = 255 - data[i + 2];
            }
        } else if (type === 'grayscale') {
            for (let i = 0; i < data.length; i += 4) {
                const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                data[i] = data[i + 1] = data[i + 2] = avg;
            }
        } else if (type === 'sepia') {
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2];
                data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
                data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
                data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
            }
        } else if (type === 'sharpen') {
            this.applyConvolution(active, [
                0, -1,  0,
               -1,  5, -1,
                0, -1,  0
            ]);
            return;
        } else if (type === 'emboss') {
            this.applyConvolution(active, [
               -2, -1,  0,
               -1,  1,  1,
                0,  1,  2
            ]);
            return;
        } else if (type === 'edge') {
            this.applyConvolution(active, [
               -1, -1, -1,
               -1,  8, -1,
               -1, -1, -1
            ]);
            return;
        }

        active.ctx.putImageData(imgData, 0, 0);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSHistory.saveState(`Filter: ${type}`);
    },

    applyConvolution(layer, kernel) {
        const w = layer.canvas.width;
        const h = layer.canvas.height;
        const srcData = layer.ctx.getImageData(0, 0, w, h);
        const dstData = layer.ctx.createImageData(w, h);
        const src = srcData.data;
        const dst = dstData.data;

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                let r = 0, g = 0, b = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * w + (x + kx)) * 4;
                        const weight = kernel[(ky + 1) * 3 + (kx + 1)];
                        r += src[idx] * weight;
                        g += src[idx + 1] * weight;
                        b += src[idx + 2] * weight;
                    }
                }
                const outIdx = (y * w + x) * 4;
                dst[outIdx] = window.PSUtils.clamp(r, 0, 255);
                dst[outIdx + 1] = window.PSUtils.clamp(g, 0, 255);
                dst[outIdx + 2] = window.PSUtils.clamp(b, 0, 255);
                dst[outIdx + 3] = src[outIdx + 3];
            }
        }

        layer.ctx.putImageData(dstData, 0, 0);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSHistory.saveState('Convolution Filter');
    }
};
