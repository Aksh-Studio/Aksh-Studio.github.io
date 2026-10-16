/**
 * Aksh Photoshop - Color Adjustments, Non-Destructive Live Preview & Convolution Filters
 */

window.PSAdjustments = {
    values: {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        hue: 0,
        blur: 0,
        exposure: 0
    },

    init() {
        const sliders = ['brightness', 'contrast', 'saturation', 'hue', 'blur', 'exposure'];
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
        this.values = { brightness: 0, contrast: 0, saturation: 0, hue: 0, blur: 0, exposure: 0 };
        ['brightness', 'contrast', 'saturation', 'hue', 'blur', 'exposure'].forEach(key => {
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

        const b = 100 + this.values.brightness + (this.values.exposure * 0.5);
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
        if (!active || active.locked || !this.hasActiveAdjustments()) return;

        const filtered = this.createFilteredCanvas(active.canvas);

        active.ctx.save();
        if (window.PSSelection && window.PSSelection.isActive) {
            window.PSSelection.applySelectionClip(active.ctx, active.x, active.y);
            active.ctx.clearRect(0, 0, active.canvas.width, active.canvas.height);
            active.ctx.drawImage(filtered, 0, 0);
        } else {
            active.ctx.clearRect(0, 0, active.canvas.width, active.canvas.height);
            active.ctx.drawImage(filtered, 0, 0);
        }
        active.ctx.restore();

        this.resetSliders();
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Apply Adjustments');
    },

    applyDirectFilter(type) {
        const active = window.PSLayers.getActiveDrawable() || window.PSLayers.getActiveLayer();
        if (!active || active.locked || active.isGroup) return;

        const w = active.canvas.width;
        const h = active.canvas.height;
        const imgData = active.ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Selection mask check
        const selectionActive = window.PSSelection && window.PSSelection.isActive;
        let maskData = null;
        const maskW = window.PSApp.width;
        const maskH = window.PSApp.height;
        if (selectionActive && window.PSSelection.maskCtx) {
            maskData = window.PSSelection.maskCtx.getImageData(0, 0, maskW, maskH).data;
        }

        const isPixelSelected = (i) => {
            if (!selectionActive || !maskData) return true;
            const lx = (i / 4) % w;
            const ly = Math.floor((i / 4) / w);
            const cx = lx + active.x;
            const cy = ly + active.y;
            if (cx < 0 || cx >= maskW || cy < 0 || cy >= maskH) return false;
            const maskIdx = (cy * maskW + cx) * 4;
            return maskData[maskIdx + 3] > 10;
        };

        if (type === 'invert') {
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0 || !isPixelSelected(i)) continue;
                data[i] = 255 - data[i];
                data[i + 1] = 255 - data[i + 1];
                data[i + 2] = 255 - data[i + 2];
            }
        } else if (type === 'grayscale') {
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0 || !isPixelSelected(i)) continue;
                const avg = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
                data[i] = data[i + 1] = data[i + 2] = avg;
            }
        } else if (type === 'sepia') {
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0 || !isPixelSelected(i)) continue;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                data[i] = Math.min(255, Math.round((r * 0.393) + (g * 0.769) + (b * 0.189)));
                data[i + 1] = Math.min(255, Math.round((r * 0.349) + (g * 0.686) + (b * 0.168)));
                data[i + 2] = Math.min(255, Math.round((r * 0.272) + (g * 0.534) + (b * 0.131)));
            }
        } else if (type === 'auto-contrast') {
            let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0 || !isPixelSelected(i)) continue;
                minR = Math.min(minR, data[i]); maxR = Math.max(maxR, data[i]);
                minG = Math.min(minG, data[i + 1]); maxG = Math.max(maxG, data[i + 1]);
                minB = Math.min(minB, data[i + 2]); maxB = Math.max(maxB, data[i + 2]);
            }
            const rangeR = maxR - minR || 1, rangeG = maxG - minG || 1, rangeB = maxB - minB || 1;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0 || !isPixelSelected(i)) continue;
                data[i] = Math.round(((data[i] - minR) / rangeR) * 255);
                data[i + 1] = Math.round(((data[i + 1] - minG) / rangeG) * 255);
                data[i + 2] = Math.round(((data[i + 2] - minB) / rangeB) * 255);
            }
        } else if (type === 'pixelate') {
            const size = 10;
            for (let y = 0; y < h; y += size) {
                for (let x = 0; x < w; x += size) {
                    const sampleIdx = (Math.min(y + Math.floor(size / 2), h - 1) * w + Math.min(x + Math.floor(size / 2), w - 1)) * 4;
                    const r = data[sampleIdx], g = data[sampleIdx + 1], b = data[sampleIdx + 2], a = data[sampleIdx + 3];
                    for (let py = y; py < Math.min(y + size, h); py++) {
                        for (let px = x; px < Math.min(x + size, w); px++) {
                            const pIdx = (py * w + px) * 4;
                            if (isPixelSelected(pIdx)) {
                                data[pIdx] = r; data[pIdx + 1] = g; data[pIdx + 2] = b; data[pIdx + 3] = a;
                            }
                        }
                    }
                }
            }
        } else if (type === 'noise') {
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0 || !isPixelSelected(i)) continue;
                const noise = (Math.random() - 0.5) * 50;
                data[i] = window.PSUtils.clamp(data[i] + noise, 0, 255);
                data[i + 1] = window.PSUtils.clamp(data[i + 1] + noise, 0, 255);
                data[i + 2] = window.PSUtils.clamp(data[i + 2] + noise, 0, 255);
            }
        } else if (type === 'vignette') {
            const cx = w / 2, cy = h / 2;
            const maxDist = Math.sqrt(cx * cx + cy * cy);
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = (y * w + x) * 4;
                    if (data[idx + 3] === 0 || !isPixelSelected(idx)) continue;
                    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                    const factor = 1 - Math.min(1, Math.max(0, (dist / maxDist) - 0.35) * 1.5);
                    data[idx] = Math.round(data[idx] * factor);
                    data[idx + 1] = Math.round(data[idx + 1] * factor);
                    data[idx + 2] = Math.round(data[idx + 2] * factor);
                }
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
        } else if (type === 'blur') {
            const v = 1 / 9;
            this.applyConvolution(active, [
                v, v, v,
                v, v, v,
                v, v, v
            ]);
            return;
        }

        active.ctx.putImageData(imgData, 0, 0);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`Filter: ${type}`);
    },

    // --- Levels Adjustment Engine ---
    buildLevelsLUT(inBlack = 0, inWhite = 255, gamma = 1.0, outBlack = 0, outWhite = 255) {
        const lut = new Uint8Array(256);
        const invGamma = 1 / Math.max(0.01, gamma);
        const rangeIn = Math.max(1, inWhite - inBlack);
        const rangeOut = outWhite - outBlack;
        for (let i = 0; i < 256; i++) {
            let norm = (i - inBlack) / rangeIn;
            norm = Math.max(0, Math.min(1, norm));
            norm = Math.pow(norm, invGamma);
            lut[i] = window.PSUtils.clamp(Math.round(outBlack + norm * rangeOut), 0, 255);
        }
        return lut;
    },

    applyLevels(inBlack = 0, inWhite = 255, gamma = 1.0, outBlack = 0, outWhite = 255, channel = 'rgb') {
        const active = window.PSLayers.getActiveDrawable() || window.PSLayers.getActiveLayer();
        if (!active || active.locked || active.isGroup) return;

        const lut = this.buildLevelsLUT(inBlack, inWhite, gamma, outBlack, outWhite);
        const w = active.canvas.width;
        const h = active.canvas.height;
        const imgData = active.ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        const selectionActive = window.PSSelection && window.PSSelection.isActive;
        let maskData = null;
        const maskW = window.PSApp.width;
        const maskH = window.PSApp.height;
        if (selectionActive && window.PSSelection.maskCtx) {
            maskData = window.PSSelection.maskCtx.getImageData(0, 0, maskW, maskH).data;
        }

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            if (selectionActive && maskData) {
                const lx = (i / 4) % w;
                const ly = Math.floor((i / 4) / w);
                const cx = lx + active.x;
                const cy = ly + active.y;
                if (cx < 0 || cx >= maskW || cy < 0 || cy >= maskH) continue;
                if (maskData[(cy * maskW + cx) * 4 + 3] <= 10) continue;
            }

            if (channel === 'rgb' || channel === 'r') data[i] = lut[data[i]];
            if (channel === 'rgb' || channel === 'g') data[i + 1] = lut[data[i + 1]];
            if (channel === 'rgb' || channel === 'b') data[i + 2] = lut[data[i + 2]];
        }

        active.ctx.putImageData(imgData, 0, 0);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Levels');
    },

    // --- Curves Adjustment Engine ---
    buildCurvesLUT(points = [{ x: 0, y: 0 }, { x: 255, y: 255 }]) {
        const sorted = [...points].sort((a, b) => a.x - b.x);
        if (sorted.length === 0) {
            sorted.push({ x: 0, y: 0 }, { x: 255, y: 255 });
        }
        if (sorted[0].x > 0) {
            sorted.unshift({ x: 0, y: sorted[0].y });
        }
        if (sorted[sorted.length - 1].x < 255) {
            sorted.push({ x: 255, y: sorted[sorted.length - 1].y });
        }

        const lut = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            let seg = 0;
            while (seg < sorted.length - 2 && sorted[seg + 1].x < i) {
                seg++;
            }
            const p0 = sorted[seg];
            const p1 = sorted[seg + 1];
            const t = (p1.x === p0.x) ? 0 : (i - p0.x) / (p1.x - p0.x);
            // Smooth cosine interpolation
            const smoothT = (1 - Math.cos(t * Math.PI)) / 2;
            const val = p0.y + (p1.y - p0.y) * smoothT;
            lut[i] = window.PSUtils.clamp(Math.round(val), 0, 255);
        }
        return lut;
    },

    applyCurves(points = [{ x: 0, y: 0 }, { x: 255, y: 255 }], channel = 'rgb') {
        const active = window.PSLayers.getActiveDrawable() || window.PSLayers.getActiveLayer();
        if (!active || active.locked || active.isGroup) return;

        const lut = this.buildCurvesLUT(points);
        const w = active.canvas.width;
        const h = active.canvas.height;
        const imgData = active.ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        const selectionActive = window.PSSelection && window.PSSelection.isActive;
        let maskData = null;
        const maskW = window.PSApp.width;
        const maskH = window.PSApp.height;
        if (selectionActive && window.PSSelection.maskCtx) {
            maskData = window.PSSelection.maskCtx.getImageData(0, 0, maskW, maskH).data;
        }

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            if (selectionActive && maskData) {
                const lx = (i / 4) % w;
                const ly = Math.floor((i / 4) / w);
                const cx = lx + active.x;
                const cy = ly + active.y;
                if (cx < 0 || cx >= maskW || cy < 0 || cy >= maskH) continue;
                if (maskData[(cy * maskW + cx) * 4 + 3] <= 10) continue;
            }

            if (channel === 'rgb' || channel === 'r') data[i] = lut[data[i]];
            if (channel === 'rgb' || channel === 'g') data[i + 1] = lut[data[i + 1]];
            if (channel === 'rgb' || channel === 'b') data[i + 2] = lut[data[i + 2]];
        }

        active.ctx.putImageData(imgData, 0, 0);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Curves');
    },

    getSelectionCheck(targetLayer) {
        const selectionActive = window.PSSelection && window.PSSelection.isActive;
        let maskData = null;
        const maskW = window.PSApp.width;
        const maskH = window.PSApp.height;
        if (selectionActive && window.PSSelection.maskCtx) {
            maskData = window.PSSelection.maskCtx.getImageData(0, 0, maskW, maskH).data;
        }

        const w = targetLayer.canvas.width;
        const h = targetLayer.canvas.height;
        const lx = targetLayer.x || 0;
        const ly = targetLayer.y || 0;

        return (pixelIndex) => {
            if (!selectionActive || !maskData) return true;
            const px = (pixelIndex / 4) % w;
            const py = Math.floor((pixelIndex / 4) / w);
            const cx = px + lx;
            const cy = py + ly;
            if (cx < 0 || cx >= maskW || cy < 0 || cy >= maskH) return false;
            return maskData[(cy * maskW + cx) * 4 + 3] > 10;
        };
    },

    // --- Color Balance ---
    applyColorBalance(cyanRed = 0, magentaGreen = 0, yellowBlue = 0) {
        const active = window.PSLayers.getActiveDrawable() || window.PSLayers.getActiveLayer();
        if (!active || active.locked || active.isGroup) return;

        const w = active.canvas.width;
        const h = active.canvas.height;
        const imgData = active.ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const isSelected = this.getSelectionCheck(active);

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0 || !isSelected(i)) continue;
            data[i] = window.PSUtils.clamp(data[i] + cyanRed, 0, 255);
            data[i + 1] = window.PSUtils.clamp(data[i + 1] + magentaGreen, 0, 255);
            data[i + 2] = window.PSUtils.clamp(data[i + 2] + yellowBlue, 0, 255);
        }

        active.ctx.putImageData(imgData, 0, 0);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Color Balance');
    },

    // --- Threshold ---
    applyThreshold(cutoff = 128) {
        const active = window.PSLayers.getActiveDrawable() || window.PSLayers.getActiveLayer();
        if (!active || active.locked || active.isGroup) return;

        const w = active.canvas.width;
        const h = active.canvas.height;
        const imgData = active.ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const isSelected = this.getSelectionCheck(active);

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0 || !isSelected(i)) continue;
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const v = lum >= cutoff ? 255 : 0;
            data[i] = v;
            data[i + 1] = v;
            data[i + 2] = v;
        }

        active.ctx.putImageData(imgData, 0, 0);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`Threshold (${cutoff})`);
    },

    // --- Posterize ---
    applyPosterize(levels = 4) {
        const active = window.PSLayers.getActiveDrawable() || window.PSLayers.getActiveLayer();
        if (!active || active.locked || active.isGroup) return;

        const lev = Math.max(2, Math.min(255, levels));
        const numAreas = 256 / lev;
        const numValues = 255 / (lev - 1);

        const w = active.canvas.width;
        const h = active.canvas.height;
        const imgData = active.ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const isSelected = this.getSelectionCheck(active);

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0 || !isSelected(i)) continue;
            data[i] = window.PSUtils.clamp(Math.round(Math.floor(data[i] / numAreas) * numValues), 0, 255);
            data[i + 1] = window.PSUtils.clamp(Math.round(Math.floor(data[i + 1] / numAreas) * numValues), 0, 255);
            data[i + 2] = window.PSUtils.clamp(Math.round(Math.floor(data[i + 2] / numAreas) * numValues), 0, 255);
        }

        active.ctx.putImageData(imgData, 0, 0);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`Posterize (${levels})`);
    },

    // --- Unsharp Mask ---
    applyUnsharpMask(radius = 2, amount = 1.5, threshold = 0) {
        const active = window.PSLayers.getActiveDrawable() || window.PSLayers.getActiveLayer();
        if (!active || active.locked || active.isGroup) return;

        const w = active.canvas.width;
        const h = active.canvas.height;
        const origImg = active.ctx.getImageData(0, 0, w, h);
        const orig = origImg.data;
        const isSelected = this.getSelectionCheck(active);

        // Blurred buffer
        const blurCanvas = document.createElement('canvas');
        blurCanvas.width = w;
        blurCanvas.height = h;
        const bCtx = blurCanvas.getContext('2d');
        bCtx.filter = `blur(${radius}px)`;
        bCtx.drawImage(active.canvas, 0, 0);
        bCtx.filter = 'none';
        const blurImg = bCtx.getImageData(0, 0, w, h);
        const blur = blurImg.data;

        for (let i = 0; i < orig.length; i += 4) {
            if (orig[i + 3] === 0 || !isSelected(i)) continue;
            for (let c = 0; c < 3; c++) {
                const diff = orig[i + c] - blur[i + c];
                if (Math.abs(diff) >= threshold) {
                    orig[i + c] = window.PSUtils.clamp(Math.round(orig[i + c] + diff * amount), 0, 255);
                }
            }
        }

        active.ctx.putImageData(origImg, 0, 0);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Unsharp Mask');
    },

    // --- Motion Blur ---
    applyMotionBlur(distance = 15, angleDeg = 0) {
        const active = window.PSLayers.getActiveDrawable() || window.PSLayers.getActiveLayer();
        if (!active || active.locked || active.isGroup) return;

        const w = active.canvas.width;
        const h = active.canvas.height;
        const srcImg = active.ctx.getImageData(0, 0, w, h);
        const dstImg = active.ctx.createImageData(w, h);
        const src = srcImg.data;
        const dst = dstImg.data;
        const isSelected = this.getSelectionCheck(active);

        const rad = (angleDeg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const halfDist = Math.max(1, Math.floor(distance / 2));

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const outIdx = (y * w + x) * 4;
                if (src[outIdx + 3] === 0 || !isSelected(outIdx)) {
                    dst[outIdx] = src[outIdx];
                    dst[outIdx + 1] = src[outIdx + 1];
                    dst[outIdx + 2] = src[outIdx + 2];
                    dst[outIdx + 3] = src[outIdx + 3];
                    continue;
                }

                let sumR = 0, sumG = 0, sumB = 0, count = 0;
                for (let s = -halfDist; s <= halfDist; s++) {
                    const sx = Math.round(x + s * cos);
                    const sy = Math.round(y + s * sin);
                    if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
                        const inIdx = (sy * w + sx) * 4;
                        if (src[inIdx + 3] > 0) {
                            sumR += src[inIdx];
                            sumG += src[inIdx + 1];
                            sumB += src[inIdx + 2];
                            count++;
                        }
                    }
                }

                if (count > 0) {
                    dst[outIdx] = Math.round(sumR / count);
                    dst[outIdx + 1] = Math.round(sumG / count);
                    dst[outIdx + 2] = Math.round(sumB / count);
                    dst[outIdx + 3] = src[outIdx + 3];
                } else {
                    dst[outIdx] = src[outIdx];
                    dst[outIdx + 1] = src[outIdx + 1];
                    dst[outIdx + 2] = src[outIdx + 2];
                    dst[outIdx + 3] = src[outIdx + 3];
                }
            }
        }

        active.ctx.putImageData(dstImg, 0, 0);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`Motion Blur (${distance}px)`);
    },

    // --- Median Filter ---
    applyMedianFilter(radius = 2) {
        const active = window.PSLayers.getActiveDrawable() || window.PSLayers.getActiveLayer();
        if (!active || active.locked || active.isGroup) return;

        const w = active.canvas.width;
        const h = active.canvas.height;
        const srcImg = active.ctx.getImageData(0, 0, w, h);
        const dstImg = active.ctx.createImageData(w, h);
        const src = srcImg.data;
        const dst = dstImg.data;
        const isSelected = this.getSelectionCheck(active);
        const r = Math.min(radius, 4);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const outIdx = (y * w + x) * 4;
                if (src[outIdx + 3] === 0 || !isSelected(outIdx)) {
                    dst[outIdx] = src[outIdx];
                    dst[outIdx + 1] = src[outIdx + 1];
                    dst[outIdx + 2] = src[outIdx + 2];
                    dst[outIdx + 3] = src[outIdx + 3];
                    continue;
                }

                const rArr = [], gArr = [], bArr = [];
                for (let ky = -r; ky <= r; ky++) {
                    const py = y + ky;
                    if (py < 0 || py >= h) continue;
                    for (let kx = -r; kx <= r; kx++) {
                        const px = x + kx;
                        if (px < 0 || px >= w) continue;
                        const idx = (py * w + px) * 4;
                        if (src[idx + 3] > 0) {
                            rArr.push(src[idx]);
                            gArr.push(src[idx + 1]);
                            bArr.push(src[idx + 2]);
                        }
                    }
                }

                if (rArr.length > 0) {
                    rArr.sort((a, b) => a - b);
                    gArr.sort((a, b) => a - b);
                    bArr.sort((a, b) => a - b);
                    const mid = Math.floor(rArr.length / 2);
                    dst[outIdx] = rArr[mid];
                    dst[outIdx + 1] = gArr[mid];
                    dst[outIdx + 2] = bArr[mid];
                    dst[outIdx + 3] = src[outIdx + 3];
                } else {
                    dst[outIdx] = src[outIdx];
                    dst[outIdx + 1] = src[outIdx + 1];
                    dst[outIdx + 2] = src[outIdx + 2];
                    dst[outIdx + 3] = src[outIdx + 3];
                }
            }
        }

        active.ctx.putImageData(dstImg, 0, 0);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Median Filter');
    },

    applyConvolution(layer, kernel) {
        const w = layer.canvas.width;
        const h = layer.canvas.height;
        const srcData = layer.ctx.getImageData(0, 0, w, h);
        const dstData = layer.ctx.createImageData(w, h);
        const src = srcData.data;
        const dst = dstData.data;

        const selectionActive = window.PSSelection && window.PSSelection.isActive;
        let maskData = null;
        const maskW = window.PSApp.width;
        const maskH = window.PSApp.height;
        if (selectionActive && window.PSSelection.maskCtx) {
            maskData = window.PSSelection.maskCtx.getImageData(0, 0, maskW, maskH).data;
        }

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const outIdx = (y * w + x) * 4;

                const cx = x + layer.x;
                const cy = y + layer.y;
                const isSelected = !selectionActive || !maskData || (cx >= 0 && cx < maskW && cy >= 0 && cy < maskH && maskData[(cy * maskW + cx) * 4 + 3] > 10);

                if (!isSelected) {
                    dst[outIdx] = src[outIdx];
                    dst[outIdx + 1] = src[outIdx + 1];
                    dst[outIdx + 2] = src[outIdx + 2];
                    dst[outIdx + 3] = src[outIdx + 3];
                    continue;
                }

                if (y === 0 || y === h - 1 || x === 0 || x === w - 1) {
                    dst[outIdx] = src[outIdx];
                    dst[outIdx + 1] = src[outIdx + 1];
                    dst[outIdx + 2] = src[outIdx + 2];
                    dst[outIdx + 3] = src[outIdx + 3];
                    continue;
                }

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

                dst[outIdx] = window.PSUtils.clamp(r, 0, 255);
                dst[outIdx + 1] = window.PSUtils.clamp(g, 0, 255);
                dst[outIdx + 2] = window.PSUtils.clamp(b, 0, 255);
                dst[outIdx + 3] = src[outIdx + 3];
            }
        }

        layer.ctx.putImageData(dstData, 0, 0);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Convolution Filter');
    }
};
