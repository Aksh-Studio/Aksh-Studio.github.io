/**
 * Aksh Photoshop - Multi-Layer Engine & Canvas Compositor
 */

window.PSLayers = {
    layers: [],
    activeLayerId: null,
    counter: 1,

    init(width, height, bgType = 'white') {
        this.layers = [];
        this.counter = 1;
        const baseLayer = this.createLayerObject('Background', width, height);

        if (bgType === 'white') {
            baseLayer.ctx.fillStyle = '#ffffff';
            baseLayer.ctx.fillRect(0, 0, width, height);
        } else if (bgType === 'black') {
            baseLayer.ctx.fillStyle = '#000000';
            baseLayer.ctx.fillRect(0, 0, width, height);
        }

        this.layers.push(baseLayer);
        this.activeLayerId = baseLayer.id;
        this.renderLayersList();
        this.compositeAll();
    },

    createLayerObject(name, width, height) {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        return {
            id: 'layer_' + Date.now() + '_' + (this.counter++),
            name: name || `Layer ${this.counter}`,
            canvas: c,
            ctx: ctx,
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'source-over',
            x: 0,
            y: 0
        };
    },

    getActiveLayer() {
        return this.layers.find(l => l.id === this.activeLayerId) || this.layers[0] || null;
    },

    addNewLayer(name) {
        const w = window.PSApp.width;
        const h = window.PSApp.height;
        const layer = this.createLayerObject(name || `Layer ${this.layers.length + 1}`, w, h);
        this.layers.push(layer);
        this.activeLayerId = layer.id;
        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`New Layer (${layer.name})`);
        return layer;
    },

    addImageAsLayer(img, name = 'Image Layer') {
        const w = window.PSApp.width;
        const h = window.PSApp.height;
        const layer = this.createLayerObject(name, w, h);

        const scale = Math.min(w / img.width, h / img.height, 1);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const offsetX = Math.round((w - drawW) / 2);
        const offsetY = Math.round((h - drawH) / 2);

        layer.ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        this.layers.push(layer);
        this.activeLayerId = layer.id;
        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`Import ${name}`);
        return layer;
    },

    duplicateActiveLayer() {
        const active = this.getActiveLayer();
        if (!active) return;

        const copy = this.createLayerObject(`${active.name} Copy`, active.canvas.width, active.canvas.height);
        copy.ctx.drawImage(active.canvas, 0, 0);
        copy.opacity = active.opacity;
        copy.blendMode = active.blendMode;
        copy.x = active.x;
        copy.y = active.y;
        copy.locked = false;

        const idx = this.layers.findIndex(l => l.id === active.id);
        this.layers.splice(idx + 1, 0, copy);
        this.activeLayerId = copy.id;
        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`Duplicate Layer (${active.name})`);
    },

    deleteActiveLayer() {
        if (this.layers.length <= 1) {
            this.clearActiveLayer();
            return;
        }
        const idx = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (idx === -1) return;

        const deletedName = this.layers[idx].name;
        this.layers.splice(idx, 1);
        const nextIdx = Math.max(0, idx - 1);
        this.activeLayerId = this.layers[nextIdx].id;
        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`Delete Layer (${deletedName})`);
    },

    clearActiveLayer() {
        const active = this.getActiveLayer();
        if (!active || active.locked) return;

        if (window.PSSelection && window.PSSelection.isActive) {
            window.PSSelection.clearSelectionPixels(active);
        } else {
            active.ctx.clearRect(0, 0, active.canvas.width, active.canvas.height);
        }

        this.compositeAll();
        this.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Clear Layer');
    },

    fillActiveLayer(color) {
        const active = this.getActiveLayer();
        if (!active || active.locked) return;

        if (window.PSSelection && window.PSSelection.isActive) {
            window.PSSelection.fillSelectionPixels(active, color);
        } else {
            active.ctx.fillStyle = color;
            active.ctx.fillRect(0, 0, active.canvas.width, active.canvas.height);
        }

        this.compositeAll();
        this.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Fill Layer');
    },

    toggleLock(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            layer.locked = !layer.locked;
            this.renderLayersList();
        }
    },

    moveActiveLayerOrder(direction) {
        const idx = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (idx === -1) return;

        const targetIdx = idx + direction;
        if (targetIdx < 0 || targetIdx >= this.layers.length) return;

        const temp = this.layers[idx];
        this.layers[idx] = this.layers[targetIdx];
        this.layers[targetIdx] = temp;

        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Reorder Layer');
    },

    mergeDown() {
        const idx = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (idx <= 0) return;

        const topLayer = this.layers[idx];
        const bottomLayer = this.layers[idx - 1];
        if (bottomLayer.locked) return;

        bottomLayer.ctx.save();
        bottomLayer.ctx.globalAlpha = topLayer.opacity / 100;
        bottomLayer.ctx.globalCompositeOperation = topLayer.blendMode;
        bottomLayer.ctx.drawImage(topLayer.canvas, topLayer.x - bottomLayer.x, topLayer.y - bottomLayer.y);
        bottomLayer.ctx.restore();

        this.layers.splice(idx, 1);
        this.activeLayerId = bottomLayer.id;
        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Merge Down');
    },

    flattenImage() {
        if (this.layers.length <= 1) return;

        const w = window.PSApp.width;
        const h = window.PSApp.height;
        const flattened = this.createLayerObject('Background', w, h);

        // Fill background white
        flattened.ctx.fillStyle = '#ffffff';
        flattened.ctx.fillRect(0, 0, w, h);

        this.layers.forEach(layer => {
            if (!layer.visible) return;
            flattened.ctx.save();
            flattened.ctx.globalAlpha = layer.opacity / 100;
            flattened.ctx.globalCompositeOperation = layer.blendMode;
            flattened.ctx.drawImage(layer.canvas, layer.x, layer.y);
            flattened.ctx.restore();
        });

        this.layers = [flattened];
        this.activeLayerId = flattened.id;
        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Flatten Image');
    },

    flipActiveLayer(horizontal = true) {
        const layer = this.getActiveLayer();
        if (!layer || layer.locked) return;

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

        this.compositeAll();
        this.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(horizontal ? 'Flip Horizontal' : 'Flip Vertical');
    },

    compositeAll(previewFilterFn = null) {
        const mainCanvas = document.getElementById('main-canvas');
        if (!mainCanvas) return;
        const mainCtx = mainCanvas.getContext('2d');
        mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

        this.layers.forEach(layer => {
            if (!layer.visible) return;
            mainCtx.save();
            mainCtx.globalAlpha = layer.opacity / 100;
            mainCtx.globalCompositeOperation = layer.blendMode;

            if (previewFilterFn && layer.id === this.activeLayerId) {
                const tempCanvas = previewFilterFn(layer.canvas);
                mainCtx.drawImage(tempCanvas, layer.x, layer.y);
            } else {
                mainCtx.drawImage(layer.canvas, layer.x, layer.y);
            }
            mainCtx.restore();
        });
    },

    renderLayersList() {
        const listEl = document.getElementById('layers-list');
        const countBadge = document.getElementById('layer-count-badge');
        const blendSelect = document.getElementById('layer-blend-mode');
        const opacityInput = document.getElementById('layer-opacity-input');

        if (!listEl) return;
        listEl.innerHTML = '';
        if (countBadge) countBadge.textContent = this.layers.length;

        const active = this.getActiveLayer();
        if (active) {
            if (blendSelect) blendSelect.value = active.blendMode;
            if (opacityInput) opacityInput.value = active.opacity;
        }

        // Render from top of stack downwards in the UI
        [...this.layers].reverse().forEach(layer => {
            const item = document.createElement('div');
            item.className = `layer-item ${layer.id === this.activeLayerId ? 'active' : ''} ${layer.locked ? 'locked' : ''}`;

            // Visibility Eye Button
            const visBtn = document.createElement('button');
            visBtn.className = `layer-vis-btn ${layer.visible ? 'visible' : ''}`;
            visBtn.title = layer.visible ? 'Hide Layer' : 'Show Layer';
            visBtn.innerHTML = window.PSIcons.get(layer.visible ? 'eye' : 'eye-slash', '', 14, 14);
            visBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                layer.visible = !layer.visible;
                this.renderLayersList();
                this.compositeAll();
                window.PSStorage.markDirty();
            });

            // Lock Button
            const lockBtn = document.createElement('button');
            lockBtn.className = `layer-lock-btn ${layer.locked ? 'locked' : ''}`;
            lockBtn.title = layer.locked ? 'Unlock Layer' : 'Lock Layer';
            lockBtn.innerHTML = window.PSIcons.get(layer.locked ? 'lock' : 'unlock', '', 12, 12);
            lockBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                layer.locked = !layer.locked;
                this.renderLayersList();
            });

            // Thumbnail
            const thumb = document.createElement('canvas');
            thumb.className = 'layer-thumb';
            thumb.width = 40;
            thumb.height = 30;
            const tCtx = thumb.getContext('2d');
            tCtx.drawImage(layer.canvas, 0, 0, 40, 30);

            // Layer Info (Name & Meta)
            const info = document.createElement('div');
            info.className = 'layer-info';
            info.innerHTML = `
                <span class="layer-name" title="Double click to rename">${layer.name}</span>
                <span class="layer-meta">${layer.opacity}% • ${this.formatBlendMode(layer.blendMode)}</span>
            `;

            item.addEventListener('click', () => {
                this.activeLayerId = layer.id;
                this.renderLayersList();
            });

            item.addEventListener('dblclick', () => {
                const newName = prompt('Rename Layer:', layer.name);
                if (newName && newName.trim()) {
                    layer.name = newName.trim();
                    this.renderLayersList();
                    window.PSStorage.markDirty();
                    window.PSHistory.saveState('Rename Layer');
                }
            });

            item.appendChild(visBtn);
            item.appendChild(lockBtn);
            item.appendChild(thumb);
            item.appendChild(info);
            listEl.appendChild(item);
        });
    },

    formatBlendMode(mode) {
        const names = {
            'source-over': 'Normal',
            'multiply': 'Multiply',
            'screen': 'Screen',
            'overlay': 'Overlay',
            'darken': 'Darken',
            'lighten': 'Lighten',
            'color-dodge': 'Color Dodge',
            'color-burn': 'Color Burn',
            'hard-light': 'Hard Light',
            'soft-light': 'Soft Light',
            'difference': 'Difference',
            'exclusion': 'Exclusion',
            'hue': 'Hue',
            'saturation': 'Saturation',
            'color': 'Color',
            'luminosity': 'Luminosity'
        };
        return names[mode] || mode;
    }
};
