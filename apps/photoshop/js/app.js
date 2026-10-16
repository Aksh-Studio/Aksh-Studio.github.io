/**
 * Aksh Photoshop - Master Application Controller
 */

window.PSApp = {
    width: 800,
    height: 600,
    zoom: 1,
    panX: 0,
    panY: 0,
    modalMode: 'new', // 'new' or 'resize'
    currentTheme: 'dark',

    async init() {
        this.registerServiceWorker();

        this.setCanvasDimensions(this.width, this.height, false);
        window.PSIcons.hydrateIcons();
        window.PSSelection.init(this.width, this.height);
        window.PSHistory.init();
        window.PSLayers.init(this.width, this.height, 'white');
        window.PSAdjustments.init();
        window.PSTools.init();
        window.PSHistory.saveState('New Document');

        await window.PSStorage.init();
        this.checkAutosaveRecovery();

        this.bindMenuAndUI();
        this.bindKeyboardShortcuts();
        this.fitToScreen();
    },

    registerServiceWorker() {
        if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            navigator.serviceWorker.register('./service-worker.js', { scope: './' })
                .then(reg => {
                    console.log('[SW] Scoped to:', reg.scope);
                })
                .catch(err => {
                    console.warn('[SW] Offline worker registration skipped:', err);
                });
        }
    },

    async checkAutosaveRecovery() {
        const session = await window.PSStorage.checkRecoverableSession();
        if (session) {
            const banner = document.getElementById('recovery-banner');
            const timeEl = document.getElementById('recovery-time');
            if (banner) {
                if (timeEl && session.timestamp) {
                    timeEl.textContent = new Date(session.timestamp).toLocaleTimeString();
                }
                banner.classList.remove('hidden');

                document.getElementById('btn-recovery-restore')?.addEventListener('click', async () => {
                    await window.PSStorage.restoreSession(session);
                    banner.classList.add('hidden');
                }, { once: true });

                document.getElementById('btn-recovery-dismiss')?.addEventListener('click', () => {
                    window.PSStorage.clearSession();
                    banner.classList.add('hidden');
                }, { once: true });
            }
        }
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

        if (window.PSSelection) {
            window.PSSelection.resize(w, h);
        }

        if (resizeExistingLayers && window.PSLayers.layers.length > 0) {
            window.PSLayers.layers.forEach(layer => {
                const temp = document.createElement('canvas');
                temp.width = layer.canvas.width;
                temp.height = layer.canvas.height;
                temp.getContext('2d').drawImage(layer.canvas, 0, 0);

                layer.canvas.width = w;
                layer.canvas.height = h;
                layer.ctx = layer.canvas.getContext('2d', { willReadFrequently: true });
                layer.ctx.drawImage(temp, 0, 0);
            });
            window.PSLayers.compositeAll();
            window.PSLayers.renderLayersList();
            window.PSStorage.markDirty();
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
        this.zoom = window.PSUtils.clamp(newZoom, 0.05, 12);
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
        const availW = Math.max(100, viewport.clientWidth - pad);
        const availH = Math.max(100, viewport.clientHeight - pad);
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
            layer.ctx = layer.canvas.getContext('2d', { willReadFrequently: true });
            layer.ctx.drawImage(temp, 0, 0);
        });

        this.setCanvasDimensions(newW, newH, false);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(clockwise ? 'Rotate 90° CW' : 'Rotate 90° CCW');
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
        if (input) input.value = '';
        modal.classList.remove('hidden');
        setTimeout(() => input?.focus(), 50);
    },

    bindMenuAndUI() {
        // File input listeners
        const openInput = document.getElementById('file-open-input');
        const layerInput = document.getElementById('file-layer-input');
        const projectInput = document.getElementById('file-project-input');
        const psdInput = document.getElementById('file-psd-input');

        // File Menu
        document.getElementById('menu-new')?.addEventListener('click', () => this.openDimensionsModal('new'));
        document.getElementById('menu-open')?.addEventListener('click', () => openInput?.click());
        document.getElementById('menu-open-project')?.addEventListener('click', () => projectInput?.click());
        document.getElementById('menu-open-psd')?.addEventListener('click', () => psdInput?.click());
        document.getElementById('menu-import-layer')?.addEventListener('click', () => layerInput?.click());
        document.getElementById('menu-save-project')?.addEventListener('click', () => window.PSProject.exportProject());

        // Header Actions
        document.getElementById('btn-recenter')?.addEventListener('click', () => this.fitToScreen());
        document.getElementById('btn-undo-top')?.addEventListener('click', () => window.PSHistory.undo());
        document.getElementById('btn-redo-top')?.addEventListener('click', () => window.PSHistory.redo());
        document.getElementById('btn-quick-export')?.addEventListener('click', () => {
            const mainCanvas = document.getElementById('main-canvas');
            window.PSUtils.downloadCanvas(mainCanvas, `aksh-photoshop-${Date.now()}.png`, 'image/png');
        });

        // Theme Toggle
        document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
            const html = document.documentElement;
            this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', this.currentTheme);
        });

        // File open handlers
        openInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Handle PSD vs standard image
            if (file.name.toLowerCase().endsWith('.psd')) {
                window.PSPsd.openPsdFile(file);
                e.target.value = '';
                return;
            }

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
                    window.PSStorage.markDirty();
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

        projectInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                window.PSProject.openProject(file);
                e.target.value = '';
            }
        });

        psdInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                window.PSPsd.openPsdFile(file);
                e.target.value = '';
            }
        });

        // Exports
        document.getElementById('menu-export-png')?.addEventListener('click', () => {
            window.PSUtils.downloadCanvas(document.getElementById('main-canvas'), `aksh-edit-${Date.now()}.png`, 'image/png');
        });
        document.getElementById('menu-export-jpg')?.addEventListener('click', () => {
            // For JPEG, render over white background to avoid black transparency
            const main = document.getElementById('main-canvas');
            const temp = document.createElement('canvas');
            temp.width = main.width;
            temp.height = main.height;
            const tCtx = temp.getContext('2d');
            tCtx.fillStyle = '#ffffff';
            tCtx.fillRect(0, 0, temp.width, temp.height);
            tCtx.drawImage(main, 0, 0);
            window.PSUtils.downloadCanvas(temp, `aksh-edit-${Date.now()}.jpg`, 'image/jpeg', 0.92);
        });
        document.getElementById('menu-export-webp')?.addEventListener('click', () => {
            window.PSUtils.downloadCanvas(document.getElementById('main-canvas'), `aksh-edit-${Date.now()}.webp`, 'image/webp', 0.9);
        });
        document.getElementById('menu-export-psd')?.addEventListener('click', () => {
            window.PSPsd.exportPsdFile(`aksh-project-${Date.now()}.psd`);
        });

        // Edit Menu & Transforms
        document.getElementById('menu-undo')?.addEventListener('click', () => window.PSHistory.undo());
        document.getElementById('menu-redo')?.addEventListener('click', () => window.PSHistory.redo());
        document.getElementById('menu-clear-layer')?.addEventListener('click', () => window.PSLayers.clearActiveLayer());
        document.getElementById('menu-fill-layer')?.addEventListener('click', () => {
            window.PSLayers.fillActiveLayer(window.PSTools.fgColor);
        });
        document.getElementById('menu-fill-bg')?.addEventListener('click', () => {
            window.PSLayers.fillActiveLayer(window.PSTools.bgColor);
        });
        document.getElementById('menu-free-transform')?.addEventListener('click', () => window.PSTools.startFreeTransform());

        // Auto-close menu dropdown on item click
        document.querySelectorAll('.menu-dropdown button, .menu-dropdown a').forEach(btn => {
            btn.addEventListener('click', () => {
                const dd = btn.closest('.menu-dropdown');
                if (dd) {
                    dd.style.display = 'none';
                    setTimeout(() => { dd.style.display = ''; }, 200);
                }
            });
        });

        // Image Menu & Transforms
        document.getElementById('menu-resize-canvas')?.addEventListener('click', () => this.openDimensionsModal('resize'));
        document.getElementById('menu-flip-h')?.addEventListener('click', () => window.PSLayers.flipActiveLayer(true));
        document.getElementById('menu-flip-v')?.addEventListener('click', () => window.PSLayers.flipActiveLayer(false));
        document.getElementById('menu-rotate-cw')?.addEventListener('click', () => this.rotateCanvas90(true));
        document.getElementById('menu-rotate-ccw')?.addEventListener('click', () => this.rotateCanvas90(false));
        document.getElementById('menu-auto-contrast')?.addEventListener('click', () => window.PSAdjustments.applyDirectFilter('auto-contrast'));
        document.getElementById('menu-invert-colors')?.addEventListener('click', () => window.PSAdjustments.applyDirectFilter('invert'));
        document.getElementById('menu-grayscale')?.addEventListener('click', () => window.PSAdjustments.applyDirectFilter('grayscale'));
        document.getElementById('menu-sepia')?.addEventListener('click', () => window.PSAdjustments.applyDirectFilter('sepia'));

        // Layer Menu
        document.getElementById('menu-new-layer')?.addEventListener('click', () => window.PSLayers.addNewLayer());
        document.getElementById('menu-dup-layer')?.addEventListener('click', () => window.PSLayers.duplicateActiveLayer());
        document.getElementById('menu-del-layer')?.addEventListener('click', () => window.PSLayers.deleteActiveLayer());
        document.getElementById('menu-merge-down')?.addEventListener('click', () => window.PSLayers.mergeDown());
        document.getElementById('menu-flatten')?.addEventListener('click', () => window.PSLayers.flattenImage());
        document.getElementById('menu-layer-up')?.addEventListener('click', () => window.PSLayers.moveActiveLayerOrder(1));
        document.getElementById('menu-layer-down')?.addEventListener('click', () => window.PSLayers.moveActiveLayerOrder(-1));

        // Selection Menu
        document.getElementById('menu-select-all')?.addEventListener('click', () => window.PSSelection.selectAll());
        document.getElementById('menu-deselect')?.addEventListener('click', () => window.PSSelection.deselect());
        document.getElementById('menu-invert-selection')?.addEventListener('click', () => window.PSSelection.invert());

        // Filters Menu
        ['blur', 'sharpen', 'edge', 'emboss', 'pixelate', 'noise', 'vignette'].forEach(f => {
            document.getElementById(`menu-filter-${f}`)?.addEventListener('click', () => {
                window.PSAdjustments.applyDirectFilter(f);
            });
        });

        // View Menu
        document.getElementById('menu-zoom-in')?.addEventListener('click', () => this.setZoom(this.zoom * 1.25));
        document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.setZoom(this.zoom * 1.25));
        document.getElementById('menu-zoom-out')?.addEventListener('click', () => this.setZoom(this.zoom / 1.25));
        document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.setZoom(this.zoom / 1.25));
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

        // Help Menu
        document.getElementById('menu-shortcuts')?.addEventListener('click', () => {
            document.getElementById('modal-shortcuts')?.classList.remove('hidden');
        });
        document.getElementById('modal-shortcuts-close')?.addEventListener('click', () => {
            document.getElementById('modal-shortcuts')?.classList.add('hidden');
        });

        // Mouse Wheel Zoom
        document.getElementById('viewport')?.addEventListener('wheel', (e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.15 : 0.88;
            this.setZoom(this.zoom * factor);
        }, { passive: false });

        // Layer Panel Controls
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
                window.PSStorage.markDirty();
            }
        });

        document.getElementById('layer-opacity-input')?.addEventListener('input', (e) => {
            const layer = window.PSLayers.getActiveLayer();
            if (layer) {
                layer.opacity = window.PSUtils.clamp(parseInt(e.target.value, 10) || 0, 0, 100);
                window.PSLayers.compositeAll();
                window.PSLayers.renderLayersList();
                window.PSStorage.markDirty();
            }
        });

        document.getElementById('btn-clear-history')?.addEventListener('click', () => window.PSHistory.clear());

        // Modals
        const dimPreset = document.getElementById('dim-preset');
        dimPreset?.addEventListener('change', () => {
            if (dimPreset.value !== 'custom') {
                const [w, h] = dimPreset.value.split('x').map(Number);
                document.getElementById('dim-width').value = w;
                document.getElementById('dim-height').value = h;
            }
        });

        const closeDimModal = () => document.getElementById('modal-dimensions')?.classList.add('hidden');
        document.getElementById('modal-dim-close')?.addEventListener('click', closeDimModal);
        document.getElementById('modal-dim-cancel')?.addEventListener('click', closeDimModal);
        document.getElementById('modal-dim-confirm')?.addEventListener('click', () => {
            const w = window.PSUtils.clamp(parseInt(document.getElementById('dim-width').value, 10) || 800, 16, 8192);
            const h = window.PSUtils.clamp(parseInt(document.getElementById('dim-height').value, 10) || 600, 16, 8192);
            const bg = document.getElementById('dim-bg').value;

            if (this.modalMode === 'new') {
                this.setCanvasDimensions(w, h, false);
                window.PSHistory.init();
                window.PSLayers.init(w, h, bg);
                window.PSStorage.markDirty();
                window.PSHistory.saveState('New Document');
                this.fitToScreen();
            } else {
                this.setCanvasDimensions(w, h, true);
                window.PSStorage.markDirty();
                window.PSHistory.saveState('Resize Canvas');
            }
            closeDimModal();
        });

        const closeTextModal = () => document.getElementById('modal-text')?.classList.add('hidden');
        document.getElementById('modal-text-close')?.addEventListener('click', closeTextModal);
        document.getElementById('modal-text-cancel')?.addEventListener('click', closeTextModal);
        document.getElementById('modal-text-confirm')?.addEventListener('click', () => {
            const val = document.getElementById('text-input-value').value;
            if (val && val.trim()) window.PSTools.placeText(val.trim());
            closeTextModal();
        });
    },

    bindKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

            const key = e.key.toLowerCase();

            // Undo / Redo
            if ((e.ctrlKey || e.metaKey) && key === 'z') {
                e.preventDefault();
                if (e.shiftKey) window.PSHistory.redo();
                else window.PSHistory.undo();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && key === 'y') {
                e.preventDefault();
                window.PSHistory.redo();
                return;
            }

            // Save Project
            if ((e.ctrlKey || e.metaKey) && key === 's') {
                e.preventDefault();
                if (e.shiftKey) {
                    window.PSUtils.downloadCanvas(document.getElementById('main-canvas'), `aksh-edit-${Date.now()}.png`, 'image/png');
                } else {
                    window.PSProject.exportProject();
                }
                return;
            }

            // Free Transform Controls
            if (e.key === 'Enter' && window.PSTools.transformState && window.PSTools.transformState.active) {
                e.preventDefault();
                window.PSTools.applyFreeTransform();
                return;
            }
            if (e.key === 'Escape' && window.PSTools.transformState && window.PSTools.transformState.active) {
                e.preventDefault();
                window.PSTools.cancelFreeTransform();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && key === 't') {
                e.preventDefault();
                window.PSTools.startFreeTransform();
                return;
            }

            // New & Open
            if ((e.ctrlKey || e.metaKey) && key === 'n') {
                e.preventDefault();
                this.openDimensionsModal('new');
                return;
            }
            if ((e.ctrlKey || e.metaKey) && key === 'o') {
                e.preventDefault();
                document.getElementById('file-open-input')?.click();
                return;
            }

            // Selections
            if ((e.ctrlKey || e.metaKey) && key === 'a') {
                e.preventDefault();
                window.PSSelection.selectAll();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && key === 'd') {
                e.preventDefault();
                window.PSSelection.deselect();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'i') {
                e.preventDefault();
                window.PSSelection.invert();
                return;
            }

            // Layer Clear
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                window.PSLayers.clearActiveLayer();
                return;
            }

            // Tool Shortcuts
            const toolShortcuts = {
                v: 'move',
                m: 'marquee',
                l: 'lasso',
                w: 'wand',
                c: 'crop',
                i: 'eyedropper',
                b: 'brush',
                e: 'eraser',
                s: 'stamp',
                g: 'bucket',
                u: 'line',
                r: 'rect',
                o: 'circle',
                t: 'text',
                h: 'hand',
                z: 'zoom'
            };

            if (!e.ctrlKey && !e.metaKey && toolShortcuts[key]) {
                window.PSTools.selectTool(toolShortcuts[key]);
            } else if (key === 'x') {
                document.getElementById('btn-swap-colors')?.click();
            } else if (key === 'd') {
                // Reset colors to black and white
                window.PSTools.fgColor = '#000000';
                window.PSTools.bgColor = '#ffffff';
                const fg = document.getElementById('fg-color');
                const bg = document.getElementById('bg-color');
                if (fg) fg.value = '#000000';
                if (bg) bg.value = '#ffffff';
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.PSApp.init();
});
