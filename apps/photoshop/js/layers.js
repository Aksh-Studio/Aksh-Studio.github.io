/**
 * layers.js — Phase 2: Layer management with Layer Masks
 * Each layer may optionally carry a grayscale mask canvas that non-destructively
 * drives the alpha channel during compositing.
 * Aksh Photoshop
 */
'use strict';

class LayerManager {
  /**
   * @param {AkshPhotoshop} app
   */
  constructor(app) {
    this.app         = app;
    /**
     * Layer objects:
     * {
     *   canvas:    HTMLCanvasElement  (offscreen pixel data)
     *   ctx:       CanvasRenderingContext2D
     *   name:      string
     *   visible:   boolean
     *   opacity:   number  0–1
     *   blendMode: string  CSS compositing keyword
     *   mask:      HTMLCanvasElement | null   (grayscale, same size as canvas)
     *   maskCtx:   CanvasRenderingContext2D | null
     *   maskEnabled: boolean
     * }
     */
    this.layers      = [];
    this.activeIndex = 0;
    this.listEl      = $('layers-list');
    this.dragSrcIndex = null;
  }

  get activeLayer() { return this.layers[this.activeIndex]; }
  getActiveLayer()  { return this.activeLayer; }

  // ── CRUD ──────────────────────────────────────────────────────────────

  /**
   * Add a new transparent layer above the active layer.
   * @param {string} [name]
   * @returns {Object} New layer
   */
  addLayer(name) {
    const { canvasWidth: w, canvasHeight: h } = this.app;
    const c   = createOffscreenCanvas(w, h);
    const ctx = c.getContext('2d');
    const layer = {
      canvas:      c,
      ctx,
      name:        name || `Layer ${this.layers.length + 1}`,
      visible:     true,
      opacity:     1.0,
      blendMode:   'source-over',
      mask:        null,
      maskCtx:     null,
      maskEnabled: false
    };
    const insertAt = this.layers.length === 0 ? 0 : this.activeIndex + 1;
    this.layers.splice(insertAt, 0, layer);
    this.activeIndex = insertAt;
    this.renderLayersPanel();
    this.app.composite();
    return layer;
  }

  /**
   * Delete a layer by index (refuses if only one remains).
   * @param {number} [idx]
   */
  deleteLayer(idx = this.activeIndex) {
    if (this.layers.length <= 1) { alert('Cannot delete the only layer.'); return; }
    this.layers.splice(idx, 1);
    this.activeIndex = clamp(this.activeIndex, 0, this.layers.length - 1);
    this.renderLayersPanel();
    this.app.composite();
  }

  /**
   * Duplicate a layer and insert the copy above it.
   * Copies the mask canvas if one exists.
   * @param {number} [idx]
   */
  duplicateLayer(idx = this.activeIndex) {
    const src = this.layers[idx];
    const { canvasWidth: w, canvasHeight: h } = this.app;

    const c   = createOffscreenCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.drawImage(src.canvas, 0, 0);

    let maskC = null, maskCtx = null;
    if (src.mask) {
      maskC   = createOffscreenCanvas(w, h);
      maskCtx = maskC.getContext('2d');
      maskCtx.drawImage(src.mask, 0, 0);
    }

    const layer = {
      canvas:      c,
      ctx,
      name:        src.name + ' copy',
      visible:     src.visible,
      opacity:     src.opacity,
      blendMode:   src.blendMode,
      mask:        maskC,
      maskCtx:     maskCtx,
      maskEnabled: src.maskEnabled
    };
    this.layers.splice(idx + 1, 0, layer);
    this.activeIndex = idx + 1;
    this.renderLayersPanel();
    this.app.composite();
  }

  /**
   * Merge the active layer down onto the layer below it.
   * Bakes in opacity AND blend mode of the top layer exactly as
   * the compositor sees them, including the mask if enabled.
   * @param {number} [idx]
   */
  mergeDown(idx = this.activeIndex) {
    if (idx <= 0) return;
    const top = this.layers[idx];
    const bot = this.layers[idx - 1];
    const { canvasWidth: w, canvasHeight: h } = this.app;

    // Build a "flat" version of the top layer by applying its mask first
    const flatC   = createOffscreenCanvas(w, h);
    const flatCtx = flatC.getContext('2d');

    if (top.mask && top.maskEnabled) {
      // Draw pixel data
      flatCtx.drawImage(top.canvas, 0, 0);
      // Multiply alpha by mask luminance using 'destination-in' trick
      // 1. Draw mask as greyscale source
      const maskApplyC   = createOffscreenCanvas(w, h);
      const maskApplyCtx = maskApplyC.getContext('2d');
      maskApplyCtx.drawImage(top.mask, 0, 0);
      // 2. Use the mask canvas to clip the flat canvas
      flatCtx.globalCompositeOperation = 'destination-in';
      flatCtx.drawImage(maskApplyC, 0, 0);
      flatCtx.globalCompositeOperation = 'source-over';
    } else {
      flatCtx.drawImage(top.canvas, 0, 0);
    }

    // Now bake the top layer (with mask applied) onto the bottom layer
    bot.ctx.save();
    bot.ctx.globalAlpha              = top.opacity;
    bot.ctx.globalCompositeOperation = top.blendMode;
    bot.ctx.drawImage(flatC, 0, 0);
    bot.ctx.restore();

    this.layers.splice(idx, 1);
    this.activeIndex = idx - 1;
    this.renderLayersPanel();
    this.app.composite();
  }

  /**
   * Flatten all visible layers into a single Background layer.
   */
  flatten() {
    const { canvasWidth: w, canvasHeight: h } = this.app;
    const c   = createOffscreenCanvas(w, h);
    const ctx = c.getContext('2d');

    this.layers
      .filter(l => l.visible)
      .forEach(l => {
        if (l.mask && l.maskEnabled) {
          // Apply mask before compositing
          const flatC   = createOffscreenCanvas(w, h);
          const flatCtx = flatC.getContext('2d');
          flatCtx.drawImage(l.canvas, 0, 0);
          flatCtx.globalCompositeOperation = 'destination-in';
          flatCtx.drawImage(l.mask, 0, 0);
          flatCtx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha              = l.opacity;
          ctx.globalCompositeOperation = l.blendMode;
          ctx.drawImage(flatC, 0, 0);
        } else {
          ctx.globalAlpha              = l.opacity;
          ctx.globalCompositeOperation = l.blendMode;
          ctx.drawImage(l.canvas, 0, 0);
        }
      });

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.layers = [{
      canvas: c, ctx,
      name: 'Background',
      visible: true, opacity: 1, blendMode: 'source-over',
      mask: null, maskCtx: null, maskEnabled: false
    }];
    this.activeIndex = 0;
    this.renderLayersPanel();
    this.app.composite();
  }

  /**
   * Reorder layers.
   * @param {number} fromIdx
   * @param {number} toIdx
   */
  moveLayer(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const [layer] = this.layers.splice(fromIdx, 1);
    this.layers.splice(toIdx, 0, layer);
    this.activeIndex = toIdx;
    this.renderLayersPanel();
    this.app.composite();
  }

  setActive(idx) {
    this.activeIndex = clamp(idx, 0, this.layers.length - 1);
    this.renderLayersPanel();
    this._syncPanelControls();
  }

  // ── LAYER MASKS ───────────────────────────────────────────────────────

  /**
   * Add a grayscale layer mask to the active layer.
   * The mask is initialised as solid white (fully opaque → no masking).
   * When maskEnabled is true, compositing uses destination-in to apply it.
   */
  addMask() {
    const l = this.activeLayer;
    if (!l) return;
    if (l.mask) { alert('This layer already has a mask.'); return; }

    const { canvasWidth: w, canvasHeight: h } = this.app;
    const mc  = createOffscreenCanvas(w, h);
    const mctx = mc.getContext('2d');
    // White = fully reveal layer content
    mctx.fillStyle = '#ffffff';
    mctx.fillRect(0, 0, w, h);

    l.mask        = mc;
    l.maskCtx     = mctx;
    l.maskEnabled = true;

    this.renderLayersPanel();
    this._updateMaskPanel();
  }

  /**
   * Delete the mask on the active layer.
   */
  deleteMask() {
    const l = this.activeLayer;
    if (!l || !l.mask) return;
    l.mask        = null;
    l.maskCtx     = null;
    l.maskEnabled = false;
    this.app.composite();
    this.renderLayersPanel();
    this._updateMaskPanel();
  }

  /**
   * Toggle the mask on/off without deleting it.
   */
  toggleMask() {
    const l = this.activeLayer;
    if (!l || !l.mask) return;
    l.maskEnabled = !l.maskEnabled;
    this.app.composite();
    this.renderLayersPanel();
    this._updateMaskPanel();
  }

  /**
   * Apply mask permanently: bake mask into pixel alpha and remove mask.
   */
  applyMask() {
    const l = this.activeLayer;
    if (!l || !l.mask) return;

    const { canvasWidth: w, canvasHeight: h } = this.app;
    const flatC   = createOffscreenCanvas(w, h);
    const flatCtx = flatC.getContext('2d');
    flatCtx.drawImage(l.canvas, 0, 0);
    flatCtx.globalCompositeOperation = 'destination-in';
    flatCtx.drawImage(l.mask, 0, 0);
    flatCtx.globalCompositeOperation = 'source-over';

    l.ctx.clearRect(0, 0, w, h);
    l.ctx.drawImage(flatC, 0, 0);
    l.mask        = null;
    l.maskCtx     = null;
    l.maskEnabled = false;

    this.app.composite();
    this.renderLayersPanel();
    this._updateMaskPanel();
  }

  /** Update mask panel button states */
  _updateMaskPanel() {
    const l    = this.activeLayer;
    const has  = !!(l && l.mask);
    $('mask-add-btn').disabled    = has;
    $('mask-del-btn').disabled    = !has;
    $('mask-toggle-btn').disabled = !has;
    $('mask-apply-btn').disabled  = !has;
    $('mask-toggle-btn').textContent = (l && l.maskEnabled) ? 'Disable' : 'Enable';
  }

  // ── RESIZING ──────────────────────────────────────────────────────────

  resizeAll(nw, nh, anchor) {
    this.layers = this.layers.map(l => {
      const c   = createOffscreenCanvas(nw, nh);
      const ctx = c.getContext('2d');
      let dx = 0, dy = 0;
      if (anchor === 'center') {
        dx = Math.round((nw - l.canvas.width)  / 2);
        dy = Math.round((nh - l.canvas.height) / 2);
      }
      ctx.drawImage(l.canvas, dx, dy);

      // Resize mask too if present
      let mc = null, mctx = null;
      if (l.mask) {
        mc   = createOffscreenCanvas(nw, nh);
        mctx = mc.getContext('2d');
        // Fill with white then draw old mask — new areas default to white (visible)
        mctx.fillStyle = '#ffffff';
        mctx.fillRect(0, 0, nw, nh);
        mctx.drawImage(l.mask, dx, dy);
      }

      return { ...l, canvas: c, ctx, mask: mc, maskCtx: mctx };
    });
  }

  // ── UI RENDERING ──────────────────────────────────────────────────────

  renderLayersPanel() {
    this.listEl.innerHTML = '';

    [...this.layers].reverse().forEach((layer, revIdx) => {
      const realIdx = this.layers.length - 1 - revIdx;
      const li = document.createElement('li');
      li.className = 'layer-item' + (realIdx === this.activeIndex ? ' active' : '');
      li.draggable = true;
      li.dataset.idx = realIdx;

      // ── Visibility toggle ──
      const vis = document.createElement('span');
      vis.className = 'layer-visibility' + (layer.visible ? '' : ' hidden');
      vis.textContent = '👁';
      vis.title = layer.visible ? 'Hide layer' : 'Show layer';
      vis.addEventListener('click', e => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        vis.classList.toggle('hidden', !layer.visible);
        vis.title = layer.visible ? 'Hide layer' : 'Show layer';
        this.app.composite();
      });

      // ── Layer thumbnail ──
      const thumb = document.createElement('div');
      thumb.className = 'layer-thumb';
      const tc   = document.createElement('canvas');
      tc.width   = 36; tc.height = 28;
      const tctx = tc.getContext('2d');
      // Checkerboard for transparency
      const cbSize = 4;
      for (let ty = 0; ty < 28; ty += cbSize) {
        for (let tx = 0; tx < 36; tx += cbSize) {
          tctx.fillStyle = ((tx / cbSize + ty / cbSize) % 2 === 0) ? '#ccc' : '#fff';
          tctx.fillRect(tx, ty, cbSize, cbSize);
        }
      }
      tctx.drawImage(layer.canvas, 0, 0, 36, 28);
      thumb.appendChild(tc);

      const thumbsWrapper = document.createElement('div');
      thumbsWrapper.className = 'layer-thumbs-wrapper';
      thumbsWrapper.appendChild(thumb);

      // ── Mask thumbnail (shown if mask exists) ──
      if (layer.mask) {
        const maskSep = document.createElement('span');
        maskSep.className = 'mask-chain';
        maskSep.textContent = '⛓';
        maskSep.title = layer.maskEnabled ? 'Mask active' : 'Mask disabled';
        maskSep.style.opacity = layer.maskEnabled ? '1' : '0.4';

        const maskThumb = document.createElement('div');
        maskThumb.className = 'layer-thumb mask-thumb';
        const mtc   = document.createElement('canvas');
        mtc.width   = 24; mtc.height = 24;
        const mtctx = mtc.getContext('2d');
        mtctx.drawImage(layer.mask, 0, 0, 24, 24);
        maskThumb.appendChild(mtc);
        maskThumb.title = 'Layer mask — click to toggle';
        maskThumb.addEventListener('click', e => {
          e.stopPropagation();
          this.toggleMask();
        });

        thumbsWrapper.appendChild(maskSep);
        thumbsWrapper.appendChild(maskThumb);
      }

      // ── Layer name ──
      const info    = document.createElement('div');
      info.className = 'layer-info';
      const nameEl  = document.createElement('div');
      nameEl.className = 'layer-name';
      nameEl.textContent = layer.name;

      nameEl.addEventListener('dblclick', e => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.className = 'layer-name-input';
        input.value = layer.name;
        info.replaceChild(input, nameEl);
        input.focus(); input.select();

        const done = () => {
          layer.name = input.value.trim() || layer.name;
          nameEl.textContent = layer.name;
          info.replaceChild(nameEl, input);
          if (realIdx === this.activeIndex) {
            $('active-layer-display').textContent = layer.name;
          }
        };
        input.addEventListener('blur', done);
        input.addEventListener('keydown', e2 => {
          if (e2.key === 'Enter')  input.blur();
          if (e2.key === 'Escape') { input.value = layer.name; input.blur(); }
        });
      });

      info.appendChild(nameEl);

      li.addEventListener('click', () => this.setActive(realIdx));

      li.addEventListener('dragstart', e => {
        this.dragSrcIndex = realIdx;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => { li.style.opacity = '0.45'; }, 0);
      });
      li.addEventListener('dragend',  () => { li.style.opacity = '1'; });
      li.addEventListener('dragover', e => {
        e.preventDefault();
        li.classList.add('drag-over');
      });
      li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
      li.addEventListener('drop', e => {
        e.preventDefault();
        li.classList.remove('drag-over');
        if (this.dragSrcIndex !== null && this.dragSrcIndex !== realIdx) {
          this.app.history.snapshot('Reorder Layer');
          this.moveLayer(this.dragSrcIndex, realIdx);
        }
        this.dragSrcIndex = null;
      });

      li.append(vis, thumbsWrapper, info);
      this.listEl.appendChild(li);
    });

    this._syncPanelControls();
  }

  _syncPanelControls() {
    const l = this.activeLayer;
    if (!l) return;
    $('layer-blend-mode').value         = l.blendMode;
    $('layer-opacity').value            = Math.round(l.opacity * 100);
    $('layer-opacity-val').textContent  = Math.round(l.opacity * 100) + '%';
    $('active-layer-display').textContent = l.name;
    this._updateMaskPanel();
  }
}
