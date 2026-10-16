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
    cornerRadius: 15,
    polygonSides: 5,
    smudgeStrength: 50,
    dodgeBurnStrength: 30,
    smudgeColor: null,

    brushPresets: [
        { id: 'soft-30', name: 'Soft Round 30', size: 30, opacity: 100, hardness: 0 },
        { id: 'hard-10', name: 'Hard Round 10', size: 10, opacity: 100, hardness: 100 },
        { id: 'pencil-2', name: 'Detail Pencil 2', size: 2, opacity: 100, hardness: 100 },
        { id: 'airbrush-80', name: 'Airbrush 80', size: 80, opacity: 50, hardness: 0 },
        { id: 'wash-120', name: 'Soft Wash 120', size: 120, opacity: 30, hardness: 20 }
    ],

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
        pencil: { name: 'Pencil Tool', icon: 'pencil' },
        eraser: { name: 'Eraser Tool', icon: 'eraser' },
        stamp: { name: 'Clone Stamp Tool', icon: 'stamp' },
        'spot-healing': { name: 'Spot Healing Tool', icon: 'spot-healing' },
        'blur-tool': { name: 'Blur Tool', icon: 'blur' },
        'sharpen-tool': { name: 'Sharpen Tool', icon: 'sharpen' },
        smudge: { name: 'Smudge Tool', icon: 'smudge' },
        dodge: { name: 'Dodge Tool', icon: 'dodge' },
        burn: { name: 'Burn Tool', icon: 'burn' },
        bucket: { name: 'Paint Bucket Fill', icon: 'bucket' },
        gradient: { name: 'Gradient Tool', icon: 'gradient' },
        line: { name: 'Line Tool', icon: 'line' },
        rect: { name: 'Rectangle Tool', icon: 'rect' },
        'rounded-rect': { name: 'Rounded Rectangle', icon: 'rounded-rect' },
        polygon: { name: 'Polygon Tool', icon: 'polygon' },
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

        // Preset Selection & Management
        this.loadUserPresets();
        this.renderPresetsDropdown();
        document.getElementById('opt-brush-preset')?.addEventListener('change', (e) => {
            this.applyPreset(e.target.value);
        });
        document.getElementById('btn-save-brush-preset')?.addEventListener('click', () => {
            const name = prompt('Preset Name:', `Brush ${this.size}px`);
            if (name && name.trim()) {
                this.savePreset(name.trim());
            }
        });
        document.getElementById('btn-del-brush-preset')?.addEventListener('click', () => {
            const select = document.getElementById('opt-brush-preset');
            if (select && select.value) {
                this.deletePreset(select.value);
            } else {
                this.showNotification('Select a preset to delete.');
            }
        });

        // Corner Radius & Polygon Sides
        document.getElementById('opt-corner-radius')?.addEventListener('input', (e) => {
            this.cornerRadius = parseInt(e.target.value, 10) || 15;
            const lbl = document.getElementById('opt-corner-radius-val');
            if (lbl) lbl.textContent = `${this.cornerRadius}px`;
        });
        document.getElementById('opt-polygon-sides')?.addEventListener('input', (e) => {
            this.polygonSides = parseInt(e.target.value, 10) || 5;
            const lbl = document.getElementById('opt-polygon-sides-val');
            if (lbl) lbl.textContent = this.polygonSides;
        });

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
        const hasSize = ['brush', 'pencil', 'eraser', 'stamp', 'line', 'blur-tool', 'sharpen-tool', 'smudge', 'dodge', 'burn', 'spot-healing'].includes(tool);
        const hasOpacity = !['marquee', 'lasso', 'wand', 'crop', 'eyedropper', 'hand', 'zoom'].includes(tool);
        const hasHardness = ['brush', 'eraser', 'stamp'].includes(tool);
        const hasShapes = ['rect', 'circle', 'rounded-rect', 'polygon'].includes(tool);
        const hasPresets = ['brush', 'pencil', 'eraser'].includes(tool);

        document.getElementById('opt-group-size')?.classList.toggle('hidden', !hasSize);
        document.getElementById('opt-group-opacity')?.classList.toggle('hidden', !hasOpacity);
        document.getElementById('opt-group-hardness')?.classList.toggle('hidden', !hasHardness);
        document.getElementById('opt-group-shape')?.classList.toggle('hidden', !hasShapes);
        document.getElementById('opt-group-presets')?.classList.toggle('hidden', !hasPresets);
        document.getElementById('opt-group-corner-radius')?.classList.toggle('hidden', tool !== 'rounded-rect');
        document.getElementById('opt-group-polygon-sides')?.classList.toggle('hidden', tool !== 'polygon');
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
            const drawable = window.PSLayers.getActiveDrawable() || layer;
            if (!drawable || drawable.locked) return;
            this.floodFill(drawable, coords.x - drawable.x, coords.y - drawable.y, this.fgColor, this.tolerance);
            window.PSLayers.compositeAll();
            window.PSLayers.renderLayersList();
            window.PSStorage.markDirty();
            window.PSHistory.saveState('Paint Bucket Fill');
            return;
        }

        // Active drawing start
        this.startX = coords.x;
        this.startY = coords.y;
        this.lastX = coords.x;
        this.lastY = coords.y;
        this.pointsBuffer = [{ x: coords.x, y: coords.y }];

        const drawable = window.PSLayers.getActiveDrawable() || layer;

        // Spot Healing Tool
        if (this.currentTool === 'spot-healing') {
            this.executeSpotHealing(coords.x, coords.y);
            this.isDrawing = false;
            return;
        }

        this.isDrawing = true;

        if (this.currentTool === 'smudge') {
            this.smudgeColor = null;
        }

        if (this.currentTool === 'lasso') {
            this.lassoPoints = [{ x: coords.x, y: coords.y }];
        }

        if (this.currentTool === 'stamp' && this.cloneSource) {
            this.cloneOffset = {
                dx: coords.x - this.cloneSource.x,
                dy: coords.y - this.cloneSource.y
            };
        }

        const drawingTools = ['brush', 'pencil', 'eraser', 'stamp', 'blur-tool', 'sharpen-tool', 'smudge', 'dodge', 'burn'];
        if (drawingTools.includes(this.currentTool)) {
            if (drawable && !drawable.locked) {
                this.drawBrushSegment(drawable, coords.x, coords.y, coords.x, coords.y);
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

        // Brush / Pencil / Retouch drawing
        const drawingTools = ['brush', 'pencil', 'eraser', 'stamp', 'blur-tool', 'sharpen-tool', 'smudge', 'dodge', 'burn'];
        if (drawingTools.includes(this.currentTool)) {
            const drawable = window.PSLayers.getActiveDrawable() || layer;
            if (!drawable || drawable.locked) return;
            this.pointsBuffer.push({ x: coords.x, y: coords.y });

            if (this.pointsBuffer.length >= 4) {
                const p0 = this.pointsBuffer[this.pointsBuffer.length - 4];
                const p1 = this.pointsBuffer[this.pointsBuffer.length - 3];
                const p2 = this.pointsBuffer[this.pointsBuffer.length - 2];
                const p3 = this.pointsBuffer[this.pointsBuffer.length - 1];
                const interpolated = window.PSUtils.interpolatePoints(p0, p1, p2, p3, 6);

                for (let i = 0; i < interpolated.length - 1; i++) {
                    this.drawBrushSegment(drawable, interpolated[i].x, interpolated[i].y, interpolated[i + 1].x, interpolated[i + 1].y);
                }
            } else {
                this.drawBrushSegment(drawable, this.lastX, this.lastY, coords.x, coords.y);
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
        if (['line', 'rect', 'rounded-rect', 'polygon', 'circle', 'gradient', 'crop', 'marquee'].includes(this.currentTool)) {
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

        const drawingTools = ['brush', 'pencil', 'eraser', 'stamp', 'blur-tool', 'sharpen-tool', 'smudge', 'dodge', 'burn', 'move'];
        if (drawingTools.includes(this.currentTool)) {
            this.pointsBuffer = [];
            this.clearOverlay();
            if (layer) {
                window.PSLayers.renderLayersList();
                window.PSStorage.markDirty();
                window.PSHistory.saveState(this.toolMeta[this.currentTool]?.name || 'Draw');
            }
        } else if (['line', 'rect', 'rounded-rect', 'polygon', 'circle', 'gradient'].includes(this.currentTool)) {
            const drawable = window.PSLayers.getActiveDrawable() || layer;
            if (drawable && !drawable.locked) {
                this.commitShapeToLayer(drawable, this.startX - drawable.x, this.startY - drawable.y, coords.x - drawable.x, coords.y - drawable.y);
                this.clearOverlay();
                window.PSLayers.compositeAll();
                window.PSLayers.renderLayersList();
                window.PSStorage.markDirty();
                window.PSHistory.saveState(this.toolMeta[this.currentTool]?.name || 'Shape');
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

        // Alpha lock check
        if (layer.alphaLocked) {
            ctx.globalCompositeOperation = 'source-atop';
        }

        ctx.lineWidth = this.size;
        ctx.globalAlpha = this.opacity / 100;

        // Pencil Tool: Hard-edged aliased pixels
        if (this.currentTool === 'pencil') {
            ctx.lineCap = 'square';
            ctx.lineJoin = 'miter';
            ctx.imageSmoothingEnabled = false;
            ctx.strokeStyle = this.fgColor;
            ctx.beginPath();
            ctx.moveTo(x1 - layer.x, y1 - layer.y);
            ctx.lineTo(x2 - layer.x, y2 - layer.y);
            ctx.stroke();
            ctx.restore();
            return;
        }

        // Retouch Tools
        if (this.currentTool === 'blur-tool') {
            this.applyLocalRetouch(layer, x2, y2, 'blur');
            ctx.restore();
            return;
        }
        if (this.currentTool === 'sharpen-tool') {
            this.applyLocalRetouch(layer, x2, y2, 'sharpen');
            ctx.restore();
            return;
        }
        if (this.currentTool === 'smudge') {
            this.applyLocalSmudge(layer, x1, y1, x2, y2);
            ctx.restore();
            return;
        }
        if (this.currentTool === 'dodge') {
            this.applyLocalRetouch(layer, x2, y2, 'dodge');
            ctx.restore();
            return;
        }
        if (this.currentTool === 'burn') {
            this.applyLocalRetouch(layer, x2, y2, 'burn');
            ctx.restore();
            return;
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

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
            if (!layer.alphaLocked) {
                ctx.globalCompositeOperation = 'source-over';
            }
            ctx.strokeStyle = this.fgColor;
            ctx.beginPath();
            ctx.moveTo(x1 - layer.x, y1 - layer.y);
            ctx.lineTo(x2 - layer.x, y2 - layer.y);
            ctx.stroke();
        }

        ctx.restore();
    },

    executeSpotHealing(centerX, centerY) {
        const drawable = window.PSLayers.getActiveDrawable();
        if (!drawable || drawable.locked) return;

        const ctx = drawable.ctx;
        const layer = drawable;
        const r = Math.max(4, Math.floor(this.size / 2));
        const lx = centerX - layer.x;
        const ly = centerY - layer.y;
        const w = drawable.canvas.width;
        const h = drawable.canvas.height;

        const outerR = Math.round(r * 1.6);
        const boxX = Math.max(0, lx - outerR);
        const boxY = Math.max(0, ly - outerR);
        const boxW = Math.min(w - boxX, outerR * 2);
        const boxH = Math.min(h - boxY, outerR * 2);
        if (boxW <= 0 || boxH <= 0) return;

        const imgData = ctx.getImageData(boxX, boxY, boxW, boxH);
        const data = imgData.data;

        let sumR = 0, sumG = 0, sumB = 0, sumA = 0, count = 0;
        for (let py = 0; py < boxH; py++) {
            for (let px = 0; px < boxW; px++) {
                const gx = boxX + px;
                const gy = boxY + py;
                const dist = Math.hypot(gx - lx, gy - ly);
                if (dist >= r && dist <= outerR) {
                    const idx = (py * boxW + px) * 4;
                    if (data[idx + 3] > 0) {
                        sumR += data[idx];
                        sumG += data[idx + 1];
                        sumB += data[idx + 2];
                        sumA += data[idx + 3];
                        count++;
                    }
                }
            }
        }

        if (count > 0) {
            const avgR = Math.round(sumR / count);
            const avgG = Math.round(sumG / count);
            const avgB = Math.round(sumB / count);
            const avgA = Math.round(sumA / count);

            for (let py = 0; py < boxH; py++) {
                for (let px = 0; px < boxW; px++) {
                    const gx = boxX + px;
                    const gy = boxY + py;
                    const dist = Math.hypot(gx - lx, gy - ly);
                    if (dist <= r) {
                        const idx = (py * boxW + px) * 4;
                        const factor = Math.cos((dist / r) * (Math.PI / 2));
                        data[idx] = Math.round(data[idx] * (1 - factor) + avgR * factor);
                        data[idx + 1] = Math.round(data[idx + 1] * (1 - factor) + avgG * factor);
                        data[idx + 2] = Math.round(data[idx + 2] * (1 - factor) + avgB * factor);
                        data[idx + 3] = Math.round(data[idx + 3] * (1 - factor) + avgA * factor);
                    }
                }
            }
            ctx.putImageData(imgData, boxX, boxY);
            window.PSLayers.compositeAll();
            window.PSLayers.renderLayersList();
            window.PSStorage.markDirty();
            window.PSHistory.saveState('Spot Healing');
        }
    },

    applyLocalRetouch(target, clientX, clientY, type) {
        const ctx = target.ctx;
        const r = Math.max(3, Math.floor(this.size / 2));
        const lx = clientX - target.x;
        const ly = clientY - target.y;
        const w = target.canvas.width;
        const h = target.canvas.height;

        const x = Math.max(0, lx - r);
        const y = Math.max(0, ly - r);
        const pw = Math.min(w - x, r * 2);
        const ph = Math.min(h - y, r * 2);
        if (pw <= 0 || ph <= 0) return;

        const imgData = ctx.getImageData(x, y, pw, ph);
        const data = imgData.data;

        if (type === 'blur') {
            const copy = new Uint8ClampedArray(data);
            for (let py = 1; py < ph - 1; py++) {
                for (let px = 1; px < pw - 1; px++) {
                    const dist = Math.hypot(x + px - lx, y + py - ly);
                    if (dist > r) continue;
                    let sumR = 0, sumG = 0, sumB = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const idx = ((py + ky) * pw + (px + kx)) * 4;
                            sumR += copy[idx];
                            sumG += copy[idx + 1];
                            sumB += copy[idx + 2];
                        }
                    }
                    const outIdx = (py * pw + px) * 4;
                    data[outIdx] = Math.round(sumR / 9);
                    data[outIdx + 1] = Math.round(sumG / 9);
                    data[outIdx + 2] = Math.round(sumB / 9);
                }
            }
        } else if (type === 'sharpen') {
            const copy = new Uint8ClampedArray(data);
            const kernel = [
                0, -1, 0,
                -1, 5, -1,
                0, -1, 0
            ];
            for (let py = 1; py < ph - 1; py++) {
                for (let px = 1; px < pw - 1; px++) {
                    const dist = Math.hypot(x + px - lx, y + py - ly);
                    if (dist > r) continue;
                    let rVal = 0, gVal = 0, bVal = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const idx = ((py + ky) * pw + (px + kx)) * 4;
                            const weight = kernel[(ky + 1) * 3 + (kx + 1)];
                            rVal += copy[idx] * weight;
                            gVal += copy[idx + 1] * weight;
                            bVal += copy[idx + 2] * weight;
                        }
                    }
                    const outIdx = (py * pw + px) * 4;
                    data[outIdx] = window.PSUtils.clamp(rVal, 0, 255);
                    data[outIdx + 1] = window.PSUtils.clamp(gVal, 0, 255);
                    data[outIdx + 2] = window.PSUtils.clamp(bVal, 0, 255);
                }
            }
        } else if (type === 'dodge') {
            const factor = 1 + (this.dodgeBurnStrength / 100) * 0.25;
            for (let py = 0; py < ph; py++) {
                for (let px = 0; px < pw; px++) {
                    const dist = Math.hypot(x + px - lx, y + py - ly);
                    if (dist <= r) {
                        const idx = (py * pw + px) * 4;
                        if (data[idx + 3] > 0) {
                            data[idx] = window.PSUtils.clamp(Math.round(data[idx] * factor), 0, 255);
                            data[idx + 1] = window.PSUtils.clamp(Math.round(data[idx + 1] * factor), 0, 255);
                            data[idx + 2] = window.PSUtils.clamp(Math.round(data[idx + 2] * factor), 0, 255);
                        }
                    }
                }
            }
        } else if (type === 'burn') {
            const factor = 1 - (this.dodgeBurnStrength / 100) * 0.25;
            for (let py = 0; py < ph; py++) {
                for (let px = 0; px < pw; px++) {
                    const dist = Math.hypot(x + px - lx, y + py - ly);
                    if (dist <= r) {
                        const idx = (py * pw + px) * 4;
                        if (data[idx + 3] > 0) {
                            data[idx] = window.PSUtils.clamp(Math.round(data[idx] * factor), 0, 255);
                            data[idx + 1] = window.PSUtils.clamp(Math.round(data[idx + 1] * factor), 0, 255);
                            data[idx + 2] = window.PSUtils.clamp(Math.round(data[idx + 2] * factor), 0, 255);
                        }
                    }
                }
            }
        }

        ctx.putImageData(imgData, x, y);
    },

    applyLocalSmudge(target, x1, y1, x2, y2) {
        const ctx = target.ctx;
        const r = Math.max(3, Math.floor(this.size / 2));
        const lx = x2 - target.x;
        const ly = y2 - target.y;
        const w = target.canvas.width;
        const h = target.canvas.height;

        const x = Math.max(0, lx - r);
        const y = Math.max(0, ly - r);
        const pw = Math.min(w - x, r * 2);
        const ph = Math.min(h - y, r * 2);
        if (pw <= 0 || ph <= 0) return;

        const imgData = ctx.getImageData(x, y, pw, ph);
        const data = imgData.data;

        if (!this.smudgeColor) {
            const cIdx = (Math.floor(ph / 2) * pw + Math.floor(pw / 2)) * 4;
            this.smudgeColor = [data[cIdx], data[cIdx + 1], data[cIdx + 2], data[cIdx + 3]];
        }

        const [sr, sg, sb, sa] = this.smudgeColor;
        const rate = (this.smudgeStrength / 100) * 0.5;

        for (let py = 0; py < ph; py++) {
            for (let px = 0; px < pw; px++) {
                const dist = Math.hypot(x + px - lx, y + py - ly);
                if (dist <= r) {
                    const idx = (py * pw + px) * 4;
                    const weight = (1 - dist / r) * rate;
                    data[idx] = Math.round(data[idx] * (1 - weight) + sr * weight);
                    data[idx + 1] = Math.round(data[idx + 1] * (1 - weight) + sg * weight);
                    data[idx + 2] = Math.round(data[idx + 2] * (1 - weight) + sb * weight);
                    data[idx + 3] = Math.max(data[idx + 3], Math.round(sa * weight));
                }
            }
        }

        const cIdx = (Math.floor(ph / 2) * pw + Math.floor(pw / 2)) * 4;
        this.smudgeColor = [
            Math.round(sr * 0.7 + data[cIdx] * 0.3),
            Math.round(sg * 0.7 + data[cIdx + 1] * 0.3),
            Math.round(sb * 0.7 + data[cIdx + 2] * 0.3),
            Math.max(sa, data[cIdx + 3])
        ];

        ctx.putImageData(imgData, x, y);
    },

    // --- Preset Helpers ---
    loadUserPresets() {
        try {
            const saved = localStorage.getItem('aksh_brush_presets');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.brushPresets = parsed;
                }
            }
        } catch (e) {
            console.warn('Could not load brush presets:', e);
        }
    },

    savePreset(name) {
        const preset = {
            id: 'preset_' + Date.now(),
            name: name || `Brush ${this.size}px`,
            size: this.size,
            opacity: this.opacity,
            hardness: this.hardness
        };
        this.brushPresets.push(preset);
        try {
            localStorage.setItem('aksh_brush_presets', JSON.stringify(this.brushPresets));
        } catch (e) {}
        this.renderPresetsDropdown();
        this.showNotification(`Preset "${preset.name}" saved!`);
        return preset;
    },

    deletePreset(id) {
        const idx = this.brushPresets.findIndex(x => x.id === id);
        if (idx === -1) return;
        const deleted = this.brushPresets[idx].name;
        this.brushPresets.splice(idx, 1);
        try {
            localStorage.setItem('aksh_brush_presets', JSON.stringify(this.brushPresets));
        } catch (e) {}
        this.renderPresetsDropdown();
        this.showNotification(`Deleted preset "${deleted}"`);
    },

    applyPreset(id) {
        const p = this.brushPresets.find(x => x.id === id);
        if (!p) return;
        this.size = p.size;
        this.opacity = p.opacity;
        this.hardness = p.hardness;

        const s = document.getElementById('opt-size');
        const o = document.getElementById('opt-opacity');
        const h = document.getElementById('opt-hardness');
        if (s) s.value = p.size;
        if (o) o.value = p.opacity;
        if (h) h.value = p.hardness;
        const sv = document.getElementById('opt-size-val');
        const ov = document.getElementById('opt-opacity-val');
        const hv = document.getElementById('opt-hardness-val');
        if (sv) sv.textContent = `${p.size}px`;
        if (ov) ov.textContent = `${p.opacity}%`;
        if (hv) hv.textContent = `${p.hardness}%`;
    },

    renderPresetsDropdown() {
        const select = document.getElementById('opt-brush-preset');
        if (!select) return;
        select.innerHTML = '<option value="">-- Presets --</option>';
        this.brushPresets.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} (${p.size}px)`;
            select.appendChild(opt);
        });
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
                ctx.fillRect(0, 0, overlay.width, ry);
                ctx.fillRect(0, ry, rx, rh);
                ctx.fillRect(rx + rw, ry, overlay.width - (rx + rw), rh);
                ctx.fillRect(0, ry + rh, overlay.width, overlay.height - (ry + rh));

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
        } else if (this.currentTool === 'rounded-rect') {
            const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
            const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
            const rad = Math.min(this.cornerRadius || 15, rw / 2, rh / 2);
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(rx, ry, rw, rh, rad);
            } else {
                ctx.moveTo(rx + rad, ry);
                ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rad);
                ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rad);
                ctx.arcTo(rx, ry + rh, rx, ry, rad);
                ctx.arcTo(rx, ry, rx + rw, ry, rad);
                ctx.closePath();
            }
            if (this.shapeMode === 'fill' || this.shapeMode === 'both') {
                ctx.fillStyle = this.shapeMode === 'both' ? this.bgColor : this.fgColor;
                ctx.fill();
            }
            if (this.shapeMode === 'stroke' || this.shapeMode === 'both') {
                ctx.stroke();
            }
        } else if (this.currentTool === 'polygon') {
            const sides = Math.max(3, Math.min(12, this.polygonSides || 5));
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;
            const r = Math.hypot(x2 - x1, y2 - y1) / 2;
            ctx.beginPath();
            for (let i = 0; i < sides; i++) {
                const a = (i * 2 * Math.PI) / sides - Math.PI / 2;
                const px = cx + r * Math.cos(a);
                const py = cy + r * Math.sin(a);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            if (this.shapeMode === 'fill' || this.shapeMode === 'both') {
                ctx.fillStyle = this.shapeMode === 'both' ? this.bgColor : this.fgColor;
                ctx.fill();
            }
            if (this.shapeMode === 'stroke' || this.shapeMode === 'both') {
                ctx.stroke();
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
        const firstLine = text.split('\n')[0] || 'Text';
        const layer = window.PSLayers.createLayerObject(`Text: ${firstLine.slice(0, 14)}`, w, h);
        const ctx = layer.ctx;
        ctx.save();
        const style = `${this.isItalic ? 'italic ' : ''}${this.isBold ? 'bold ' : ''}${this.fontSize}px ${this.fontFamily}`;
        ctx.font = style;
        ctx.fillStyle = this.fgColor;
        ctx.globalAlpha = this.opacity / 100;
        ctx.textBaseline = 'top';

        const lines = text.split('\n');
        const lineHeight = Math.round(this.fontSize * 1.3);
        lines.forEach((line, idx) => {
            ctx.fillText(line, this.pendingTextPos.x, this.pendingTextPos.y + idx * lineHeight);
        });
        ctx.restore();

        layer.isTextLayer = true;
        layer.textContent = text;
        layer.fontSize = this.fontSize;
        layer.fontFamily = this.fontFamily;
        layer.isBold = this.isBold;
        layer.isItalic = this.isItalic;

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
        if (layer.isGroup) {
            this.showNotification('Cannot transform group folder.');
            return;
        }
        if (layer.locked) {
            this.showNotification('Cannot transform locked layer.');
            return;
        }

        const backup = document.createElement('canvas');
        backup.width = layer.canvas.width;
        backup.height = layer.canvas.height;
        backup.getContext('2d').drawImage(layer.canvas, 0, 0);

        let backupMask = null;
        if (layer.hasMask && layer.maskCanvas) {
            backupMask = document.createElement('canvas');
            backupMask.width = layer.maskCanvas.width;
            backupMask.height = layer.maskCanvas.height;
            backupMask.getContext('2d').drawImage(layer.maskCanvas, 0, 0);
        }

        this.transformState = {
            active: true,
            layer: layer,
            backupCanvas: backup,
            backupMaskCanvas: backupMask,
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

        if (layer.hasMask && layer.maskCanvas && this.transformState.backupMaskCanvas) {
            layer.maskCanvas.width = rw;
            layer.maskCanvas.height = rh;
            layer.maskCtx = layer.maskCanvas.getContext('2d', { willReadFrequently: true });
            if (rotation !== 0) {
                layer.maskCtx.save();
                layer.maskCtx.translate(rw / 2, rh / 2);
                layer.maskCtx.rotate(rotation);
                layer.maskCtx.drawImage(this.transformState.backupMaskCanvas, -(rw / 2), -(rh / 2), rw, rh);
                layer.maskCtx.restore();
            } else {
                layer.maskCtx.drawImage(this.transformState.backupMaskCanvas, 0, 0, rw, rh);
            }
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
