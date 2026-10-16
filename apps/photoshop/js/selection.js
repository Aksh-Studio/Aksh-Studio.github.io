/**
 * Aksh Photoshop - Selection Subsystem & Animated Marching Ants
 */

window.PSSelection = {
    isActive: false,
    type: null, // 'rect', 'ellipse', 'lasso', 'all', 'wand', 'custom'
    bounds: null, // { x, y, w, h }
    path: [], // array of { x, y } for polygon / lasso
    ellipseData: null, // { cx, cy, rx, ry }
    isInverted: false,
    invertedFrom: null, // { type, bounds, path, ellipseData }
    maskCanvas: null,
    maskCtx: null,
    dashOffset: 0,
    animFrameId: null,

    init(width, height) {
        this.maskCanvas = document.createElement('canvas');
        this.maskCanvas.width = width;
        this.maskCanvas.height = height;
        this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });
        this.deselect();
        this.startMarchingAntsLoop();
    },

    resize(width, height) {
        if (!this.maskCanvas) return;
        const temp = document.createElement('canvas');
        temp.width = this.maskCanvas.width;
        temp.height = this.maskCanvas.height;
        temp.getContext('2d').drawImage(this.maskCanvas, 0, 0);

        this.maskCanvas.width = width;
        this.maskCanvas.height = height;
        this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });
        this.maskCtx.drawImage(temp, 0, 0);
    },

    setRect(x, y, w, h) {
        if (w <= 0 || h <= 0) {
            this.deselect();
            return;
        }

        const width = window.PSApp.width;
        const height = window.PSApp.height;

        this.isActive = true;
        this.type = 'rect';
        this.isInverted = false;
        this.invertedFrom = null;
        this.ellipseData = null;
        this.bounds = {
            x: Math.max(0, Math.min(x, width)),
            y: Math.max(0, Math.min(y, height)),
            w: Math.min(w, width - x),
            h: Math.min(h, height - y)
        };
        this.path = [
            { x: this.bounds.x, y: this.bounds.y },
            { x: this.bounds.x + this.bounds.w, y: this.bounds.y },
            { x: this.bounds.x + this.bounds.w, y: this.bounds.y + this.bounds.h },
            { x: this.bounds.x, y: this.bounds.y + this.bounds.h }
        ];

        this.updateMaskCanvas();
        this.updateSelectionOptions();
    },

    setEllipse(cx, cy, rx, ry) {
        if (rx <= 0 || ry <= 0) {
            this.deselect();
            return;
        }

        this.isActive = true;
        this.type = 'ellipse';
        this.isInverted = false;
        this.invertedFrom = null;
        this.path = [];
        this.ellipseData = { cx, cy, rx, ry };
        this.bounds = {
            x: Math.round(cx - rx),
            y: Math.round(cy - ry),
            w: Math.round(rx * 2),
            h: Math.round(ry * 2)
        };

        this.updateMaskCanvas();
        this.updateSelectionOptions();
    },

    setLasso(points) {
        if (!points || points.length < 3) {
            this.deselect();
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });

        this.isActive = true;
        this.type = 'lasso';
        this.isInverted = false;
        this.invertedFrom = null;
        this.ellipseData = null;
        this.path = [...points];
        this.bounds = {
            x: Math.round(minX),
            y: Math.round(minY),
            w: Math.round(maxX - minX),
            h: Math.round(maxY - minY)
        };

        this.updateMaskCanvas();
        this.updateSelectionOptions();
    },

    setCustomMask(sourceCanvasOrImageData, bounds) {
        this.isActive = true;
        this.type = 'custom';
        this.isInverted = false;
        this.invertedFrom = null;
        this.ellipseData = null;
        this.path = [];
        this.bounds = bounds || { x: 0, y: 0, w: window.PSApp.width, h: window.PSApp.height };

        if (!this.maskCtx) return;
        this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
        if (sourceCanvasOrImageData instanceof ImageData) {
            this.maskCtx.putImageData(sourceCanvasOrImageData, 0, 0);
        } else if (sourceCanvasOrImageData instanceof HTMLCanvasElement) {
            this.maskCtx.drawImage(sourceCanvasOrImageData, 0, 0);
        }
        this.updateSelectionOptions();
    },

    selectAll() {
        this.setRect(0, 0, window.PSApp.width, window.PSApp.height);
        this.type = 'all';
    },

    deselect() {
        this.isActive = false;
        this.type = null;
        this.bounds = null;
        this.path = [];
        this.ellipseData = null;
        this.isInverted = false;
        this.invertedFrom = null;
        if (this.maskCtx) {
            this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
        }
        this.updateSelectionOptions();
    },

    invert() {
        if (!this.isActive) {
            this.selectAll();
            return;
        }

        const w = window.PSApp.width;
        const h = window.PSApp.height;
        const temp = document.createElement('canvas');
        temp.width = w;
        temp.height = h;
        const tCtx = temp.getContext('2d');

        // Draw solid white
        tCtx.fillStyle = '#ffffff';
        tCtx.fillRect(0, 0, w, h);

        // Subtract current mask
        tCtx.globalCompositeOperation = 'destination-out';
        tCtx.drawImage(this.maskCanvas, 0, 0);

        this.maskCtx.clearRect(0, 0, w, h);
        this.maskCtx.drawImage(temp, 0, 0);

        if (!this.isInverted) {
            this.invertedFrom = {
                type: this.type,
                bounds: this.bounds ? { ...this.bounds } : null,
                path: this.path ? [...this.path] : [],
                ellipseData: this.ellipseData ? { ...this.ellipseData } : null
            };
            this.isInverted = true;
        } else {
            this.isInverted = false;
            if (this.invertedFrom) {
                this.type = this.invertedFrom.type;
                this.bounds = this.invertedFrom.bounds;
                this.path = this.invertedFrom.path;
                this.ellipseData = this.invertedFrom.ellipseData;
                this.invertedFrom = null;
                this.updateSelectionOptions();
                return;
            }
        }

        this.type = 'custom';
        this.bounds = { x: 0, y: 0, w: w, h: h };
        this.updateSelectionOptions();
    },

    expand(radius = 5) {
        if (!this.isActive || !this.maskCanvas || radius <= 0) return;
        if (this.type !== 'custom') {
            this.updateMaskCanvas(); // ensure maskCanvas is up to date
        }

        const w = this.maskCanvas.width;
        const h = this.maskCanvas.height;
        const srcImg = this.maskCtx.getImageData(0, 0, w, h);
        const src = srcImg.data;
        const r = Math.min(Math.round(radius), 100);

        const alphaIn = new Uint8Array(w * h);
        for (let i = 0; i < alphaIn.length; i++) {
            alphaIn[i] = src[i * 4 + 3];
        }

        // Horizontal pass
        const alphaH = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
            const rowOffset = y * w;
            for (let x = 0; x < w; x++) {
                let maxVal = 0;
                const xStart = Math.max(0, x - r);
                const xEnd = Math.min(w - 1, x + r);
                for (let kx = xStart; kx <= xEnd; kx++) {
                    if (alphaIn[rowOffset + kx] > maxVal) {
                        maxVal = alphaIn[rowOffset + kx];
                        if (maxVal === 255) break;
                    }
                }
                alphaH[rowOffset + x] = maxVal;
            }
        }

        // Vertical pass
        for (let y = 0; y < h; y++) {
            const rowOffset = y * w;
            const yStart = Math.max(0, y - r);
            const yEnd = Math.min(h - 1, y + r);
            for (let x = 0; x < w; x++) {
                let maxVal = 0;
                for (let ky = yStart; ky <= yEnd; ky++) {
                    const val = alphaH[ky * w + x];
                    if (val > maxVal) {
                        maxVal = val;
                        if (maxVal === 255) break;
                    }
                }
                const idx = (rowOffset + x) * 4;
                src[idx] = 255;
                src[idx + 1] = 255;
                src[idx + 2] = 255;
                src[idx + 3] = maxVal;
            }
        }

        this.maskCtx.putImageData(srcImg, 0, 0);
        this.type = 'custom';
        this.path = [];
        this.ellipseData = null;
        this.recalculateCustomBounds();
        this.updateSelectionOptions();
        window.PSHistory.saveState(`Expand Selection (${radius}px)`);
    },

    contract(radius = 5) {
        if (!this.isActive || !this.maskCanvas || radius <= 0) return;
        if (this.type !== 'custom') {
            this.updateMaskCanvas();
        }

        const w = this.maskCanvas.width;
        const h = this.maskCanvas.height;
        const srcImg = this.maskCtx.getImageData(0, 0, w, h);
        const src = srcImg.data;
        const r = Math.min(Math.round(radius), 100);

        const alphaIn = new Uint8Array(w * h);
        for (let i = 0; i < alphaIn.length; i++) {
            alphaIn[i] = src[i * 4 + 3];
        }

        // Horizontal pass
        const alphaH = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
            const rowOffset = y * w;
            for (let x = 0; x < w; x++) {
                let minVal = 255;
                const xStart = Math.max(0, x - r);
                const xEnd = Math.min(w - 1, x + r);
                for (let kx = xStart; kx <= xEnd; kx++) {
                    if (alphaIn[rowOffset + kx] < minVal) {
                        minVal = alphaIn[rowOffset + kx];
                        if (minVal === 0) break;
                    }
                }
                alphaH[rowOffset + x] = minVal;
            }
        }

        // Vertical pass
        for (let y = 0; y < h; y++) {
            const rowOffset = y * w;
            const yStart = Math.max(0, y - r);
            const yEnd = Math.min(h - 1, y + r);
            for (let x = 0; x < w; x++) {
                let minVal = 255;
                for (let ky = yStart; ky <= yEnd; ky++) {
                    const val = alphaH[ky * w + x];
                    if (val < minVal) {
                        minVal = val;
                        if (minVal === 0) break;
                    }
                }
                const idx = (rowOffset + x) * 4;
                src[idx] = 255;
                src[idx + 1] = 255;
                src[idx + 2] = 255;
                src[idx + 3] = minVal;
            }
        }

        this.maskCtx.putImageData(srcImg, 0, 0);
        this.type = 'custom';
        this.path = [];
        this.ellipseData = null;
        this.recalculateCustomBounds();
        this.updateSelectionOptions();
        window.PSHistory.saveState(`Contract Selection (${radius}px)`);
    },

    feather(radius = 5) {
        if (!this.isActive || !this.maskCanvas || radius <= 0) return;
        if (this.type !== 'custom') {
            this.updateMaskCanvas();
        }

        const w = this.maskCanvas.width;
        const h = this.maskCanvas.height;
        const temp = document.createElement('canvas');
        temp.width = w;
        temp.height = h;
        const tCtx = temp.getContext('2d');
        tCtx.filter = `blur(${radius}px)`;
        tCtx.drawImage(this.maskCanvas, 0, 0);
        tCtx.filter = 'none';

        this.maskCtx.clearRect(0, 0, w, h);
        this.maskCtx.drawImage(temp, 0, 0);
        this.type = 'custom';
        this.path = [];
        this.ellipseData = null;
        this.recalculateCustomBounds();
        this.updateSelectionOptions();
        window.PSHistory.saveState(`Feather Selection (${radius}px)`);
    },

    recalculateCustomBounds() {
        if (!this.maskCanvas) return;
        const w = this.maskCanvas.width;
        const h = this.maskCanvas.height;
        const img = this.maskCtx.getImageData(0, 0, w, h);
        const d = img.data;
        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let y = 0; y < h; y++) {
            const row = y * w;
            for (let x = 0; x < w; x++) {
                if (d[(row + x) * 4 + 3] > 10) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX >= minX && maxY >= minY) {
            this.bounds = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
        } else {
            this.deselect();
        }
    },

    copy() {
        const active = window.PSLayers.getActiveLayer();
        if (!active || active.isGroup) return false;

        const clipCanvas = document.createElement('canvas');
        clipCanvas.width = active.canvas.width;
        clipCanvas.height = active.canvas.height;
        const cCtx = clipCanvas.getContext('2d');
        cCtx.drawImage(active.canvas, 0, 0);

        if (this.isActive && this.maskCanvas) {
            cCtx.globalCompositeOperation = 'destination-in';
            cCtx.drawImage(this.maskCanvas, -active.x, -active.y);
        }

        window.PSApp.clipboard = {
            canvas: clipCanvas,
            x: active.x,
            y: active.y,
            w: clipCanvas.width,
            h: clipCanvas.height
        };
        return true;
    },

    cut() {
        const copied = this.copy();
        if (copied) {
            const active = window.PSLayers.getActiveLayer();
            if (active && !active.locked) {
                window.PSLayers.clearActiveLayer();
            }
        }
        return copied;
    },

    paste() {
        if (!window.PSApp.clipboard || !window.PSApp.clipboard.canvas) return false;
        const clip = window.PSApp.clipboard;
        const layer = window.PSLayers.addNewLayer('Pasted Layer');
        layer.x = clip.x || 0;
        layer.y = clip.y || 0;
        layer.ctx.drawImage(clip.canvas, 0, 0);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Paste');
        return true;
    },

    updateMaskCanvas() {
        if (!this.maskCtx || this.type === 'custom') return;
        const w = this.maskCanvas.width;
        const h = this.maskCanvas.height;
        this.maskCtx.clearRect(0, 0, w, h);

        if (!this.isActive) return;

        this.maskCtx.fillStyle = '#ffffff';
        if (this.type === 'ellipse' && this.ellipseData) {
            this.maskCtx.beginPath();
            this.maskCtx.ellipse(this.ellipseData.cx, this.ellipseData.cy, this.ellipseData.rx, this.ellipseData.ry, 0, 0, Math.PI * 2);
            this.maskCtx.fill();
        } else if (this.path && this.path.length > 2) {
            this.maskCtx.beginPath();
            this.maskCtx.moveTo(this.path[0].x, this.path[0].y);
            for (let i = 1; i < this.path.length; i++) {
                this.maskCtx.lineTo(this.path[i].x, this.path[i].y);
            }
            this.maskCtx.closePath();
            this.maskCtx.fill();
        } else if (this.bounds) {
            this.maskCtx.fillRect(this.bounds.x, this.bounds.y, this.bounds.w, this.bounds.h);
        }
    },

    applySelectionClip(ctx, layerX = 0, layerY = 0) {
        if (!this.isActive) return false;

        const docW = window.PSApp.width;
        const docH = window.PSApp.height;

        ctx.beginPath();

        if (this.isInverted && this.invertedFrom) {
            // Use evenodd clipping rule: outer canvas rect + inner shape path
            ctx.rect(-layerX, -layerY, docW, docH);
            const orig = this.invertedFrom;
            if (orig.type === 'ellipse' && orig.ellipseData) {
                const cx = orig.ellipseData.cx - layerX;
                const cy = orig.ellipseData.cy - layerY;
                ctx.moveTo(cx + orig.ellipseData.rx, cy);
                ctx.ellipse(cx, cy, orig.ellipseData.rx, orig.ellipseData.ry, 0, 0, Math.PI * 2);
            } else if (orig.path && orig.path.length > 2) {
                ctx.moveTo(orig.path[0].x - layerX, orig.path[0].y - layerY);
                for (let i = 1; i < orig.path.length; i++) {
                    ctx.lineTo(orig.path[i].x - layerX, orig.path[i].y - layerY);
                }
                ctx.closePath();
            } else if (orig.bounds) {
                ctx.rect(orig.bounds.x - layerX, orig.bounds.y - layerY, orig.bounds.w, orig.bounds.h);
            }
            ctx.clip('evenodd');
            return true;
        }

        if (this.type === 'ellipse' && this.ellipseData) {
            const cx = this.ellipseData.cx - layerX;
            const cy = this.ellipseData.cy - layerY;
            ctx.ellipse(cx, cy, Math.max(0.1, this.ellipseData.rx), Math.max(0.1, this.ellipseData.ry), 0, 0, Math.PI * 2);
            ctx.clip();
            return true;
        }

        if (this.path && this.path.length > 2 && this.type !== 'custom') {
            ctx.moveTo(this.path[0].x - layerX, this.path[0].y - layerY);
            for (let i = 1; i < this.path.length; i++) {
                ctx.lineTo(this.path[i].x - layerX, this.path[i].y - layerY);
            }
            ctx.closePath();
            ctx.clip();
            return true;
        }

        if (this.bounds) {
            ctx.rect(this.bounds.x - layerX, this.bounds.y - layerY, this.bounds.w, this.bounds.h);
            ctx.clip();
            return true;
        }

        ctx.rect(-layerX, -layerY, docW, docH);
        ctx.clip();
        return true;

        return false;
    },

    clearSelectionPixels(layer) {
        if (!layer) return;
        const ctx = layer.ctx;
        if (!this.isActive) {
            ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
            return;
        }

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(this.maskCanvas, -layer.x, -layer.y);
        ctx.restore();
    },

    fillSelectionPixels(layer, fillColor) {
        if (!layer) return;
        const ctx = layer.ctx;
        if (!this.isActive) {
            ctx.fillStyle = fillColor;
            ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
            return;
        }

        const temp = document.createElement('canvas');
        temp.width = layer.canvas.width;
        temp.height = layer.canvas.height;
        const tCtx = temp.getContext('2d');
        tCtx.fillStyle = fillColor;
        tCtx.fillRect(0, 0, temp.width, temp.height);
        tCtx.globalCompositeOperation = 'destination-in';
        tCtx.drawImage(this.maskCanvas, -layer.x, -layer.y);

        ctx.drawImage(temp, 0, 0);
    },

    startMarchingAntsLoop() {
        const drawAnts = () => {
            this.renderMarchingAnts();
            this.animFrameId = requestAnimationFrame(drawAnts);
        };
        if (!this.animFrameId) {
            this.animFrameId = requestAnimationFrame(drawAnts);
        }
    },

    renderMarchingAnts() {
        if (!this.isActive) return;
        const overlay = document.getElementById('overlay-canvas');
        if (!overlay) return;

        if (window.PSTools && window.PSTools.isDrawing && !['marquee', 'lasso'].includes(window.PSTools.currentTool)) {
            return;
        }

        const ctx = overlay.getContext('2d');
        this.dashOffset = (this.dashOffset + 0.4) % 16;

        ctx.save();
        ctx.lineWidth = 1;
        ctx.lineJoin = 'miter';

        // Base black border
        ctx.strokeStyle = '#000000';
        ctx.setLineDash([]);
        this.tracePath(ctx);
        ctx.stroke();

        // Animated white dash
        ctx.strokeStyle = '#ffffff';
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -this.dashOffset;
        this.tracePath(ctx);
        ctx.stroke();

        ctx.restore();
    },

    tracePath(ctx) {
        ctx.beginPath();
        if (this.isInverted && this.invertedFrom) {
            const orig = this.invertedFrom;
            if (orig.type === 'ellipse' && orig.ellipseData) {
                ctx.ellipse(orig.ellipseData.cx, orig.ellipseData.cy, orig.ellipseData.rx, orig.ellipseData.ry, 0, 0, Math.PI * 2);
            } else if (orig.path && orig.path.length > 2) {
                ctx.moveTo(orig.path[0].x, orig.path[0].y);
                for (let i = 1; i < orig.path.length; i++) {
                    ctx.lineTo(orig.path[i].x, orig.path[i].y);
                }
                ctx.closePath();
            } else if (orig.bounds) {
                ctx.rect(orig.bounds.x + 0.5, orig.bounds.y + 0.5, orig.bounds.w, orig.bounds.h);
            }
            // Also trace canvas edge
            ctx.rect(0.5, 0.5, window.PSApp.width - 1, window.PSApp.height - 1);
            return;
        }

        if (this.type === 'ellipse' && this.ellipseData) {
            ctx.ellipse(this.ellipseData.cx, this.ellipseData.cy, this.ellipseData.rx, this.ellipseData.ry, 0, 0, Math.PI * 2);
        } else if (this.path && this.path.length > 2 && this.type !== 'custom') {
            ctx.moveTo(this.path[0].x, this.path[0].y);
            for (let i = 1; i < this.path.length; i++) {
                ctx.lineTo(this.path[i].x, this.path[i].y);
            }
            ctx.closePath();
        } else if (this.bounds) {
            ctx.rect(this.bounds.x + 0.5, this.bounds.y + 0.5, this.bounds.w, this.bounds.h);
        }
    },

    updateSelectionOptions() {
        const optSelection = document.getElementById('opt-group-selection');
        if (optSelection) {
            optSelection.classList.toggle('hidden', !this.isActive);
        }
    }
};
