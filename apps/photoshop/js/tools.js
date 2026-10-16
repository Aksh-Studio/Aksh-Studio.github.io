/**
 * Aksh Photoshop - Interactive Drawing, Selection, Flood Fill & Transform Tools
 */
window.PSTools = {
    currentTool: 'brush',
    isDrawing: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    fgColor: '#00d2ff',
    bgColor: '#ffffff',
    size: 15,
    opacity: 100,
    shapeMode: 'fill',
    tolerance: 32,
    fontFamily: 'Inter, sans-serif',
    isBold: false,
    isItalic: false,
    cropRect: null,
    selectionRect: null,
    pendingTextPos: null,

    toolMeta: {
        move: { name: 'Move Layer Tool', icon: 'fa-up-down-left-right' },
        marquee: { name: 'Rectangular Marquee', icon: 'fa-square-dashed' },
        crop: { name: 'Crop Canvas Tool', icon: 'fa-crop-simple' },
        brush: { name: 'Brush Tool', icon: 'fa-paintbrush' },
        eraser: { name: 'Eraser Tool', icon: 'fa-eraser' },
        bucket: { name: 'Paint Bucket Fill', icon: 'fa-fill-drip' },
        gradient: { name: 'Linear Gradient', icon: 'fa-swatchbook' },
        line: { name: 'Line Tool', icon: 'fa-slash' },
        rect: { name: 'Rectangle Tool', icon: 'fa-square' },
        circle: { name: 'Ellipse Tool', icon: 'fa-circle' },
        text: { name: 'Text Tool', icon: 'fa-font' },
        eyedropper: { name: 'Eyedropper Tool', icon: 'fa-eye-dropper' },
        hand: { name: 'Hand / Pan Tool', icon: 'fa-hand' }
    },

    init() {
        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectTool(btn.dataset.tool);
            });
        });

        // Options listeners
        const sizeInput = document.getElementById('opt-size');
        const sizeVal = document.getElementById('opt-size-val');
        if (sizeInput) {
            sizeInput.addEventListener('input', () => {
                this.size = parseInt(sizeInput.value, 10);
                if (sizeVal) sizeVal.textContent = `${this.size}px`;
            });
        }

        const opInput = document.getElementById('opt-opacity');
        const opVal = document.getElementById('opt-opacity-val');
        if (opInput) {
            opInput.addEventListener('input', () => {
                this.opacity = parseInt(opInput.value, 10);
                if (opVal) opVal.textContent = `${this.opacity}%`;
            });
        }

        const shapeModeSelect = document.getElementById('opt-shape-mode');
        if (shapeModeSelect) {
            shapeModeSelect.addEventListener('change', () => {
                this.shapeMode = shapeModeSelect.value;
            });
        }

        const tolInput = document.getElementById('opt-tolerance');
        const tolVal = document.getElementById('opt-tolerance-val');
        if (tolInput) {
            tolInput.addEventListener('input', () => {
                this.tolerance = parseInt(tolInput.value, 10);
                if (tolVal) tolVal.textContent = this.tolerance;
            });
        }

        // Colors
        const fgEl = document.getElementById('fg-color');
        const bgEl = document.getElementById('bg-color');
        const swapBtn = document.getElementById('btn-swap-colors');

        if (fgEl) fgEl.addEventListener('input', () => { this.fgColor = fgEl.value; });
        if (bgEl) bgEl.addEventListener('input', () => { this.bgColor = bgEl.value; });
        if (swapBtn) {
            swapBtn.addEventListener('click', () => {
                const temp = this.fgColor;
                this.fgColor = this.bgColor;
                this.bgColor = temp;
                if (fgEl) fgEl.value = this.fgColor;
                if (bgEl) bgEl.value = this.bgColor;
            });
        }

        // Text options
        const fontSelect = document.getElementById('opt-font-family');
        const boldBtn = document.getElementById('opt-text-bold');
        const italicBtn = document.getElementById('opt-text-italic');
        if (fontSelect) fontSelect.addEventListener('change', () => { this.fontFamily = fontSelect.value; });
        if (boldBtn) boldBtn.addEventListener('click', () => {
            this.isBold = !this.isBold;
            boldBtn.classList.toggle('active', this.isBold);
        });
        if (italicBtn) italicBtn.addEventListener('click', () => {
            this.isItalic = !this.isItalic;
            italicBtn.classList.toggle('active', this.isItalic);
        });

        // Crop actions
        const applyCropBtn = document.getElementById('btn-apply-crop');
        const cancelCropBtn = document.getElementById('btn-cancel-crop');
        if (applyCropBtn) applyCropBtn.addEventListener('click', () => this.executeCrop());
        if (cancelCropBtn) cancelCropBtn.addEventListener('click', () => {
            this.cropRect = null;
            this.clearOverlay();
        });

        // Bind Pointer / Mouse / Touch Events on Overlay Canvas
        const overlay = document.getElementById('overlay-canvas');
        if (overlay) {
            overlay.addEventListener('mousedown', (e) => this.onPointerDown(e));
            window.addEventListener('mousemove', (e) => this.onPointerMove(e));
            window.addEventListener('mouseup', (e) => this.onPointerUp(e));

            overlay.addEventListener('touchstart', (e) => { e.preventDefault(); this.onPointerDown(e); }, { passive: false });
            window.addEventListener('touchmove', (e) => { if (this.isDrawing) e.preventDefault(); this.onPointerMove(e); }, { passive: false });
            window.addEventListener('touchend', (e) => this.onPointerUp(e));
        }
    },

    selectTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === tool);
        });

        const meta = this.toolMeta[tool] || { name: tool, icon: 'fa-screwdriver-wrench' };
        const nameEl = document.getElementById('opt-tool-name');
        const iconEl = document.getElementById('opt-tool-icon');
        if (nameEl) nameEl.textContent = meta.name;
        if (iconEl) iconEl.className = `fa-solid ${meta.icon}`;

        // Toggle context-sensitive option groups
        document.getElementById('opt-group-shape')?.classList.toggle('hidden', !['rect', 'circle'].includes(tool));
        document.getElementById('opt-group-tolerance')?.classList.toggle('hidden', tool !== 'bucket');
        document.getElementById('opt-group-text')?.classList.toggle('hidden', tool !== 'text');
        document.getElementById('opt-group-crop')?.classList.toggle('hidden', tool !== 'crop');

        this.clearOverlay();
    },

    clearOverlay() {
        const overlay = document.getElementById('overlay-canvas');
        if (!overlay) return;
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);
    },

    onPointerDown(e) {
        const overlay = document.getElementById('overlay-canvas');
        const coords = window.PSUtils.getCanvasCoords(e, overlay);
        const layer = window.PSLayers.getActiveLayer();

        if (this.currentTool === 'hand') {
            this.isDrawing = true;
            this.startX = e.clientX || (e.touches && e.touches[0].clientX);
            this.startY = e.clientY || (e.touches && e.touches[0].clientY);
            return;
        }

        if (!layer || !layer.visible) return;

        this.isDrawing = true;
        this.startX = coords.x;
        this.startY = coords.y;
        this.lastX = coords.x;
        this.lastY = coords.y;

        if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
            this.drawStrokeSegment(layer, coords.x, coords.y, coords.x, coords.y);
            window.PSLayers.compositeAll();
        } else if (this.currentTool === 'bucket') {
            this.isDrawing = false;
            this.floodFill(layer, coords.x - layer.x, coords.y - layer.y, this.fgColor, this.tolerance);
            window.PSLayers.compositeAll();
            window.PSLayers.renderLayersList();
            window.PSHistory.saveState('Flood Fill');
        } else if (this.currentTool === 'eyedropper') {
            this.isDrawing = false;
            this.pickColor(coords.x, coords.y);
        } else if (this.currentTool === 'text') {
            this.isDrawing = false;
            this.pendingTextPos = { x: coords.x - layer.x, y: coords.y - layer.y };
            window.PSApp.openTextModal();
        }
    },

    onPointerMove(e) {
        const overlay = document.getElementById('overlay-canvas');
        if (!overlay) return;
        const coords = window.PSUtils.getCanvasCoords(e, overlay);

        // Update coordinate display
        const coordLabel = document.getElementById('status-coords');
        if (coordLabel) {
            coordLabel.innerHTML = `<i class="fa-solid fa-crosshairs"></i> X: ${coords.x}, Y: ${coords.y}`;
        }

        if (!this.isDrawing) return;

        if (this.currentTool === 'hand') {
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            const dx = clientX - this.startX;
            const dy = clientY - this.startY;
            this.startX = clientX;
            this.startY = clientY;
            window.PSApp.panBy(dx, dy);
            return;
        }

        const layer = window.PSLayers.getActiveLayer();
        if (!layer) return;

        if (this.currentTool === 'move') {
            const dx = coords.x - this.lastX;
            const dy = coords.y - this.lastY;
            layer.x += dx;
            layer.y += dy;
            this.lastX = coords.x;
            this.lastY = coords.y;
            window.PSLayers.compositeAll();
        } else if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
            this.drawStrokeSegment(layer, this.lastX, this.lastY, coords.x, coords.y);
            this.lastX = coords.x;
            this.lastY = coords.y;
            window.PSLayers.compositeAll();
        } else if (['line', 'rect', 'circle', 'gradient', 'crop', 'marquee'].includes(this.currentTool)) {
            this.renderPreviewOverlay(this.startX, this.startY, coords.x, coords.y);
        }
    },

    onPointerUp(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this.currentTool === 'hand') return;

        const overlay = document.getElementById('overlay-canvas');
        const coords = window.PSUtils.getCanvasCoords(e, overlay);
        const layer = window.PSLayers.getActiveLayer();
        if (!layer) return;

        if (this.currentTool === 'brush' || this.currentTool === 'eraser' || this.currentTool === 'move') {
            window.PSLayers.renderLayersList();
            window.PSHistory.saveState(this.toolMeta[this.currentTool].name);
        } else if (['line', 'rect', 'circle', 'gradient'].includes(this.currentTool)) {
            this.commitShapeToLayer(layer, this.startX - layer.x, this.startY - layer.y, coords.x - layer.x, coords.y - layer.y);
            this.clearOverlay();
            window.PSLayers.compositeAll();
            window.PSLayers.renderLayersList();
            window.PSHistory.saveState(this.toolMeta[this.currentTool].name);
        } else if (this.currentTool === 'crop') {
            this.cropRect = {
                x: Math.min(this.startX, coords.x),
                y: Math.min(this.startY, coords.y),
                w: Math.abs(coords.x - this.startX),
                h: Math.abs(coords.y - this.startY)
            };
        } else if (this.currentTool === 'marquee') {
            this.selectionRect = {
                x: Math.min(this.startX, coords.x),
                y: Math.min(this.startY, coords.y),
                w: Math.abs(coords.x - this.startX),
                h: Math.abs(coords.y - this.startY)
            };
        }
    },

    drawStrokeSegment(layer, x1, y1, x2, y2) {
        const ctx = layer.ctx;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = this.size;
        ctx.globalAlpha = this.opacity / 100;

        if (this.currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = this.fgColor;
        }

        ctx.beginPath();
        ctx.moveTo(x1 - layer.x, y1 - layer.y);
        ctx.lineTo(x2 - layer.x, y2 - layer.y);
        ctx.stroke();
        ctx.restore();
    },

    renderPreviewOverlay(x1, y1, x2, y2) {
        const overlay = document.getElementById('overlay-canvas');
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        ctx.save();

        if (this.currentTool === 'crop' || this.currentTool === 'marquee') {
            ctx.strokeStyle = '#00d2ff';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            if (this.currentTool === 'crop') {
                ctx.fillStyle = 'rgba(0, 210, 255, 0.12)';
                ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
            }
        } else {
            this.drawVectorShape(ctx, x1, y1, x2, y2);
        }

        ctx.restore();
    },

    commitShapeToLayer(layer, x1, y1, x2, y2) {
        const ctx = layer.ctx;
        ctx.save();
        this.drawVectorShape(ctx, x1, y1, x2, y2);
        ctx.restore();
    },

    drawVectorShape(ctx, x1, y1, x2, y2) {
        ctx.globalAlpha = this.opacity / 100;
        ctx.lineWidth = this.size;
        ctx.strokeStyle = this.fgColor;
        ctx.fillStyle = this.fgColor;
        ctx.lineCap = 'round';

        if (this.currentTool === 'line') {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        } else if (this.currentTool === 'rect') {
            const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
            const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
            if (this.shapeMode === 'fill' || this.shapeMode === 'both') {
                ctx.fillStyle = this.shapeMode === 'both' ? this.bgColor : this.fgColor;
                ctx.fillRect(rx, ry, rw, rh);
            }
            if (this.shapeMode === 'stroke' || this.shapeMode === 'both') {
                ctx.strokeRect(rx, ry, rw, rh);
            }
        } else if (this.currentTool === 'circle') {
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            const rx = Math.abs(x2 - x1) / 2;
            const ry = Math.abs(y2 - y1) / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            if (this.shapeMode === 'fill' || this.shapeMode === 'both') {
                ctx.fillStyle = this.shapeMode === 'both' ? this.bgColor : this.fgColor;
                ctx.fill();
            }
            if (this.shapeMode === 'stroke' || this.shapeMode === 'both') {
                ctx.stroke();
            }
        } else if (this.currentTool === 'gradient') {
            const grad = ctx.createLinearGradient(x1, y1, x2, y2);
            grad.addColorStop(0, this.fgColor);
            grad.addColorStop(1, this.bgColor);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
    },

    placeText(text) {
        if (!text || !this.pendingTextPos) return;
        const layer = window.PSLayers.addNewLayer(`Text: ${text.slice(0, 12)}`);
        const ctx = layer.ctx;
        ctx.save();
        const style = `${this.isItalic ? 'italic ' : ''}${this.isBold ? 'bold ' : ''}${Math.max(12, this.size * 2)}px ${this.fontFamily}`;
        ctx.font = style;
        ctx.fillStyle = this.fgColor;
        ctx.globalAlpha = this.opacity / 100;
        ctx.textBaseline = 'top';
        ctx.fillText(text, this.pendingTextPos.x, this.pendingTextPos.y);
        ctx.restore();

        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSHistory.saveState('Add Text');
    },

    pickColor(x, y) {
        const mainCanvas = document.getElementById('main-canvas');
        const ctx = mainCanvas.getContext('2d');
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        if (pixel[3] > 0) {
            const hex = window.PSUtils.rgbToHex(pixel[0], pixel[1], pixel[2]);
            this.fgColor = hex;
            const fgEl = document.getElementById('fg-color');
            if (fgEl) fgEl.value = hex;
        }
    },

    executeCrop() {
        if (!this.cropRect || this.cropRect.w < 10 || this.cropRect.h < 10) return;
        const { x, y, w, h } = this.cropRect;

        window.PSLayers.layers.forEach(layer => {
            const temp = document.createElement('canvas');
            temp.width = w;
            temp.height = h;
            const tCtx = temp.getContext('2d');
            tCtx.drawImage(layer.canvas, x - layer.x, y - layer.y, w, h, 0, 0, w, h);

            layer.canvas.width = w;
            layer.canvas.height = h;
            layer.ctx = layer.canvas.getContext('2d');
            layer.ctx.drawImage(temp, 0, 0);
            layer.x = 0;
            layer.y = 0;
        });

        window.PSApp.setCanvasDimensions(w, h, false);
        this.cropRect = null;
        this.clearOverlay();
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSHistory.saveState('Crop Canvas');
    },

    floodFill(layer, startX, startY, fillHex, tolerance) {
        const w = layer.canvas.width;
        const h = layer.canvas.height;
        if (startX < 0 || startY < 0 || startX >= w || startY >= h) return;

        const imgData = layer.ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const fillRgba = window.PSUtils.hexToRgba(fillHex, Math.round((this.opacity / 100) * 255));

        const startPos = (startY * w + startX) * 4;
        const startR = data[startPos];
        const startG = data[startPos + 1];
        const startB = data[startPos + 2];
        const startA = data[startPos + 3];

        if (
            Math.abs(startR - fillRgba.r) <= 2 &&
            Math.abs(startG - fillRgba.g) <= 2 &&
            Math.abs(startB - fillRgba.b) <= 2 &&
            Math.abs(startA - fillRgba.a) <= 2
        ) {
            return;
        }

        const visited = new Uint8Array(w * h);
        const stack = [[startX, startY]];

        const matches = (pos) => {
            return (
                Math.abs(data[pos] - startR) <= tolerance &&
                Math.abs(data[pos + 1] - startG) <= tolerance &&
                Math.abs(data[pos + 2] - startB) <= tolerance &&
                Math.abs(data[pos + 3] - startA) <= tolerance
            );
        };

        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const pixelIdx = cy * w + cx;
            if (visited[pixelIdx]) continue;

            const pos = pixelIdx * 4;
            if (!matches(pos)) continue;

            visited[pixelIdx] = 1;
            data[pos] = fillRgba.r;
            data[pos + 1] = fillRgba.g;
            data[pos + 2] = fillRgba.b;
            data[pos + 3] = fillRgba.a;

            if (cx > 0) stack.push([cx - 1, cy]);
            if (cx < w - 1) stack.push([cx + 1, cy]);
            if (cy > 0) stack.push([cx, cy - 1]);
            if (cy < h - 1) stack.push([cx, cy + 1]);
        }

        layer.ctx.putImageData(imgData, 0, 0);
    }
};
