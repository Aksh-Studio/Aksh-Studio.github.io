/**
 * Aksh Photoshop - Complete Suite of Interactive Raster, Vector, Selection & Navigation Tools
 */

window.PSTools = {
    currentTool: 'brush',
    isDrawing: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    pointsBuffer: [],
    fgColor: '#00d2ff',
    bgColor: '#ffffff',
    size: 15,
    opacity: 100,
    hardness: 85,
    shapeMode: 'fill',
    marqueeShape: 'rect', // 'rect' or 'ellipse'
    tolerance: 32,
    gradientType: 'linear', // 'linear' or 'radial'
    fontFamily: 'Inter, sans-serif',
    fontSize: 36,
    isBold: false,
    isItalic: false,
    cropRect: null,
    cloneSource: null,
    cloneOffset: null,
    lassoPoints: [],
    pendingTextPos: null,

    transformState: {
        active: false,
        layer: null,
        backupCanvas: null,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        origW: 0,
        origH: 0,
        rotation: 0,
        activeHandle: null,
        startMouseX: 0,
        startMouseY: 0,
        origTransformX: 0,
        origTransformY: 0
    },

    toolMeta: {
        move: { name: 'Move Layer Tool', icon: 'move' },
        marquee: { name: 'Marquee Selection', icon: 'marquee' },
        lasso: { name: 'Lasso Selection Tool', icon: 'lasso' },
        wand: { name: 'Magic Wand Selector', icon: 'wand' },
        crop: { name: 'Crop Canvas Tool', icon: 'crop' },
        eyedropper: { name: 'Eyedropper Tool', icon: 'eyedropper' },
        brush: { name: 'Brush Tool', icon: 'brush' },
        eraser: { name: 'Eraser Tool', icon: 'eraser' },
        stamp: { name: 'Clone Stamp Tool', icon: 'stamp' },
        bucket: { name: 'Paint Bucket Fill', icon: 'bucket' },
        gradient: { name: 'Gradient Tool', icon: 'gradient' },
        line: { name: 'Line Tool', icon: 'line' },
        rect: { name: 'Rectangle Tool', icon: 'rect' },
        circle: { name: 'Ellipse Tool', icon: 'circle' },
        text: { name: 'Text Tool', icon: 'text' },
        hand: { name: 'Hand / Pan Tool', icon: 'hand' },
        zoom: { name: 'Zoom Tool', icon: 'zoom-in' }
    },

    init() {
        // Tool button activations
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectTool(btn.dataset.tool);
            });
        });

        // Sliders & Contextual Options
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

        const hardInput = document.getElementById('opt-hardness');
        const hardVal = document.getElementById('opt-hardness-val');
        if (hardInput) {
            hardInput.addEventListener('input', () => {
                this.hardness = parseInt(hardInput.value, 10);
                if (hardVal) hardVal.textContent = `${this.hardness}%`;
            });
        }

        const shapeModeSelect = document.getElementById('opt-shape-fill');
        if (shapeModeSelect) {
            shapeModeSelect.addEventListener('change', () => {
                this.shapeMode = shapeModeSelect.value;
            });
        }

        const marqueeShapeSelect = document.getElementById('opt-marquee-shape');
        if (marqueeShapeSelect) {
            marqueeShapeSelect.addEventListener('change', () => {
                this.marqueeShape = marqueeShapeSelect.value;
            });
        }

        const gradientTypeSelect = document.getElementById('opt-gradient-type');
        if (gradientTypeSelect) {
            gradientTypeSelect.addEventListener('change', () => {
                this.gradientType = gradientTypeSelect.value;
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

        // Swatches
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

        // Text Options
        const fontSelect = document.getElementById('opt-font-family');
        const fontSizeInput = document.getElementById('opt-font-size');
        const boldBtn = document.getElementById('btn-text-bold');
        const italicBtn = document.getElementById('btn-text-italic');

        if (fontSelect) fontSelect.addEventListener('change', () => { this.fontFamily = fontSelect.value; });
        if (fontSizeInput) fontSizeInput.addEventListener('input', () => { this.fontSize = parseInt(fontSizeInput.value, 10) || 36; });
        if (boldBtn) {
            boldBtn.addEventListener('click', () => {
                this.isBold = !this.isBold;
                boldBtn.classList.toggle('active', this.isBold);
            });
        }
        if (italicBtn) {
            italicBtn.addEventListener('click', () => {
                this.isItalic = !this.isItalic;
                italicBtn.classList.toggle('active', this.isItalic);
            });
        }

        // Transform Controls
        document.getElementById('btn-apply-transform')?.addEventListener('click', () => this.applyFreeTransform());
        document.getElementById('btn-cancel-transform')?.addEventListener('click', () => this.cancelFreeTransform());
        document.getElementById('opt-transform-scale')?.addEventListener('input', (e) => {
            if (!this.transformState.active) return;
            const pct = (parseFloat(e.target.value) || 100) / 100;
            this.transformState.w = Math.max(5, this.transformState.origW * pct);
            this.transformState.h = Math.max(5, this.transformState.origH * pct);
            this.renderTransformHandles();
        });
        document.getElementById('opt-transform-rot')?.addEventListener('input', (e) => {
            if (!this.transformState.active) return;
            const deg = parseFloat(e.target.value) || 0;
            this.transformState.rotation = (deg * Math.PI) / 180;
            this.renderTransformHandles();
        });

        // Selection Actions
        document.getElementById('btn-deselect')?.addEventListener('click', () => {
            window.PSSelection.deselect();
            this.clearOverlay();
        });
        document.getElementById('btn-invert-selection')?.addEventListener('click', () => {
            window.PSSelection.invert();
            this.clearOverlay();
        });

        // Crop Actions
        document.getElementById('btn-apply-crop')?.addEventListener('click', () => this.executeCrop());
        document.getElementById('btn-cancel-crop')?.addEventListener('click', () => {
            this.cropRect = null;
            this.clearOverlay();
            document.getElementById('opt-group-crop')?.classList.add('hidden');
        });

        // Pointer listeners on overlay canvas
        const overlay = document.getElementById('overlay-canvas');
        if (overlay) {
            overlay.addEventListener('mousedown', (e) => this.onPointerDown(e));
            window.addEventListener('mousemove', (e) => this.onPointerMove(e));
            window.addEventListener('mouseup', (e) => this.onPointerUp(e));

            overlay.addEventListener('touchstart', (e) => { e.preventDefault(); this.onPointerDown(e); }, { passive: false });
            window.addEventListener('touchmove', (e) => { if (this.isDrawing || this.transformState.activeHandle) e.preventDefault(); this.onPointerMove(e); }, { passive: false });
            window.addEventListener('touchend', (e) => this.onPointerUp(e));
        }
    },

    selectTool(tool) {
        if (this.transformState.active) {
            this.applyFreeTransform();
        }

        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === tool);
        });

        const meta = this.toolMeta[tool] || { name: tool, icon: 'grid' };
        const nameEl = document.getElementById('current-tool-name');
        const iconEl = document.getElementById('current-tool-icon');
        if (nameEl) nameEl.textContent = meta.name;
        if (iconEl) iconEl.innerHTML = window.PSIcons.get(meta.icon, '', 16, 16);

        // Toggle contextual option groups
        document.getElementById('opt-group-size')?.classList.toggle('hidden', !['brush', 'eraser', 'stamp', 'line'].includes(tool));
        document.getElementById('opt-group-opacity')?.classList.toggle('hidden', ['marquee', 'lasso', 'wand', 'crop', 'eyedropper', 'hand', 'zoom'].includes(tool));
        document.getElementById('opt-group-hardness')?.classList.toggle('hidden', !['brush', 'eraser', 'stamp'].includes(tool));
        document.getElementById('opt-group-shape')?.classList.toggle('hidden', !['rect', 'circle'].includes(tool));
        document.getElementById('opt-group-marquee')?.classList.toggle('hidden', tool !== 'marquee');
        document.getElementById('opt-group-gradient')?.classList.toggle('hidden', tool !== 'gradient');
        document.getElementById('opt-group-tolerance')?.classList.toggle('hidden', !['bucket', 'wand'].includes(tool));
        document.getElementById('opt-group-text')?.classList.toggle('hidden', tool !== 'text');
        document.getElementById('opt-group-crop')?.classList.toggle('hidden', tool !== 'crop');
        document.getElementById('opt-group-transform')?.classList.add('hidden');

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

        // Handle Active Free Transform Interactions
        if (this.transformState.active) {
            const handle = this.hitTestTransformHandles(coords.x, coords.y);
            if (handle) {
                this.transformState.activeHandle = handle;
                this.transformState.startMouseX = coords.x;
                this.transformState.startMouseY = coords.y;
                this.transformState.origTransformX = this.transformState.x;
                this.transformState.origTransformY = this.transformState.y;
                this.transformState.origW = this.transformState.w;
                this.transformState.origH = this.transformState.h;
                return;
            }
        }

        // Hand tool panning
        if (this.currentTool === 'hand' || e.spaceKey) {
            this.isDrawing = true;
            this.startX = e.clientX || (e.touches && e.touches[0].clientX);
            this.startY = e.clientY || (e.touches && e.touches[0].clientY);
            return;
        }

        // Zoom tool
        if (this.currentTool === 'zoom') {
            const factor = e.altKey ? 0.8 : 1.25;
            window.PSApp.setZoom(window.PSApp.zoom * factor);
            return;
        }

        // Eyedropper sampling
        if (this.currentTool === 'eyedropper') {
            this.pickColor(coords.x, coords.y);
            return;
        }

        // Clone Stamp anchor set (Alt + Click)
        if (this.currentTool === 'stamp' && e.altKey) {
            this.cloneSource = { x: coords.x, y: coords.y };
            this.showNotification(`Clone source set at (${coords.x}, ${coords.y})`);
            return;
        }

        // Text tool placement
        if (this.currentTool === 'text') {
            this.pendingTextPos = { x: coords.x - (layer ? layer.x : 0), y: coords.y - (layer ? layer.y : 0) };
            window.PSApp.openTextModal();
            return;
        }

        // Magic Wand selection
        if (this.currentTool === 'wand') {
            this.executeMagicWand(coords.x, coords.y);
            return;
        }

        // Bucket Fill
        if (this.currentTool === 'bucket') {
            if (!layer || layer.locked) return;
            this.floodFill(layer, coords.x - layer.x, coords.y - layer.y, this.fgColor, this.tolerance);
            window.PSLayers.compositeAll();
            window.PSLayers.renderLayersList();
            window.PSStorage.markDirty();
            window.PSHistory.saveState('Paint Bucket Fill');
            return;
        }

        // Active drawing start
        this.isDrawing = true;
        this.startX = coords.x;
        this.startY = coords.y;
        this.lastX = coords.x;
        this.lastY = coords.y;
        this.pointsBuffer = [{ x: coords.x, y: coords.y }];

        if (this.currentTool === 'lasso') {
            this.lassoPoints = [{ x: coords.x, y: coords.y }];
        }

        if (this.currentTool === 'stamp' && this.cloneSource) {
            this.cloneOffset = {
                dx: coords.x - this.cloneSource.x,
                dy: coords.y - this.cloneSource.y
            };
        }

        if (['brush', 'eraser', 'stamp'].includes(this.currentTool)) {
            if (layer && !layer.locked) {
                this.drawBrushSegment(layer, coords.x, coords.y, coords.x, coords.y);
                window.PSLayers.compositeAll();
            }
        }
    },

    onPointerMove(e) {
        const overlay = document.getElementById('overlay-canvas');
        if (!overlay) return;
        const coords = window.PSUtils.getCanvasCoords(e, overlay);

        // Update status bar coordinates
        const coordLabel = document.getElementById('status-coords');
        if (coordLabel) {
            coordLabel.innerHTML = `${window.PSIcons.get('crosshairs', '', 12, 12)} X: ${coords.x}, Y: ${coords.y}`;
        }

        // Handle Free Transform Dragging
        if (this.transformState.active && this.transformState.activeHandle) {
            const h = this.transformState.activeHandle;
            const dx = coords.x - this.transformState.startMouseX;
            const dy = coords.y - this.transformState.startMouseY;

            if (h === 'move') {
                this.transformState.x = this.transformState.origTransformX + dx;
                this.transformState.y = this.transformState.origTransformY + dy;
            } else if (h === 'rotate') {
                const cx = this.transformState.x + this.transformState.w / 2;
                const cy = this.transformState.y + this.transformState.h / 2;
                const angle = Math.atan2(coords.y - cy, coords.x - cx) - Math.atan2(this.transformState.startMouseY - cy, this.transformState.startMouseX - cx);
                this.transformState.rotation = angle;
                const rotInput = document.getElementById('opt-transform-rot');
                if (rotInput) rotInput.value = Math.round((angle * 180) / Math.PI);
            } else if (h === 'br') {
                this.transformState.w = Math.max(10, this.transformState.origW + dx);
                this.transformState.h = Math.max(10, this.transformState.origH + dy);
            } else if (h === 'tl') {
                this.transformState.w = Math.max(10, this.transformState.origW - dx);
                this.transformState.h = Math.max(10, this.transformState.origH - dy);
                this.transformState.x = this.transformState.origTransformX + dx;
                this.transformState.y = this.transformState.origTransformY + dy;
            } else if (h === 'tr') {
                this.transformState.w = Math.max(10, this.transformState.origW + dx);
                this.transformState.h = Math.max(10, this.transformState.origH - dy);
                this.transformState.y = this.transformState.origTransformY + dy;
            } else if (h === 'bl') {
                this.transformState.w = Math.max(10, this.transformState.origW - dx);
                this.transformState.h = Math.max(10, this.transformState.origH + dy);
                this.transformState.x = this.transformState.origTransformX + dx;
            } else if (h === 'mr') {
                this.transformState.w = Math.max(10, this.transformState.origW + dx);
            } else if (h === 'bm') {
                this.transformState.h = Math.max(10, this.transformState.origH + dy);
            }

            const scaleInput = document.getElementById('opt-transform-scale');
            if (scaleInput && this.transformState.origW > 0) {
                scaleInput.value = Math.round((this.transformState.w / this.transformState.origW) * 100);
            }
            this.renderTransformHandles();
            return;
        }

        if (!this.isDrawing) return;

        // Hand tool dragging
        if (this.currentTool === 'hand' || e.spaceKey) {
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

        // Move tool layer drag
        if (this.currentTool === 'move') {
            if (!layer || layer.locked) return;
            const dx = coords.x - this.lastX;
            const dy = coords.y - this.lastY;
            layer.x += dx;
            layer.y += dy;
            this.lastX = coords.x;
            this.lastY = coords.y;
            window.PSLayers.compositeAll();
            this.renderLayerBoundingBox(layer);
            return;
        }

        // Brush / Eraser / Stamp drawing
        if (['brush', 'eraser', 'stamp'].includes(this.currentTool)) {
            if (!layer || layer.locked) return;
            this.pointsBuffer.push({ x: coords.x, y: coords.y });

            if (this.pointsBuffer.length >= 4) {
                const p0 = this.pointsBuffer[this.pointsBuffer.length - 4];
                const p1 = this.pointsBuffer[this.pointsBuffer.length - 3];
                const p2 = this.pointsBuffer[this.pointsBuffer.length - 2];
                const p3 = this.pointsBuffer[this.pointsBuffer.length - 1];
                const interpolated = window.PSUtils.interpolatePoints(p0, p1, p2, p3, 6);

                for (let i = 0; i < interpolated.length - 1; i++) {
                    this.drawBrushSegment(layer, interpolated[i].x, interpolated[i].y, interpolated[i + 1].x, interpolated[i + 1].y);
                }
            } else {
                this.drawBrushSegment(layer, this.lastX, this.lastY, coords.x, coords.y);
            }

            this.lastX = coords.x;
            this.lastY = coords.y;
            window.PSLayers.compositeAll();
            return;
        }

        // Lasso selection drawing
        if (this.currentTool === 'lasso') {
            this.lassoPoints.push({ x: coords.x, y: coords.y });
            this.renderLassoPreview();
            return;
        }

        // Shape, Marquee, Gradient, Crop preview
        if (['line', 'rect', 'circle', 'gradient', 'crop', 'marquee'].includes(this.currentTool)) {
            this.renderPreviewOverlay(this.startX, this.startY, coords.x, coords.y, e.shiftKey);
        }
    },

    onPointerUp(e) {
        if (this.transformState.active && this.transformState.activeHandle) {
            this.transformState.activeHandle = null;
            return;
        }

        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this.currentTool === 'hand') return;

        const overlay = document.getElementById('overlay-canvas');
        const coords = window.PSUtils.getCanvasCoords(e, overlay);
        const layer = window.PSLayers.getActiveLayer();

        if (['brush', 'eraser', 'stamp', 'move'].includes(this.currentTool)) {
            this.pointsBuffer = [];
            this.clearOverlay();
            if (layer) {
                window.PSLayers.renderLayersList();
                window.PSStorage.markDirty();
                window.PSHistory.saveState(this.toolMeta[this.currentTool].name);
            }
        } else if (['line', 'rect', 'circle', 'gradient'].includes(this.currentTool)) {
            if (layer && !layer.locked) {
                this.commitShapeToLayer(layer, this.startX - layer.x, this.startY - layer.y, coords.x - layer.x, coords.y - layer.y);
                this.clearOverlay();
                window.PSLayers.compositeAll();
                window.PSLayers.renderLayersList();
                window.PSStorage.markDirty();
                window.PSHistory.saveState(this.toolMeta[this.currentTool].name);
            }
        } else if (this.currentTool === 'marquee') {
            const rx = Math.min(this.startX, coords.x);
            const ry = Math.min(this.startY, coords.y);
            let rw = Math.abs(coords.x - this.startX);
            let rh = Math.abs(coords.y - this.startY);

            if (e.shiftKey) {
                const maxDim = Math.max(rw, rh);
                rw = maxDim;
                rh = maxDim;
            }

            this.clearOverlay();
            if (this.marqueeShape === 'ellipse') {
                const cx = rx + rw / 2;
                const cy = ry + rh / 2;
                window.PSSelection.setEllipse(cx, cy, rw / 2, rh / 2);
            } else {
                window.PSSelection.setRect(rx, ry, rw, rh);
            }
        } else if (this.currentTool === 'lasso') {
            this.clearOverlay();
            if (this.lassoPoints.length > 2) {
                window.PSSelection.setLasso(this.lassoPoints);
            }
            this.lassoPoints = [];
        } else if (this.currentTool === 'crop') {
            this.cropRect = {
                x: Math.min(this.startX, coords.x),
                y: Math.min(this.startY, coords.y),
                w: Math.abs(coords.x - this.startX),
                h: Math.abs(coords.y - this.startY)
            };
            document.getElementById('opt-group-crop')?.classList.remove('hidden');
        }
    },

    drawBrushSegment(layer, x1, y1, x2, y2) {
        const ctx = layer.ctx;
        ctx.save();

        // Apply selection mask clipping if active (accounting for layer offset)
        if (window.PSSelection && window.PSSelection.isActive) {
            window.PSSelection.applySelectionClip(ctx, layer.x, layer.y);
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = this.size;
        ctx.globalAlpha = this.opacity / 100;

        // Hardness Feathering
        if (this.hardness < 100) {
            const blurAmount = Math.max(1, (100 - this.hardness) * (this.size / 150));
            ctx.shadowBlur = blurAmount;
            ctx.shadowColor = this.currentTool === 'eraser' ? 'rgba(0,0,0,1)' : this.fgColor;
        }

        if (this.currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.beginPath();
            ctx.moveTo(x1 - layer.x, y1 - layer.y);
            ctx.lineTo(x2 - layer.x, y2 - layer.y);
            ctx.stroke();
        } else if (this.currentTool === 'stamp') {
            if (!this.cloneSource) {
                this.showNotification('Alt+Click first to define a clone source.');
                ctx.restore();
                return;
            }
            // Stamp samples from main composite canvas
            const mainCanvas = document.getElementById('main-canvas');
            const sampleX = x2 - this.cloneOffset.dx;
            const sampleY = y2 - this.cloneOffset.dy;

            ctx.beginPath();
            ctx.arc(x2 - layer.x, y2 - layer.y, this.size / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(
                mainCanvas,
                sampleX - this.size / 2, sampleY - this.size / 2, this.size, this.size,
                (x2 - layer.x) - this.size / 2, (y2 - layer.y) - this.size / 2, this.size, this.size
            );
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = this.fgColor;
            ctx.beginPath();
            ctx.moveTo(x1 - layer.x, y1 - layer.y);
            ctx.lineTo(x2 - layer.x, y2 - layer.y);
            ctx.stroke();
        }

        ctx.restore();
    },

    renderLassoPreview() {
        const overlay = document.getElementById('overlay-canvas');
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        if (this.lassoPoints.length < 2) return;
        ctx.save();
        ctx.strokeStyle = '#00d2ff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        ctx.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
        for (let i = 1; i < this.lassoPoints.length; i++) {
            ctx.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
        }
        ctx.stroke();
        ctx.restore();
    },

    renderLayerBoundingBox(layer) {
        const overlay = document.getElementById('overlay-canvas');
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        ctx.save();
        ctx.strokeStyle = '#00d2ff';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(layer.x, layer.y, layer.canvas.width, layer.canvas.height);

        // Corner handles
        const handles = [
            [layer.x, layer.y],
            [layer.x + layer.canvas.width, layer.y],
            [layer.x + layer.canvas.width, layer.y + layer.canvas.height],
            [layer.x, layer.y + layer.canvas.height]
        ];
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.setLineDash([]);
        handles.forEach(([hx, hy]) => {
            ctx.fillRect(hx - 3, hy - 3, 6, 6);
            ctx.strokeRect(hx - 3, hy - 3, 6, 6);
        });
        ctx.restore();
    },

    renderPreviewOverlay(x1, y1, x2, y2, isShiftKey = false) {
        const overlay = document.getElementById('overlay-canvas');
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        ctx.save();

        if (this.currentTool === 'crop' || this.currentTool === 'marquee') {
            const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
            let rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);

            if (isShiftKey && this.currentTool === 'marquee') {
                const maxDim = Math.max(rw, rh);
                rw = maxDim;
                rh = maxDim;
            }

            ctx.strokeStyle = '#00d2ff';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);

            if (this.currentTool === 'marquee' && this.marqueeShape === 'ellipse') {
                const cx = rx + rw / 2;
                const cy = ry + rh / 2;
                ctx.beginPath();
                ctx.ellipse(cx, cy, Math.max(0.1, rw / 2), Math.max(0.1, rh / 2), 0, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                ctx.strokeRect(rx, ry, rw, rh);
            }

            if (this.currentTool === 'crop') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                // Darken outside crop
                ctx.fillRect(0, 0, overlay.width, ry);
                ctx.fillRect(0, ry, rx, rh);
                ctx.fillRect(rx + rw, ry, overlay.width - (rx + rw), rh);
                ctx.fillRect(0, ry + rh, overlay.width, overlay.height - (ry + rh));

                // 8 Corner / Edge Handles
                ctx.fillStyle = '#00d2ff';
                const hSize = 8;
                [
                    [rx, ry], [rx + rw / 2, ry], [rx + rw, ry],
                    [rx, ry + rh / 2], [rx + rw, ry + rh / 2],
                    [rx, ry + rh], [rx + rw / 2, ry + rh], [rx + rw, ry + rh]
                ].forEach(([hx, hy]) => {
                    ctx.fillRect(hx - hSize / 2, hy - hSize / 2, hSize, hSize);
                });
            }
        } else {
            this.drawVectorShape(ctx, x1, y1, x2, y2);
        }

        ctx.restore();
    },

    commitShapeToLayer(layer, x1, y1, x2, y2) {
        const ctx = layer.ctx;
        ctx.save();
        if (window.PSSelection && window.PSSelection.isActive) {
            window.PSSelection.applySelectionClip(ctx, layer.x, layer.y);
        }
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
            let grad;
            if (this.gradientType === 'radial') {
                const r = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
                grad = ctx.createRadialGradient(x1, y1, 0, x1, y1, r);
            } else {
                grad = ctx.createLinearGradient(x1, y1, x2, y2);
            }
            grad.addColorStop(0, this.fgColor);
            grad.addColorStop(1, this.bgColor);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
    },

    placeText(text) {
        if (!text || !this.pendingTextPos) return;
        const w = window.PSApp.width;
        const h = window.PSApp.height;
        const layer = window.PSLayers.createLayerObject(`Text: ${text.slice(0, 10)}`, w, h);
        const ctx = layer.ctx;
        ctx.save();
        const style = `${this.isItalic ? 'italic ' : ''}${this.isBold ? 'bold ' : ''}${this.fontSize}px ${this.fontFamily}`;
        ctx.font = style;
        ctx.fillStyle = this.fgColor;
        ctx.globalAlpha = this.opacity / 100;
        ctx.textBaseline = 'top';
        ctx.fillText(text, this.pendingTextPos.x, this.pendingTextPos.y);
        ctx.restore();

        window.PSLayers.layers.push(layer);
        window.PSLayers.activeLayerId = layer.id;
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Add Text');
    },

    pickColor(x, y) {
        const mainCanvas = document.getElementById('main-canvas');
        if (!mainCanvas) return;
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
        if (!this.cropRect || this.cropRect.w < 5 || this.cropRect.h < 5) return;
        const { x, y, w, h } = this.cropRect;

        window.PSLayers.layers.forEach(layer => {
            const temp = document.createElement('canvas');
            temp.width = w;
            temp.height = h;
            const tCtx = temp.getContext('2d');
            tCtx.drawImage(layer.canvas, x - layer.x, y - layer.y, w, h, 0, 0, w, h);

            layer.canvas.width = w;
            layer.canvas.height = h;
            layer.ctx = layer.canvas.getContext('2d', { willReadFrequently: true });
            layer.ctx.drawImage(temp, 0, 0);
            layer.x = 0;
            layer.y = 0;
        });

        window.PSApp.setCanvasDimensions(w, h, false);
        this.cropRect = null;
        this.clearOverlay();
        document.getElementById('opt-group-crop')?.classList.add('hidden');
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Crop Canvas');
    },

    executeMagicWand(startX, startY) {
        const mainCanvas = document.getElementById('main-canvas');
        if (!mainCanvas) return;
        const w = mainCanvas.width;
        const h = mainCanvas.height;
        if (startX < 0 || startY < 0 || startX >= w || startY >= h) return;

        const ctx = mainCanvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        const startIdx = (startY * w + startX) * 4;
        const targetR = data[startIdx], targetG = data[startIdx + 1], targetB = data[startIdx + 2], targetA = data[startIdx + 3];

        const visited = new Uint8Array(w * h);
        const stack = [[startX, startY]];
        let minX = startX, maxX = startX, minY = startY, maxY = startY;

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = w;
        maskCanvas.height = h;
        const mCtx = maskCanvas.getContext('2d');
        const maskImgData = mCtx.createImageData(w, h);
        const mData = maskImgData.data;

        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const p = cy * w + cx;
            if (visited[p]) continue;

            const idx = p * 4;
            const dist = window.PSUtils.colorDistance(data[idx], data[idx + 1], data[idx + 2], data[idx + 3], targetR, targetG, targetB, targetA);
            if (dist > this.tolerance) continue;

            visited[p] = 1;
            mData[idx] = 255;
            mData[idx + 1] = 255;
            mData[idx + 2] = 255;
            mData[idx + 3] = 255;

            minX = Math.min(minX, cx);
            maxX = Math.max(maxX, cx);
            minY = Math.min(minY, cy);
            maxY = Math.max(maxY, cy);

            if (cx > 0) stack.push([cx - 1, cy]);
            if (cx < w - 1) stack.push([cx + 1, cy]);
            if (cy > 0) stack.push([cx, cy - 1]);
            if (cy < h - 1) stack.push([cx, cy + 1]);
        }

        mCtx.putImageData(maskImgData, 0, 0);

        window.PSSelection.setCustomMask(maskCanvas, {
            x: minX,
            y: minY,
            w: (maxX - minX) + 1,
            h: (maxY - minY) + 1
        });
    },

    floodFill(layer, startX, startY, fillHex, tolerance) {
        const w = layer.canvas.width;
        const h = layer.canvas.height;
        if (startX < 0 || startY < 0 || startX >= w || startY >= h) return;

        const imgData = layer.ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const fillRgba = window.PSUtils.hexToRgba(fillHex, Math.round((this.opacity / 100) * 255));

        const startPos = (startY * w + startX) * 4;
        const startR = data[startPos], startG = data[startPos + 1], startB = data[startPos + 2], startA = data[startPos + 3];

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

        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const pixelIdx = cy * w + cx;
            if (visited[pixelIdx]) continue;

            const pos = pixelIdx * 4;
            const dist = window.PSUtils.colorDistance(data[pos], data[pos + 1], data[pos + 2], data[pos + 3], startR, startG, startB, startA);
            if (dist > tolerance) continue;

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
    },

    // Free Transform Implementation
    startFreeTransform() {
        const layer = window.PSLayers.getActiveLayer();
        if (!layer) return;
        if (layer.locked) {
            this.showNotification('Cannot transform locked layer.');
            return;
        }

        const backup = document.createElement('canvas');
        backup.width = layer.canvas.width;
        backup.height = layer.canvas.height;
        backup.getContext('2d').drawImage(layer.canvas, 0, 0);

        this.transformState = {
            active: true,
            layer: layer,
            backupCanvas: backup,
            x: layer.x,
            y: layer.y,
            w: layer.canvas.width,
            h: layer.canvas.height,
            origW: layer.canvas.width,
            origH: layer.canvas.height,
            rotation: 0,
            activeHandle: null,
            startMouseX: 0,
            startMouseY: 0,
            origTransformX: layer.x,
            origTransformY: layer.y
        };

        const optTransform = document.getElementById('opt-group-transform');
        if (optTransform) optTransform.classList.remove('hidden');

        const scaleInput = document.getElementById('opt-transform-scale');
        const rotInput = document.getElementById('opt-transform-rot');
        if (scaleInput) scaleInput.value = 100;
        if (rotInput) rotInput.value = 0;

        this.renderTransformHandles();
    },

    hitTestTransformHandles(mx, my) {
        const { x, y, w, h } = this.transformState;
        const rad = 8;

        // Check rotate handle (above top-center)
        if (Math.hypot(mx - (x + w / 2), my - (y - 20)) <= rad + 4) return 'rotate';

        // Check 4 corners
        if (Math.hypot(mx - x, my - y) <= rad) return 'tl';
        if (Math.hypot(mx - (x + w), my - y) <= rad) return 'tr';
        if (Math.hypot(mx - (x + w), my - (y + h)) <= rad) return 'br';
        if (Math.hypot(mx - x, my - (y + h)) <= rad) return 'bl';

        // Check side centers
        if (Math.hypot(mx - (x + w), my - (y + h / 2)) <= rad) return 'mr';
        if (Math.hypot(mx - (x + w / 2), my - (y + h)) <= rad) return 'bm';

        // Check inside box
        if (mx >= x && mx <= x + w && my >= y && my <= y + h) return 'move';

        return null;
    },

    renderTransformHandles() {
        if (!this.transformState.active) return;
        const overlay = document.getElementById('overlay-canvas');
        if (!overlay) return;
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        const { x, y, w, h, rotation } = this.transformState;

        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);
        ctx.rotate(rotation);
        ctx.translate(-(w / 2), -(h / 2));

        // Draw preview of transformed layer
        ctx.globalAlpha = 0.85;
        ctx.drawImage(this.transformState.backupCanvas, 0, 0, w, h);
        ctx.globalAlpha = 1.0;

        // Bounding box
        ctx.strokeStyle = '#00d2ff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(0, 0, w, h);

        // 8 handles
        const handleSize = 8;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.setLineDash([]);

        const handlePositions = [
            [0, 0], [w / 2, 0], [w, 0],
            [w, h / 2], [w, h], [w / 2, h],
            [0, h], [0, h / 2]
        ];

        handlePositions.forEach(([hx, hy]) => {
            ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
            ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        });

        // Rotation pin at top
        ctx.beginPath();
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2, -20);
        ctx.strokeStyle = '#00d2ff';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(w / 2, -20, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#00d2ff';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.restore();
    },

    applyFreeTransform() {
        if (!this.transformState.active) return;
        const { layer, backupCanvas, x, y, w, h, rotation } = this.transformState;

        const rw = Math.max(1, Math.round(w));
        const rh = Math.max(1, Math.round(h));

        // Resize layer canvas to new dimensions
        layer.canvas.width = rw;
        layer.canvas.height = rh;
        layer.ctx = layer.canvas.getContext('2d', { willReadFrequently: true });
        layer.x = Math.round(x);
        layer.y = Math.round(y);

        if (rotation !== 0) {
            layer.ctx.save();
            layer.ctx.translate(rw / 2, rh / 2);
            layer.ctx.rotate(rotation);
            layer.ctx.drawImage(backupCanvas, -(rw / 2), -(rh / 2), rw, rh);
            layer.ctx.restore();
        } else {
            layer.ctx.drawImage(backupCanvas, 0, 0, rw, rh);
        }

        this.transformState.active = false;
        this.clearOverlay();
        document.getElementById('opt-group-transform')?.classList.add('hidden');

        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Free Transform');
    },

    cancelFreeTransform() {
        if (!this.transformState.active) return;
        this.transformState.active = false;
        this.clearOverlay();
        document.getElementById('opt-group-transform')?.classList.add('hidden');
        window.PSLayers.compositeAll();
    },

    showNotification(msg) {
        const bar = document.getElementById('status-coords');
        if (bar) {
            const prev = bar.innerHTML;
            bar.innerHTML = `<span style="color:#00d2ff; font-weight:600;">${msg}</span>`;
            setTimeout(() => { bar.innerHTML = prev; }, 3000);
        }
    }
};
