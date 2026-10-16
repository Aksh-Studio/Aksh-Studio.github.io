/**
 * Aksh Photoshop - Multi-Layer Engine & Compositor
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
        window.PSHistory.saveState(`New Layer (${layer.name})`);
        return layer;
    },

    addImageAsLayer(img, name = 'Image Layer') {
        const w = window.PSApp.width;
        const h = window.PSApp.height;
        const layer = this.createLayerObject(name, w, h);

        // Center image inside canvas
        const scale = Math.min(w / img.width, h / img.height, 1);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const offsetX = (w - drawW) / 2;
        const offsetY = (h - drawH) / 2;

        layer.ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        this.layers.push(layer);
        this.activeLayerId = layer.id;
        this.renderLayersList();
        this.compositeAll();
        window.PSHistory.saveState(`Import ${name}`);
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

        const idx = this.layers.findIndex(l => l.id === active.id);
        this.layers.splice(idx + 1, 0, copy);
        this.activeLayerId = copy.id;
        this.renderLayersList();
        this.compositeAll();
        window.PSHistory.saveState('Duplicate Layer');
    },

    deleteActiveLayer() {
        if (this.layers.length <= 1) {
            this.clearActiveLayer();
            return;
        }
        const idx = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (idx === -1) return;

        this.layers.splice(idx, 1);
        const nextIdx = Math.max(0, idx - 1);
        this.activeLayerId = this.layers[nextIdx].id;
        this.renderLayersList();
        this.compositeAll();
        window.PSHistory.saveState('Delete Layer');
    },

    clearActiveLayer() {
        const active = this.getActiveLayer();
        if (!active) return;
        active.ctx.clearRect(0, 0, active.canvas.width, active.canvas.height);
        this.compositeAll();
        this.renderLayersList();
        window.PSHistory.saveState('Clear Layer');
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
        window.PSHistory.saveState('Reorder Layer');
    },

    mergeDown() {
        const idx = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (idx <= 0) return;

        const topLayer = this.layers[idx];
        const bottomLayer = this.layers[idx - 1];

        bottomLayer.ctx.save();
        bottomLayer.ctx.globalAlpha = topLayer.opacity / 100;
        bottomLayer.ctx.globalCompositeOperation = topLayer.blendMode;
        bottomLayer.ctx.drawImage(topLayer.canvas, topLayer.x - bottomLayer.x, topLayer.y - bottomLayer.y);
        bottomLayer.ctx.restore();

        this.layers.splice(idx, 1);
        this.activeLayerId = bottomLayer.id;
        this.renderLayersList();
        this.compositeAll();
        window.PSHistory.saveState('Merge Down');
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

        // Render top-most layer first in UI
        [...this.layers].reverse().forEach(layer => {
            const item = document.createElement('div');
            item.className = `layer-item ${layer.id === this.activeLayerId ? 'active' : ''}`;

            const visBtn = document.createElement('button');
            visBtn.className = `layer-vis-btn ${layer.visible ? 'visible' : ''}`;
            visBtn.innerHTML = `<i class="fa-solid ${layer.visible ? 'fa-eye' : 'fa-eye-slash'}"></i>`;
            visBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                layer.visible = !layer.visible;
                this.renderLayersList();
                this.compositeAll();
            });

            const thumb = document.createElement('img');
            thumb.className = 'layer-thumb';
            thumb.src = layer.canvas.toDataURL();

            const info = document.createElement('div');
            info.className = 'layer-info';
            info.innerHTML = `
                <span class="layer-name">${layer.name}</span>
                <span class="layer-meta">${layer.opacity}% • ${layer.blendMode}</span>
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
                }
            });

            item.appendChild(visBtn);
            item.appendChild(thumb);
            item.appendChild(info);
            listEl.appendChild(item);
        });
    }
};
