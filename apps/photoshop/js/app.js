/**
 * Aksh Photoshop - Master Application Controller
 */

window.PSApp = {
    width: 800,
    height: 600,
    zoom: 1,
    panX: 0,
    panY: 0,
    modalMode: 'new', // 'new', 'canvas', or 'image'
    currentTheme: 'dark',
    documents: [],
    activeDocId: null,
    docCounter: 1,

    async init(initialWidth = 800, initialHeight = 600) {
        this.width = initialWidth;
        this.height = initialHeight;
        this.registerServiceWorker();

        this.setCanvasDimensions(this.width, this.height, false);
        window.PSIcons.hydrateIcons();
        window.PSSelection.init(this.width, this.height);
        window.PSHistory.init();
        window.PSLayers.init(this.width, this.height, 'white');
        window.PSAdjustments.init();
        window.PSTools.init();
        window.PSHistory.saveState('New Document');

        // Initialize active document state
        const initialDoc = {
            id: 'doc_' + Date.now() + '_0',
            title: 'Untitled-1',
            width: this.width,
            height: this.height,
            layers: window.PSLayers.layers,
            activeLayerId: window.PSLayers.activeLayerId,
            historyStack: window.PSHistory.stack,
            historyIndex: window.PSHistory.currentIndex,
            zoom: 1,
            panX: 0,
            panY: 0
        };
        this.documents = [initialDoc];
        this.activeDocId = initialDoc.id;
        this.renderDocumentTabs();

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
                if (!layer.canvas) return;
                const temp = document.createElement('canvas');
                temp.width = layer.canvas.width;
                temp.height = layer.canvas.height;
                temp.getContext('2d').drawImage(layer.canvas, 0, 0);

                layer.canvas.width = w;
                layer.canvas.height = h;
                layer.ctx = layer.canvas.getContext('2d', { willReadFrequently: true });
                layer.ctx.drawImage(temp, 0, 0);

                if (layer.hasMask && layer.maskCanvas) {
                    const mTemp = document.createElement('canvas');
                    mTemp.width = layer.maskCanvas.width;
                    mTemp.height = layer.maskCanvas.height;
                    mTemp.getContext('2d').drawImage(layer.maskCanvas, 0, 0);
                    layer.maskCanvas.width = w;
                    layer.maskCanvas.height = h;
                    layer.maskCtx = layer.maskCanvas.getContext('2d', { willReadFrequently: true });
                    layer.maskCtx.drawImage(mTemp, 0, 0);
                }
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

    createDocument(title, width, height, bgType = 'white') {
        this.saveActiveDocumentState();

        const docId = 'doc_' + Date.now() + '_' + (this.docCounter++);
        const w = width || 800;
        const h = height || 600;

        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (bgType === 'white') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
        } else if (bgType === 'black') {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);
        }

        const baseLayer = {
            id: 'layer_' + Date.now() + '_1',
            name: 'Background',
            canvas: c,
            ctx: ctx,
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'source-over',
            x: 0,
            y: 0,
            hasMask: false,
            maskCanvas: null,
            maskCtx: null,
            maskDisabled: false,
            editingTarget: 'layer',
            isGroup: false,
            groupId: null,
            expanded: true,
            clipped: false,
            alphaLocked: false
        };

        const newDoc = {
            id: docId,
            title: title || `Untitled-${this.docCounter - 1}`,
            width: w,
            height: h,
            layers: [baseLayer],
            activeLayerId: baseLayer.id,
            historyStack: [],
            historyIndex: -1,
            zoom: 1,
            panX: 0,
            panY: 0
        };

        this.documents.push(newDoc);
        this.activeDocId = docId;

        this.setCanvasDimensions(w, h, false);
        window.PSLayers.layers = newDoc.layers;
        window.PSLayers.activeLayerId = baseLayer.id;
        window.PSHistory.init();
        window.PSLayers.renderLayersList();
        window.PSLayers.compositeAll();
        window.PSHistory.saveState('New Document');
        this.renderDocumentTabs();
        this.fitToScreen();
        return newDoc;
    },

    saveActiveDocumentState() {
        if (!this.activeDocId) return;
        const currentDoc = this.documents.find(d => d.id === this.activeDocId);
        if (!currentDoc) return;
        currentDoc.width = this.width;
        currentDoc.height = this.height;
        currentDoc.layers = window.PSLayers.layers;
        currentDoc.activeLayerId = window.PSLayers.activeLayerId;
        currentDoc.historyStack = window.PSHistory.stack;
        currentDoc.historyIndex = window.PSHistory.currentIndex;
        currentDoc.zoom = this.zoom;
        currentDoc.panX = this.panX;
        currentDoc.panY = this.panY;
    },

    switchDocument(docId) {
        if (this.activeDocId === docId) return;
        this.saveActiveDocumentState();

        const target = this.documents.find(d => d.id === docId);
        if (!target) return;

        this.activeDocId = target.id;
        this.width = target.width;
        this.height = target.height;
        this.setCanvasDimensions(target.width, target.height, false);

        window.PSLayers.layers = target.layers;
        window.PSLayers.activeLayerId = target.activeLayerId || target.layers[0]?.id;
        window.PSHistory.stack = target.historyStack || [];
        window.PSHistory.currentIndex = target.historyIndex !== undefined ? target.historyIndex : -1;
        this.zoom = target.zoom || 1;
        this.panX = target.panX || 0;
        this.panY = target.panY || 0;

        if (window.PSSelection) {
            window.PSSelection.deselect();
        }

        window.PSLayers.renderLayersList();
        window.PSLayers.compositeAll();
        window.PSHistory.renderUI();
        this.updateViewportTransform();
        this.renderDocumentTabs();
    },

    closeDocument(docId) {
        const idx = this.documents.findIndex(d => d.id === docId);
        if (idx === -1) return;

        const targetDoc = this.documents[idx];
        if (targetDoc && (targetDoc.isDirty || (targetDoc.historyStack && targetDoc.historyStack.length > 1))) {
            if (typeof window.confirm === 'function' && !window.confirm(`Close "${targetDoc.title || 'document'}"? Unsaved changes will be lost.`)) {
                return;
            }
        }

        if (this.documents.length === 1) {
            this.createDocument('Untitled-1', 800, 600, 'white');
            const oldIdx = this.documents.findIndex(d => d.id === docId);
            if (oldIdx !== -1) this.documents.splice(oldIdx, 1);
            this.renderDocumentTabs();
            return;
        }

        this.documents.splice(idx, 1);
        if (this.activeDocId === docId) {
            const nextDoc = this.documents[Math.max(0, idx - 1)] || this.documents[0];
            if (nextDoc) {
                this.activeDocId = null;
                this.switchDocument(nextDoc.id);
            }
        } else {
            this.renderDocumentTabs();
        }
    },

    renderDocumentTabs() {
        const bar = document.getElementById('doc-tabs-bar');
        if (!bar) return;
        bar.innerHTML = '';

        this.documents.forEach(doc => {
            const tab = document.createElement('div');
            tab.className = `doc-tab ${doc.id === this.activeDocId ? 'active' : ''}`;
            tab.dataset.id = doc.id;
            tab.innerHTML = `
                <span class="doc-tab-title" title="${doc.title}">${doc.title}</span>
                <button type="button" class="doc-tab-close" title="Close Document">×</button>
            `;
            tab.addEventListener('click', (e) => {
                if (e.target.closest('.doc-tab-close')) {
                    e.stopPropagation();
                    this.closeDocument(doc.id);
                } else {
                    this.switchDocument(doc.id);
                }
            });
            bar.appendChild(tab);
        });

        const newTabBtn = document.createElement('button');
        newTabBtn.type = 'button';
        newTabBtn.className = 'doc-tab-new';
        newTabBtn.id = 'btn-new-tab';
        newTabBtn.title = 'New Document (Ctrl+N)';
        newTabBtn.innerHTML = '+';
        newTabBtn.addEventListener('click', () => {
            this.openDimensionsModal('new');
        });
        bar.appendChild(newTabBtn);
    },

    resizeImage(newW, newH) {
        const oldW = this.width;
        const oldH = this.height;
        if (newW <= 0 || newH <= 0 || (newW === oldW && newH === oldH)) return;

        window.PSLayers.layers.forEach(layer => {
            if (layer.isGroup) return;
            const temp = document.createElement('canvas');
            temp.width = newW;
            temp.height = newH;
            const tCtx = temp.getContext('2d', { willReadFrequently: true });
            tCtx.imageSmoothingEnabled = true;
            tCtx.imageSmoothingQuality = 'high';
            tCtx.drawImage(layer.canvas, 0, 0, newW, newH);

            layer.canvas.width = newW;
            layer.canvas.height = newH;
            layer.ctx = layer.canvas.getContext('2d', { willReadFrequently: true });
            layer.ctx.drawImage(temp, 0, 0);

            if (layer.hasMask && layer.maskCanvas) {
                const mTemp = document.createElement('canvas');
                mTemp.width = newW;
                mTemp.height = newH;
                const mCtx = mTemp.getContext('2d', { willReadFrequently: true });
                mCtx.imageSmoothingEnabled = true;
                mCtx.imageSmoothingQuality = 'high';
                mCtx.drawImage(layer.maskCanvas, 0, 0, newW, newH);

                layer.maskCanvas.width = newW;
                layer.maskCanvas.height = newH;
                layer.maskCtx = layer.maskCanvas.getContext('2d', { willReadFrequently: true });
                layer.maskCtx.drawImage(mTemp, 0, 0);
            }
        });

        this.setCanvasDimensions(newW, newH, false);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`Image Size (${newW}×${newH})`);
        this.saveActiveDocumentState();
    },

    resizeCanvas(newW, newH, anchor = 'center') {
        const oldW = this.width;
        const oldH = this.height;
        if (newW <= 0 || newH <= 0 || (newW === oldW && newH === oldH)) return;

        let offsetX = 0;
        let offsetY = 0;
        if (anchor === 'center') {
            offsetX = Math.round((newW - oldW) / 2);
            offsetY = Math.round((newH - oldH) / 2);
        } else if (anchor === 'bottom-right') {
            offsetX = newW - oldW;
            offsetY = newH - oldH;
        }

        window.PSLayers.layers.forEach(layer => {
            if (layer.isGroup) return;
            const temp = document.createElement('canvas');
            temp.width = newW;
            temp.height = newH;
            const tCtx = temp.getContext('2d', { willReadFrequently: true });
            tCtx.drawImage(layer.canvas, offsetX, offsetY);

            layer.canvas.width = newW;
            layer.canvas.height = newH;
            layer.ctx = layer.canvas.getContext('2d', { willReadFrequently: true });
            layer.ctx.drawImage(temp, 0, 0);

            if (layer.hasMask && layer.maskCanvas) {
                const mTemp = document.createElement('canvas');
                mTemp.width = newW;
                mTemp.height = newH;
                const mCtx = mTemp.getContext('2d', { willReadFrequently: true });
                mCtx.drawImage(layer.maskCanvas, offsetX, offsetY);

                layer.maskCanvas.width = newW;
                layer.maskCanvas.height = newH;
                layer.maskCtx = layer.maskCanvas.getContext('2d', { willReadFrequently: true });
                layer.maskCtx.drawImage(mTemp, 0, 0);
            }
        });

        this.setCanvasDimensions(newW, newH, false);
        window.PSLayers.compositeAll();
        window.PSLayers.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`Canvas Size (${newW}×${newH})`);
        this.saveActiveDocumentState();
    },

    openLevelsModal() {
        const modal = document.getElementById('modal-levels');
        if (!modal) return;
        document.getElementById('levels-in-black').value = 0;
        document.getElementById('levels-in-white').value = 255;
        document.getElementById('levels-gamma').value = 1.0;
        document.getElementById('levels-out-black').value = 0;
        document.getElementById('levels-out-white').value = 255;
        modal.classList.remove('hidden');
    },

    openCurvesModal() {
        const modal = document.getElementById('modal-curves');
        if (!modal) return;
        const presetEl = document.getElementById('curves-preset');
        if (presetEl) presetEl.value = 'linear';
        const inInput = document.getElementById('curves-in-x');
        const outInput = document.getElementById('curves-out-y');
        if (inInput) inInput.value = 128;
        if (outInput) outInput.value = 128;
        const inSpan = document.getElementById('curves-in-x-val');
        if (inSpan) inSpan.textContent = '128';
        const outSpan = document.getElementById('curves-out-y-val');
        if (outSpan) outSpan.textContent = '128';
        modal.classList.remove('hidden');
        this.renderCurvesGraph([{ x: 0, y: 0 }, { x: 255, y: 255 }]);
    },

    renderCurvesGraph(points = [{ x: 0, y: 0 }, { x: 255, y: 255 }]) {
        const canvas = document.getElementById('curves-graph-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = '#1a1c23';
        ctx.fillRect(0, 0, w, h);

        // 4x4 Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
            const pos = Math.round((i / 4) * w);
            ctx.beginPath();
            ctx.moveTo(pos, 0);
            ctx.lineTo(pos, h);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, pos);
            ctx.lineTo(w, pos);
            ctx.stroke();
        }

        // Diagonal baseline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(w, 0);
        ctx.stroke();

        // Plotted curve
        if (window.PSAdjustments && window.PSAdjustments.buildCurvesLUT) {
            const lut = window.PSAdjustments.buildCurvesLUT(points);
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < 256; i++) {
                const cx = (i / 255) * w;
                const cy = h - (lut[i] / 255) * h;
                if (i === 0) ctx.moveTo(cx, cy);
                else ctx.lineTo(cx, cy);
            }
            ctx.stroke();
        }

        // Draw points
        if (points && points.length) {
            ctx.fillStyle = '#60a5fa';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            points.forEach(pt => {
                const cx = (pt.x / 255) * w;
                const cy = h - (pt.y / 255) * h;
                ctx.beginPath();
                ctx.arc(cx, cy, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });
        }
    },

    openDimensionsModal(mode = 'new') {
        this.modalMode = mode;
        const modal = document.getElementById('modal-dimensions');
        const title = document.getElementById('modal-dim-title');
        const bgGroup = document.getElementById('dim-bg-group');
        const anchorGroup = document.getElementById('dim-anchor-group');
        const confirmBtn = document.getElementById('modal-dim-confirm');

        document.getElementById('dim-width').value = this.width;
        document.getElementById('dim-height').value = this.height;

        if (mode === 'new') {
            title.textContent = 'New Document';
            confirmBtn.textContent = 'Create';
            bgGroup?.classList.remove('hidden');
            anchorGroup?.classList.add('hidden');
        } else if (mode === 'image') {
            title.textContent = 'Image Size (Resample)';
            confirmBtn.textContent = 'Resample';
            bgGroup?.classList.add('hidden');
            anchorGroup?.classList.add('hidden');
        } else {
            title.textContent = 'Resize Canvas';
            confirmBtn.textContent = 'Resize Canvas';
            bgGroup?.classList.add('hidden');
            anchorGroup?.classList.remove('hidden');
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

                    // Synchronize active document tab
                    if (this.activeDocId && this.documents) {
                        const currentDoc = this.documents.find(d => d.id === this.activeDocId);
                        if (currentDoc) {
                            currentDoc.title = file.name.replace(/\.[^/.]+$/, '');
                            currentDoc.width = img.width;
                            currentDoc.height = img.height;
                            currentDoc.layers = window.PSLayers.layers;
                            currentDoc.activeLayerId = base.id;
                            currentDoc.historyStack = window.PSHistory.stack;
                            currentDoc.historyIndex = window.PSHistory.currentIndex;
                            this.renderDocumentTabs();
                        }
                    }
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

        // Edit Menu & Clipboard
        document.getElementById('menu-undo')?.addEventListener('click', () => window.PSHistory.undo());
        document.getElementById('menu-redo')?.addEventListener('click', () => window.PSHistory.redo());
        document.getElementById('menu-copy')?.addEventListener('click', () => window.PSSelection.copy());
        document.getElementById('menu-cut')?.addEventListener('click', () => window.PSSelection.cut());
        document.getElementById('menu-paste')?.addEventListener('click', () => window.PSSelection.paste());
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

        // Image Menu & Sizing
        document.getElementById('menu-image-size')?.addEventListener('click', () => this.openDimensionsModal('image'));
        document.getElementById('menu-resize-canvas')?.addEventListener('click', () => this.openDimensionsModal('canvas'));
        document.getElementById('menu-flip-h')?.addEventListener('click', () => window.PSLayers.flipActiveLayer(true));
        document.getElementById('menu-flip-v')?.addEventListener('click', () => window.PSLayers.flipActiveLayer(false));
        document.getElementById('menu-rotate-cw')?.addEventListener('click', () => this.rotateCanvas90(true));
        document.getElementById('menu-rotate-ccw')?.addEventListener('click', () => this.rotateCanvas90(false));
        document.getElementById('menu-auto-contrast')?.addEventListener('click', () => window.PSAdjustments.applyDirectFilter('auto-contrast'));
        document.getElementById('menu-invert-colors')?.addEventListener('click', () => window.PSAdjustments.applyDirectFilter('invert'));
        document.getElementById('menu-grayscale')?.addEventListener('click', () => window.PSAdjustments.applyDirectFilter('grayscale'));
        document.getElementById('menu-sepia')?.addEventListener('click', () => window.PSAdjustments.applyDirectFilter('sepia'));

        // Layer Menu & Hierarchy / Mask Actions
        document.getElementById('menu-new-layer')?.addEventListener('click', () => window.PSLayers.addNewLayer());
        document.getElementById('menu-new-group')?.addEventListener('click', () => window.PSLayers.createGroup());
        document.getElementById('menu-dup-layer')?.addEventListener('click', () => window.PSLayers.duplicateActiveLayer());
        document.getElementById('menu-del-layer')?.addEventListener('click', () => window.PSLayers.deleteActiveLayer());
        document.getElementById('menu-add-mask')?.addEventListener('click', () => window.PSLayers.addMaskToActiveLayer());
        document.getElementById('menu-remove-mask')?.addEventListener('click', () => window.PSLayers.removeMask());
        document.getElementById('menu-disable-mask')?.addEventListener('click', () => window.PSLayers.toggleMaskDisabled());
        document.getElementById('menu-clip-mask')?.addEventListener('click', () => window.PSLayers.toggleClippingMask());
        document.getElementById('menu-alpha-lock')?.addEventListener('click', () => window.PSLayers.toggleAlphaLock());
        document.getElementById('menu-merge-down')?.addEventListener('click', () => window.PSLayers.mergeDown());
        document.getElementById('menu-flatten')?.addEventListener('click', () => window.PSLayers.flattenImage());
        document.getElementById('menu-layer-up')?.addEventListener('click', () => window.PSLayers.moveActiveLayerOrder(1));
        document.getElementById('menu-layer-down')?.addEventListener('click', () => window.PSLayers.moveActiveLayerOrder(-1));

        // Selection Menu & Refinements
        document.getElementById('menu-select-all')?.addEventListener('click', () => window.PSSelection.selectAll());
        document.getElementById('menu-deselect')?.addEventListener('click', () => window.PSSelection.deselect());
        document.getElementById('menu-invert-selection')?.addEventListener('click', () => window.PSSelection.invert());
        document.getElementById('menu-select-feather')?.addEventListener('click', () => {
            const rad = parseInt(prompt('Feather Radius (px):', '5'), 10) || 5;
            window.PSSelection.feather(rad);
        });
        document.getElementById('menu-select-expand')?.addEventListener('click', () => {
            const rad = parseInt(prompt('Expand Radius (px):', '5'), 10) || 5;
            window.PSSelection.expand(rad);
        });
        document.getElementById('menu-select-contract')?.addEventListener('click', () => {
            const rad = parseInt(prompt('Contract Radius (px):', '5'), 10) || 5;
            window.PSSelection.contract(rad);
        });

        // Direct Convolution Filters
        ['blur', 'sharpen', 'edge', 'emboss', 'pixelate', 'noise', 'vignette'].forEach(f => {
            document.getElementById(`menu-filter-${f}`)?.addEventListener('click', () => {
                window.PSAdjustments.applyDirectFilter(f);
            });
        });

        // Advanced & Tonal Filters
        document.getElementById('menu-filter-levels')?.addEventListener('click', () => this.openLevelsModal());
        document.getElementById('menu-filter-curves')?.addEventListener('click', () => this.openCurvesModal());
        document.getElementById('menu-filter-motion-blur')?.addEventListener('click', () => {
            const dist = parseInt(prompt('Motion Blur Distance (px):', '15'), 10) || 15;
            const angle = parseInt(prompt('Motion Blur Angle (degrees):', '0'), 10) || 0;
            window.PSAdjustments.applyMotionBlur(angle, dist);
        });
        document.getElementById('menu-filter-unsharp-mask')?.addEventListener('click', () => {
            const rad = parseFloat(prompt('Unsharp Mask Radius (px):', '2')) || 2;
            const amt = parseFloat(prompt('Unsharp Mask Amount (1.0 - 5.0):', '1.5')) || 1.5;
            window.PSAdjustments.applyUnsharpMask(rad, amt);
        });
        document.getElementById('menu-filter-median')?.addEventListener('click', () => {
            const rad = parseInt(prompt('Median Filter Radius (1 - 4):', '2'), 10) || 2;
            window.PSAdjustments.applyMedianFilter(rad);
        });
        document.getElementById('menu-filter-posterize')?.addEventListener('click', () => {
            const lev = parseInt(prompt('Posterize Levels (2 - 32):', '4'), 10) || 4;
            window.PSAdjustments.applyPosterize(lev);
        });
        document.getElementById('menu-filter-threshold')?.addEventListener('click', () => {
            const th = parseInt(prompt('Threshold Level (1 - 254):', '128'), 10) || 128;
            window.PSAdjustments.applyThreshold(th);
        });
        // Color Balance Modal Listeners
        const closeCBModal = () => document.getElementById('modal-color-balance')?.classList.add('hidden');
        document.getElementById('menu-filter-color-balance')?.addEventListener('click', () => {
            const crInput = document.getElementById('cb-cyan-red');
            const mgInput = document.getElementById('cb-magenta-green');
            const ybInput = document.getElementById('cb-yellow-blue');
            if (crInput) crInput.value = 0;
            if (mgInput) mgInput.value = 0;
            if (ybInput) ybInput.value = 0;
            const crVal = document.getElementById('cb-cr-val');
            const mgVal = document.getElementById('cb-mg-val');
            const ybVal = document.getElementById('cb-yb-val');
            if (crVal) crVal.textContent = '0';
            if (mgVal) mgVal.textContent = '0';
            if (ybVal) ybVal.textContent = '0';
            document.getElementById('modal-color-balance')?.classList.remove('hidden');
        });
        document.getElementById('cb-cyan-red')?.addEventListener('input', (e) => {
            const el = document.getElementById('cb-cr-val');
            if (el) el.textContent = e.target.value;
        });
        document.getElementById('cb-magenta-green')?.addEventListener('input', (e) => {
            const el = document.getElementById('cb-mg-val');
            if (el) el.textContent = e.target.value;
        });
        document.getElementById('cb-yellow-blue')?.addEventListener('input', (e) => {
            const el = document.getElementById('cb-yb-val');
            if (el) el.textContent = e.target.value;
        });
        document.getElementById('modal-cb-reset')?.addEventListener('click', () => {
            const crInput = document.getElementById('cb-cyan-red');
            const mgInput = document.getElementById('cb-magenta-green');
            const ybInput = document.getElementById('cb-yellow-blue');
            if (crInput) crInput.value = 0;
            if (mgInput) mgInput.value = 0;
            if (ybInput) ybInput.value = 0;
            const crVal = document.getElementById('cb-cr-val');
            const mgVal = document.getElementById('cb-mg-val');
            const ybVal = document.getElementById('cb-yb-val');
            if (crVal) crVal.textContent = '0';
            if (mgVal) mgVal.textContent = '0';
            if (ybVal) ybVal.textContent = '0';
        });
        document.getElementById('modal-cb-close')?.addEventListener('click', closeCBModal);
        document.getElementById('modal-cb-cancel')?.addEventListener('click', closeCBModal);
        document.getElementById('modal-cb-confirm')?.addEventListener('click', () => {
            const cr = parseInt(document.getElementById('cb-cyan-red')?.value, 10) || 0;
            const mg = parseInt(document.getElementById('cb-magenta-green')?.value, 10) || 0;
            const yb = parseInt(document.getElementById('cb-yellow-blue')?.value, 10) || 0;
            window.PSAdjustments.applyColorBalance(cr, mg, yb);
            closeCBModal();
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

        // Layer Panel Footer Controls
        document.getElementById('btn-add-layer')?.addEventListener('click', () => window.PSLayers.addNewLayer());
        document.getElementById('btn-new-group')?.addEventListener('click', () => window.PSLayers.createGroup());
        document.getElementById('btn-add-mask')?.addEventListener('click', () => window.PSLayers.addMaskToActiveLayer());
        document.getElementById('btn-clip-mask')?.addEventListener('click', () => window.PSLayers.toggleClippingMask());
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

        // Dimensions Modal Handlers
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
            const bg = document.getElementById('dim-bg')?.value || 'white';
            const anchor = document.getElementById('dim-anchor')?.value || 'center';

            if (this.modalMode === 'new') {
                this.createDocument(`Untitled-${this.docCounter}`, w, h, bg);
            } else if (this.modalMode === 'image') {
                this.resizeImage(w, h);
            } else {
                this.resizeCanvas(w, h, anchor);
            }
            closeDimModal();
        });

        // Multi-line Text Modal Handlers
        const closeTextModal = () => document.getElementById('modal-text')?.classList.add('hidden');
        document.getElementById('modal-text-close')?.addEventListener('click', closeTextModal);
        document.getElementById('modal-text-cancel')?.addEventListener('click', closeTextModal);
        document.getElementById('modal-text-confirm')?.addEventListener('click', () => {
            const val = document.getElementById('text-input-value').value;
            if (val && val.trim()) window.PSTools.placeText(val.trim());
            closeTextModal();
        });

        // Levels Modal Listeners
        const closeLevelsModal = () => document.getElementById('modal-levels')?.classList.add('hidden');
        document.getElementById('modal-levels-close')?.addEventListener('click', closeLevelsModal);
        document.getElementById('modal-levels-cancel')?.addEventListener('click', closeLevelsModal);
        document.getElementById('modal-levels-confirm')?.addEventListener('click', () => {
            const inB = parseInt(document.getElementById('levels-in-black').value, 10) || 0;
            const inW = parseInt(document.getElementById('levels-in-white').value, 10) || 255;
            const gamma = parseFloat(document.getElementById('levels-gamma').value) || 1.0;
            const outB = parseInt(document.getElementById('levels-out-black').value, 10) || 0;
            const outW = parseInt(document.getElementById('levels-out-white').value, 10) || 255;
            window.PSAdjustments.applyLevels(inB, inW, gamma, outB, outW);
            closeLevelsModal();
        });

        // Curves Modal Listeners
        const closeCurvesModal = () => document.getElementById('modal-curves')?.classList.add('hidden');
        document.getElementById('modal-curves-close')?.addEventListener('click', closeCurvesModal);
        document.getElementById('modal-curves-cancel')?.addEventListener('click', closeCurvesModal);

        const getPointsForCurvesPreset = (preset) => {
            if (preset === 'contrast') {
                return [{ x: 0, y: 0 }, { x: 64, y: 48 }, { x: 192, y: 208 }, { x: 255, y: 255 }];
            } else if (preset === 'high-contrast') {
                return [{ x: 0, y: 0 }, { x: 64, y: 32 }, { x: 192, y: 224 }, { x: 255, y: 255 }];
            } else if (preset === 'brighten') {
                return [{ x: 0, y: 0 }, { x: 128, y: 165 }, { x: 255, y: 255 }];
            } else if (preset === 'darken') {
                return [{ x: 0, y: 0 }, { x: 128, y: 90 }, { x: 255, y: 255 }];
            } else if (preset === 'invert') {
                return [{ x: 0, y: 255 }, { x: 255, y: 0 }];
            }
            return [{ x: 0, y: 0 }, { x: 255, y: 255 }];
        };

        const updateCurvesFromUI = () => {
            const presetSelect = document.getElementById('curves-preset');
            const inInput = document.getElementById('curves-in-x');
            const outInput = document.getElementById('curves-out-y');
            const inVal = document.getElementById('curves-in-x-val');
            const outVal = document.getElementById('curves-out-y-val');

            const inX = parseInt(inInput?.value, 10) || 128;
            const outY = parseInt(outInput?.value, 10) || 128;
            if (inVal) inVal.textContent = inX;
            if (outVal) outVal.textContent = outY;

            let pts;
            if (presetSelect && presetSelect.value !== 'linear') {
                pts = getPointsForCurvesPreset(presetSelect.value);
            } else {
                pts = (inX !== 128 || outY !== 128)
                    ? [{ x: 0, y: 0 }, { x: inX, y: outY }, { x: 255, y: 255 }]
                    : [{ x: 0, y: 0 }, { x: 255, y: 255 }];
            }
            this.renderCurvesGraph(pts);
        };

        document.getElementById('curves-preset')?.addEventListener('change', (e) => {
            const val = e.target.value;
            const inInput = document.getElementById('curves-in-x');
            const outInput = document.getElementById('curves-out-y');
            if (val === 'brighten') {
                if (inInput) inInput.value = 128;
                if (outInput) outInput.value = 165;
            } else if (val === 'darken') {
                if (inInput) inInput.value = 128;
                if (outInput) outInput.value = 90;
            } else if (val === 'contrast') {
                if (inInput) inInput.value = 128;
                if (outInput) outInput.value = 128;
            } else if (val === 'linear') {
                if (inInput) inInput.value = 128;
                if (outInput) outInput.value = 128;
            }
            updateCurvesFromUI();
        });

        document.getElementById('curves-in-x')?.addEventListener('input', () => {
            const presetSelect = document.getElementById('curves-preset');
            if (presetSelect && presetSelect.value !== 'linear') {
                presetSelect.value = 'linear';
            }
            updateCurvesFromUI();
        });

        document.getElementById('curves-out-y')?.addEventListener('input', () => {
            const presetSelect = document.getElementById('curves-preset');
            if (presetSelect && presetSelect.value !== 'linear') {
                presetSelect.value = 'linear';
            }
            updateCurvesFromUI();
        });

        document.getElementById('modal-curves-reset')?.addEventListener('click', () => {
            const presetSelect = document.getElementById('curves-preset');
            const inInput = document.getElementById('curves-in-x');
            const outInput = document.getElementById('curves-out-y');
            if (presetSelect) presetSelect.value = 'linear';
            if (inInput) inInput.value = 128;
            if (outInput) outInput.value = 128;
            updateCurvesFromUI();
        });

        document.getElementById('modal-curves-confirm')?.addEventListener('click', () => {
            const preset = document.getElementById('curves-preset')?.value || 'linear';
            let points = [{ x: 0, y: 0 }, { x: 255, y: 255 }];
            if (preset !== 'linear') {
                points = getPointsForCurvesPreset(preset);
            } else {
                const inX = parseInt(document.getElementById('curves-in-x')?.value, 10) || 128;
                const outY = parseInt(document.getElementById('curves-out-y')?.value, 10) || 128;
                if (inX !== 128 || outY !== 128) {
                    points = [{ x: 0, y: 0 }, { x: inX, y: outY }, { x: 255, y: 255 }];
                }
            }
            window.PSAdjustments.applyCurves(points);
            closeCurvesModal();
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

            // Clipboard shortcuts
            if ((e.ctrlKey || e.metaKey) && key === 'c') {
                e.preventDefault();
                window.PSSelection.copy();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && key === 'x' && window.PSSelection.isActive) {
                e.preventDefault();
                window.PSSelection.cut();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && key === 'v') {
                e.preventDefault();
                window.PSSelection.paste();
                return;
            }

            // Clipping Mask toggle shortcut (Alt+Ctrl+G)
            if ((e.ctrlKey || e.metaKey) && e.altKey && key === 'g') {
                e.preventDefault();
                window.PSLayers.toggleClippingMask();
                return;
            }

            // Levels / Curves shortcuts
            if ((e.ctrlKey || e.metaKey) && key === 'l') {
                e.preventDefault();
                this.openLevelsModal();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && key === 'm') {
                e.preventDefault();
                this.openCurvesModal();
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
                p: 'pencil',
                e: 'eraser',
                s: 'stamp',
                j: 'spot-healing',
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
