/**
 * Aksh Photoshop - Main Application Controller
 */
window.PSApp = {
    width: 800,
    height: 600,
    zoom: 1,
    panX: 0,
    panY: 0,
    modalMode: 'new', // 'new' or 'resize'

    init() {
        this.setCanvasDimensions(this.width, this.height, false);
        window.PSHistory.init();
        window.PSLayers.init(this.width, this.height, 'white');
        window.PSAdjustments.init();
        window.PSTools.init();
        window.PSHistory.saveState('New Document');

        this.bindMenuAndUI();
        this.bindKeyboardShortcuts();
        this.fitToScreen();
    },

    setCanvasDimensions(w, h, resizeExistingLayers = false) {
        this.width = w;
        this.height = h;

        const mainCanvas = document.getElementById('main-canvas');
        const overlayCanvas = document.getElementById('overlay-canvas');
        const dimLabel = document.getElementById('status-dimensions');

        if (mainCanvas) {
            mainCanvas.width = w;
            mainCanvas.height = h;
        }
        if (overlayCanvas) {
            overlayCanvas.width = w;
            overlayCanvas.height = h;
        }
        if (dimLabel) {
            dimLabel.textContent = `${w} × ${h} px`;
        }

        if (resizeExistingLayers && window.PSLayers.layers.length > 0) {
            window.PSLayers.layers.forEach(layer => {
                const temp = document.createElement('canvas');
                temp.width = layer.canvas.width;
                temp.height = layer.canvas.height;
                temp.getContext('2d').drawImage(layer.canvas, 0, 0);

                layer.canvas.width = w;
                layer.canvas.height = h;
                layer.ctx = layer.canvas.getContext('2d');
                layer.ctx.drawImage(temp, 0, 0);
            });
            window.PSLayers.compositeAll();
            window.PSLayers.renderLayersList();
        }
    },

    updateViewportTransform() {
        const stage = document.getElementById('canvas-stage');
        const zoomLabel = document.getElementById('status-zoom');
        if (stage) {
            stage.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        }
        if (zoomLabel) {
            zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
        }
    },

    setZoom(newZoom) {
        this.zoom = window.PSUtils.clamp(newZoom, 0.1, 8);
        this.updateViewportTransform();
    },

    panBy(dx, dy) {
        this.panX += dx;
        this.panY += dy;
        this.updateViewportTransform();
    },

    fitToScreen() {
        const viewport = document.getElementById('viewport');
        if (!viewport) return;
        const pad = 80;
        const availW = viewport.clientWidth - pad;
        const availH = viewport.clientHeight - pad;
        const scale = Math.min(availW / this.width, availH / this.height, 1);
        this.zoom = Math.max(0.1, scale);
        this.panX = 0;
        this.panY = 0;
        this.updateViewportTransform();
    },

    rotateCanvas90(clockwise = true) {
        const oldW = this.width;
        const oldH = this.height;
        const newW = oldH;
        const newH = oldW;

        window.PSLayers.layers.forEach(layer => {
            const temp = document.createElement('canvas');
            temp.width = newW;
            temp.height = newH;
            const tCtx = temp.getContext('2d');

            tCtx.save();
            if (clockwise) {
                tCtx.translate(newW, 0);
                tCtx.rotate(Math.PI / 2);
            } else {
                tCtx.translate(0, newH);
                tCtx.rotate(-Math.PI / 2);
            }
            tCtx.drawImage(layer.canvas, 0, 0);
            tCtx.restore();

            layer.canvas.width = newW;
            layer.canvas.height = newH;
            layer.ctx = layer.canvas.getContext('2d');
            layer.ctx.drawImage(temp, 0, 0);
        });

        this.setCanvasDimensions(newW, newH, false);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSHistory.saveState(clockwise ? 'Rotate 90° CW' : 'Rotate 90° CCW');
    },

    flipActiveLayer(horizontal = true) {
        const layer = window.PSLayers.getActiveLayer();
        if (!layer) return;

        const w = layer.canvas.width;
        const h = layer.canvas.height;
        const temp = document.createElement('canvas');
        temp.width = w;
        temp.height = h;
        temp.getContext('2d').drawImage(layer.canvas, 0, 0);

        layer.ctx.clearRect(0, 0, w, h);
        layer.ctx.save();
        if (horizontal) {
            layer.ctx.translate(w, 0);
            layer.ctx.scale(-1, 1);
        } else {
            layer.ctx.translate(0, h);
            layer.ctx.scale(1, -1);
        }
        layer.ctx.drawImage(temp, 0, 0);
        layer.ctx.restore();

        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSHistory.saveState(horizontal ? 'Flip Horizontal' : 'Flip Vertical');
    },

    openDimensionsModal(mode = 'new') {
        this.modalMode = mode;
        const modal = document.getElementById('modal-dimensions');
        const title = document.getElementById('modal-dim-title');
        const bgGroup = document.getElementById('dim-bg-group');
        const confirmBtn = document.getElementById('modal-dim-confirm');

        document.getElementById('dim-width').value = this.width;
        document.getElementById('dim-height').value = this.height;

        if (mode === 'new') {
            title.textContent = 'New Document';
            confirmBtn.textContent = 'Create';
            bgGroup.classList.remove('hidden');
        } else {
            title.textContent = 'Resize Canvas';
            confirmBtn.textContent = 'Resize';
            bgGroup.classList.add('hidden');
        }

        modal.classList.remove('hidden');
    },

    openTextModal() {
        const modal = document.getElementById('modal-text');
        const input = document.getElementById('text-input-value');
        input.value = '';
        modal.classList.remove('hidden');
        setTimeout(() => input.focus(), 50);
    },

    bindMenuAndUI() {
        // File Menu & Quick Actions
        const openInput = document.getElementById('file-open-input');
        const layerInput = document.getElementById('file-layer-input');

        document.getElementById('menu-new')?.addEventListener('click', () => this.openDimensionsModal('new'));
        document.getElementById('menu-resize-canvas')?.addEventListener('click', () => this.openDimensionsModal('resize'));

        document.getElementById('menu-open')?.addEventListener('click', () => openInput.click());
        document.getElementById('btn-quick-open')?.addEventListener('click', () => openInput.click());
        document.getElementById('menu-import-layer')?.addEventListener('click', () => layerInput.click());

        openInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    this.setCanvasDimensions(img.width, img.height, false);
                    window.PSHistory.init();
                    window.PSLayers.init(img.width, img.height, 'transparent');
                    const base = window.PSLayers.getActiveLayer();
                    base.name = file.name.replace(/\.[^/.]+$/, '');
                    base.ctx.drawImage(img, 0, 0);
                    window.PSLayers.compositeAll();
                    window.PSLayers.renderLayersList();
                    window.PSHistory.saveState('Open Image');
                    this.fitToScreen();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        });

        layerInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    window.PSLayers.addImageAsLayer(img, file.name.replace(/\.[^/.]+$/, ''));
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        });

        // Exports
        const exportCanvas = (mime, ext) => {
            const mainCanvas = document.getElementById('main-canvas');
            window.PSUtils.downloadBlob(mainCanvas, `aksh-photoshop-${Date.now()}.${ext}`, mime);
        };
        document.getElementById('menu-export-png')?.addEventListener('click', () => exportCanvas('image/png', 'png'));
        document.getElementById('btn-quick-export')?.addEventListener('click', () => exportCanvas('image/png', 'png'));
        document.getElementById('menu-export-jpg')?.addEventListener('click', () => exportCanvas('image/jpeg', 'jpg'));
        document.getElementById('menu-export-webp')?.addEventListener('click', () => exportCanvas('image/webp', 'webp'));

        // Edit Menu
        document.getElementById('menu-undo')?.addEventListener('click', () => window.PSHistory.undo());
        document.getElementById('btn-quick-undo')?.addEventListener('click', () => window.PSHistory.undo());
        document.getElementById('menu-redo')?.addEventListener('click', () => window.PSHistory.redo());
        document.getElementById('btn-quick-redo')?.addEventListener('click', () => window.PSHistory.redo());
        document.getElementById('menu-clear-layer')?.addEventListener('click', () => window.PSLayers.clearActiveLayer());
        document.getElementById('menu-fill-layer')?.addEventListener('click', () => {
            const layer = window.PSLayers.getActiveLayer();
            if (!layer) return;
            layer.ctx.fillStyle = window.PSTools.fgColor;
            layer.ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
            window.PSLayers.compositeAll();
            window.PSLayers.renderLayersList();
            window.PSHistory.saveState('Fill Layer');
        });

        // Image Transforms
        document.getElementById('menu-flip-h')?.addEventListener('click', () => this.flipActiveLayer(true));
        document.getElementById('menu-flip-v')?.addEventListener('click', () => this.flipActiveLayer(false));
        document.getElementById('menu-rotate-cw')?.addEventListener('click', () => this.rotateCanvas90(true));
        document.getElementById('menu-rotate-ccw')?.addEventListener('click', () => this.rotateCanvas90(false));

        // Filters
        ['invert', 'grayscale', 'sepia', 'sharpen', 'emboss', 'edge'].forEach(f => {
            document.getElementById(`filter-${f}`)?.addEventListener('click', () => window.PSAdjustments.applyDirectFilter(f));
        });

        // View & Zoom
        document.getElementById('menu-zoom-in')?.addEventListener('click', () => this.setZoom(this.zoom * 1.2));
        document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.setZoom(this.zoom * 1.2));
        document.getElementById('menu-zoom-out')?.addEventListener('click', () => this.setZoom(this.zoom / 1.2));
        document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.setZoom(this.zoom / 1.2));
        document.getElementById('menu-zoom-fit')?.addEventListener('click', () => this.fitToScreen());
        document.getElementById('btn-zoom-reset')?.addEventListener('click', () => this.fitToScreen());
        document.getElementById('menu-zoom-100')?.addEventListener('click', () => {
            this.zoom = 1;
            this.panX = 0;
            this.panY = 0;
            this.updateViewportTransform();
        });
        document.getElementById('menu-toggle-grid')?.addEventListener('click', () => {
            document.getElementById('canvas-stage')?.classList.toggle('pixel-grid');
        });

        // Mouse wheel zoom on viewport
        document.getElementById('viewport')?.addEventListener('wheel', (e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            this.setZoom(this.zoom * factor);
        }, { passive: false });

        // Layer Panel Footer Buttons
        document.getElementById('btn-add-layer')?.addEventListener('click', () => window.PSLayers.addNewLayer());
        document.getElementById('btn-dup-layer')?.addEventListener('click', () => window.PSLayers.duplicateActiveLayer());
        document.getElementById('btn-merge-down')?.addEventListener('click', () => window.PSLayers.mergeDown());
        document.getElementById('btn-move-layer-up')?.addEventListener('click', () => window.PSLayers.moveActiveLayerOrder(1));
        document.getElementById('btn-move-layer-down')?.addEventListener('click', () => window.PSLayers.moveActiveLayerOrder(-1));
        document.getElementById('btn-del-layer')?.addEventListener('click', () => window.PSLayers.deleteActiveLayer());

        document.getElementById('layer-blend-mode')?.addEventListener('change', (e) => {
            const layer = window.PSLayers.getActiveLayer();
            if (layer) {
                layer.blendMode = e.target.value;
                window.PSLayers.compositeAll();
                window.PSLayers.renderLayersList();
            }
        });

        document.getElementById('layer-opacity-input')?.addEventListener('input', (e) => {
            const layer = window.PSLayers.getActiveLayer();
            if (layer) {
                layer.opacity = window.PSUtils.clamp(parseInt(e.target.value, 10) || 0, 0, 100);
                window.PSLayers.compositeAll();
                window.PSLayers.renderLayersList();
            }
        });

        document.getElementById('btn-clear-history')?.addEventListener('click', () => window.PSHistory.clear());

        // Dimensions Modal
        const dimPreset = document.getElementById('dim-preset');
        dimPreset?.addEventListener('change', () => {
            if (dimPreset.value !== 'custom') {
                const [w, h] = dimPreset.value.split('x').map(Number);
                document.getElementById('dim-width').value = w;
                document.getElementById('dim-height').value = h;
            }
        });

        const closeDimModal = () => document.getElementById('modal-dimensions').classList.add('hidden');
        document.getElementById('modal-dim-close')?.addEventListener('click', closeDimModal);
        document.getElementById('modal-dim-cancel')?.addEventListener('click', closeDimModal);
        document.getElementById('modal-dim-confirm')?.addEventListener('click', () => {
            const w = window.PSUtils.clamp(parseInt(document.getElementById('dim-width').value, 10) || 800, 16, 4096);
            const h = window.PSUtils.clamp(parseInt(document.getElementById('dim-height').value, 10) || 600, 16, 4096);
            const bg = document.getElementById('dim-bg').value;

            if (this.modalMode === 'new') {
                this.setCanvasDimensions(w, h, false);
                window.PSHistory.init();
                window.PSLayers.init(w, h, bg);
                window.PSHistory.saveState('New Document');
                this.fitToScreen();
            } else {
                this.setCanvasDimensions(w, h, true);
                window.PSHistory.saveState('Resize Canvas');
            }
            closeDimModal();
        });

        // Text Modal
        const closeTextModal = () => document.getElementById('modal-text').classList.add('hidden');
        document.getElementById('modal-text-close')?.addEventListener('click', closeTextModal);
        document.getElementById('modal-text-cancel')?.addEventListener('click', closeTextModal);
        document.getElementById('modal-text-confirm')?.addEventListener('click', () => {
            const val = document.getElementById('text-input-value').value;
            if (val.trim()) window.PSTools.placeText(val.trim());
            closeTextModal();
        });
    },

    bindKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) window.PSHistory.redo();
                else window.PSHistory.undo();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                window.PSHistory.redo();
                return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                window.PSLayers.clearActiveLayer();
                return;
            }

            const keyMap = {
                v: 'move',
                m: 'marquee',
                c: 'crop',
                b: 'brush',
                e: 'eraser',
                g: 'bucket',
                l: 'gradient',
                u: 'line',
                r: 'rect',
                o: 'circle',
                t: 'text',
                i: 'eyedropper',
                h: 'hand'
            };

            const k = e.key.toLowerCase();
            if (!e.ctrlKey && !e.metaKey && keyMap[k]) {
                window.PSTools.selectTool(keyMap[k]);
            } else if (k === 'x') {
                document.getElementById('btn-swap-colors')?.click();
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.PSApp.init();
});
