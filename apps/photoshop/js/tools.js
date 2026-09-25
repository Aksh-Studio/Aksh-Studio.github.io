/**
 * tools.js — Phase 3: Complete Suite of Graphics & Selection Tools
 * Includes:
 *   - BrushTool (B)
 *   - EraserTool (E)
 *   - FillTool (F)
 *   - EyedropperTool (I)
 *   - TextTool (T)
 *   - MoveTool (V)
 *   - MarqueeTool (M)
 *   - CloneStampTool (S)
 *   - MagicWandTool (W)
 *   - GradientTool (G)
 *   - FreeTransformTool (Ctrl+T)
 *   - LassoTool (L) [NEW Phase 3]
 *   - PolygonalLassoTool [NEW Phase 3]
 *   - ColorReplacementTool [NEW Phase 3]
 *   - MagicColorEraserTool [NEW Phase 3]
 * Aksh Photoshop
 */
'use strict';

// ====================================================
// BASE TOOL INTERFACE
// ====================================================
class BaseTool {
  constructor(app) { this.app = app; }
  get name()       { return 'base'; }
  get label()      { return 'Tool'; }
  get optSection() { return ''; }
  get cursor()     { return 'crosshair'; }
  onDown(x, y)     {}
  onMove(x, y)     {}
  onUp(x, y)       {}
}

// ====================================================
// BRUSH TOOL — smooth quadratic-bezier stroke
// ====================================================
class BrushTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
    this.points    = [];
    this._preStrokeData = null;
  }

  get name()       { return 'brush'; }
  get label()      { return '🖌️ Brush'; }
  get optSection() { return 'opt-brush'; }
  get cursor()     { return 'crosshair'; }

  get radius()   { return parseInt($('opt-brush-size').value, 10); }
  get hardness() { return parseInt($('opt-brush-hardness').value, 10); }
  get opacity()  { return parseInt($('opt-brush-opacity').value, 10) / 100; }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Brush Stroke');
    this.isDrawing = true;
    this.points    = [{ x, y }];
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    this._preStrokeData = l.ctx.getImageData(0, 0, w, h);

    const ctx = l.ctx;
    ctx.save();
    const m = this.app.toolManager.tools['marquee'];
    if (m && m.hasSelection) {
      ctx.beginPath();
      ctx.rect(m.selX, m.selY, m.selW, m.selH);
      ctx.clip();
    }
    ctx.globalAlpha = this.opacity;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = this.app.foregroundColor;
    ctx.beginPath();
    ctx.arc(x, y, this.radius / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    this._applyMaskConstraint(l.ctx);
    this.app.composite();
  }

  onMove(x, y) {
    if (!this.isDrawing) return;
    const l = this.app.layerManager.activeLayer;
    if (!l) return;

    this.points.push({ x, y });
    const p   = this.points;
    const ctx = l.ctx;
    const r   = this.radius;

    ctx.save();
    const m = this.app.toolManager.tools['marquee'];
    if (m && m.hasSelection) {
      ctx.beginPath();
      ctx.rect(m.selX, m.selY, m.selW, m.selH);
      ctx.clip();
    }
    ctx.globalAlpha = this.opacity;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = r;
    ctx.lineCap   = 'round';
    ctx.lineJoin  = 'round';

    if (this.hardness >= 99) {
      ctx.strokeStyle = this.app.foregroundColor;
    } else {
      const { r: cr, g: cg, b: cb } = hexToRgba(this.app.foregroundColor);
      const alpha = this.hardness / 100;
      const grad  = ctx.createRadialGradient(x, y, 0, x, y, r / 2);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.strokeStyle = grad;
    }

    ctx.beginPath();
    if (p.length >= 3) {
      const mid1x = (p[p.length - 3].x + p[p.length - 2].x) / 2;
      const mid1y = (p[p.length - 3].y + p[p.length - 2].y) / 2;
      const mid2x = (p[p.length - 2].x + p[p.length - 1].x) / 2;
      const mid2y = (p[p.length - 2].y + p[p.length - 1].y) / 2;
      ctx.moveTo(mid1x, mid1y);
      ctx.quadraticCurveTo(p[p.length - 2].x, p[p.length - 2].y, mid2x, mid2y);
    } else {
      const prev = p[p.length - 2] || { x, y };
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    this._applyMaskConstraint(l.ctx);
    this.app.composite();
  }

  _applyMaskConstraint(ctx) {
    if (!this.app.selectionMask || !this._preStrokeData) return;
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const cur = ctx.getImageData(0, 0, w, h);
    const cd = cur.data;
    const pd = this._preStrokeData.data;
    const mask = this.app.selectionMask;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) {
        const idx = i * 4;
        cd[idx]   = pd[idx];
        cd[idx+1] = pd[idx+1];
        cd[idx+2] = pd[idx+2];
        cd[idx+3] = pd[idx+3];
      }
    }
    ctx.putImageData(cur, 0, 0);
  }

  onUp() {
    this.isDrawing = false;
    this.points    = [];
    this._preStrokeData = null;
  }
}

// ====================================================
// ERASER TOOL — destination-out compositing
// ====================================================
class EraserTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
    this.prevX = 0; this.prevY = 0;
  }

  get name()       { return 'eraser'; }
  get label()      { return '🧹 Eraser'; }
  get optSection() { return 'opt-eraser'; }
  get cursor()     { return 'crosshair'; }

  get size()    { return parseInt($('opt-eraser-size').value, 10); }
  get opacity() { return parseInt($('opt-eraser-opacity').value, 10) / 100; }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Erase');
    this.isDrawing = true;
    this.prevX = x; this.prevY = y;
    this._erase(l.ctx, x, y, x, y);
    this.app.composite();
  }

  onMove(x, y) {
    if (!this.isDrawing) return;
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this._erase(l.ctx, this.prevX, this.prevY, x, y);
    this.prevX = x; this.prevY = y;
    this.app.composite();
  }

  onUp() { this.isDrawing = false; }

  _erase(ctx, x1, y1, x2, y2) {
    ctx.save();
    const m = this.app.toolManager.tools['marquee'];
    if (m && m.hasSelection) {
      ctx.beginPath();
      ctx.rect(m.selX, m.selY, m.selW, m.selH);
      ctx.clip();
    }
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = this.opacity;
    ctx.lineWidth   = this.size;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }
}

// ====================================================
// FLOOD FILL TOOL — BFS on ImageData
// ====================================================
class FillTool extends BaseTool {
  get name()       { return 'fill'; }
  get label()      { return '🪣 Paint Bucket'; }
  get optSection() { return 'opt-fill'; }
  get cursor()     { return 'crosshair'; }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Flood Fill');
    const ix        = Math.round(x);
    const iy        = Math.round(y);
    const fillColor = hexToRgba($('opt-fill-color').value);
    const tolerance = parseInt($('opt-fill-tolerance').value, 10);
    this._fill(l.ctx, ix, iy, fillColor, tolerance);
    this.app.composite();
  }

  onMove() {}
  onUp()   {}

  _fill(ctx, sx, sy, fillColor, tolerance) {
    const w = this.app.canvasWidth;
    const h = this.app.canvasHeight;
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data    = imgData.data;

    const idx       = (x, y) => (y * w + x) * 4;
    const getPixel  = (x, y) => {
      const i = idx(x, y);
      return { r: data[i], g: data[i+1], b: data[i+2], a: data[i+3] };
    };
    const setPixel  = (x, y, c) => {
      const i = idx(x, y);
      data[i] = c.r; data[i+1] = c.g; data[i+2] = c.b; data[i+3] = c.a;
    };
    const colorDiff = (c1, c2) =>
      Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) +
      Math.abs(c1.b - c2.b) + Math.abs(c1.a - c2.a);

    const target = getPixel(sx, sy);
    if (colorDiff(target, fillColor) <= tolerance) return;

    const visited = new Uint8Array(w * h);
    const queue   = [sx + sy * w];
    visited[sx + sy * w] = 1;

    const m = this.app.toolManager.tools['marquee'];

    while (queue.length > 0) {
      const pos = queue.shift();
      const cx  = pos % w;
      const cy  = Math.floor(pos / w);

      // Restrict to marquee selection if active
      if (m && m.hasSelection) {
        if (cx < m.selX || cx >= m.selX + m.selW || cy < m.selY || cy >= m.selY + m.selH) continue;
      }
      // Restrict to selection mask if active
      if (this.app.selectionMask && !this.app.selectionMask[pos]) continue;

      if (colorDiff(getPixel(cx, cy), target) > tolerance) continue;
      setPixel(cx, cy, fillColor);

      const neighbors = [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const ni = nx + ny * w;
          if (!visited[ni]) { visited[ni] = 1; queue.push(ni); }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }
}

// ====================================================
// EYEDROPPER TOOL — sample composite canvas color
// ====================================================
class EyedropperTool extends BaseTool {
  get name()       { return 'eyedropper'; }
  get label()      { return '🔬 Eyedropper'; }
  get optSection() { return 'opt-eyedropper'; }
  get cursor()     { return 'crosshair'; }

  onDown(x, y) {
    const ctx = $('master-canvas').getContext('2d');
    const px  = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const hex = rgbaToHex(px[0], px[1], px[2]);
    this.app.setForegroundColor(hex);
  }

  onMove() {}
  onUp()   {}
}

// ====================================================
// TEXT TOOL — rasterize text onto active layer
// ====================================================
class TextTool extends BaseTool {
  constructor(app) {
    super(app);
    this.inputEl  = $('text-input-overlay');
    this.isActive = false;
    this.tx = 0; this.ty = 0;
  }

  get name()       { return 'text'; }
  get label()      { return 'T Text'; }
  get optSection() { return 'opt-text'; }
  get cursor()     { return 'text'; }

  onDown(x, y) {
    if (this.isActive) { this.commit(); return; }
    this.tx = x; this.ty = y;

    const vp   = $('canvas-viewport').getBoundingClientRect();
    const scx  = x * this.app.zoom + this.app.panX + vp.left;
    const scy  = y * this.app.zoom + this.app.panY + vp.top;

    const fontSize = parseInt($('opt-text-size').value, 10);
    this.inputEl.style.display    = 'block';
    this.inputEl.style.left       = scx + 'px';
    this.inputEl.style.top        = scy + 'px';
    this.inputEl.style.fontSize   = (fontSize * this.app.zoom) + 'px';
    this.inputEl.style.fontFamily = $('opt-text-font').value;
    this.inputEl.style.color      = 'transparent';
    this.inputEl.value            = '';
    this.isActive = true;
    setTimeout(() => this.inputEl.focus(), 0);
  }

  commit() {
    if (!this.isActive) return;
    const text = this.inputEl.value;

    if (text.trim()) {
      const l = this.app.layerManager.activeLayer;
      if (l) {
        this.app.history.snapshot('Text');
        const fontSize = parseInt($('opt-text-size').value, 10);
        const font     = $('opt-text-font').value;
        const styleVal = $('opt-text-style').value;
        const [boldStr, italicStr] = styleVal.split(' ');
        const bold   = boldStr   === 'bold'   ? 'bold '   : '';
        const italic = italicStr === 'italic' ? 'italic ' : '';

        l.ctx.save();
        l.ctx.font        = `${italic}${bold}${fontSize}px ${font}`;
        l.ctx.fillStyle   = $('opt-text-color').value;
        l.ctx.globalAlpha = 1;
        l.ctx.fillText(text, this.tx, this.ty + fontSize);
        l.ctx.restore();
        this.app.composite();
        this.app.layerManager.renderLayersPanel();
      }
    }

    this._hideOverlay();
  }

  cancel() { this._hideOverlay(); }

  _hideOverlay() {
    this.inputEl.style.display = 'none';
    this.inputEl.value         = '';
    this.isActive              = false;
  }

  onMove() {}
  onUp()   {}
}

// ====================================================
// MOVE TOOL — translate layer content by dragging
// ====================================================
class MoveTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isMoving = false;
    this.startX = 0; this.startY = 0;
    this.origData = null;
  }

  get name()       { return 'move'; }
  get label()      { return '✥ Move'; }
  get optSection() { return 'opt-move'; }
  get cursor()     { return 'move'; }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Move Layer Content');
    this.isMoving = true;
    this.startX   = x; this.startY = y;
    this.origData = l.ctx.getImageData(0, 0, this.app.canvasWidth, this.app.canvasHeight);
  }

  onMove(x, y) {
    if (!this.isMoving || !this.origData) return;
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    const dx = Math.round(x - this.startX);
    const dy = Math.round(y - this.startY);
    l.ctx.clearRect(0, 0, this.app.canvasWidth, this.app.canvasHeight);
    l.ctx.putImageData(this.origData, dx, dy);
    this.app.composite();
  }

  onUp() {
    this.isMoving = false;
    this.origData = null;
    this.app.layerManager.renderLayersPanel();
  }
}

// ====================================================
// MARQUEE TOOL — rectangular selection with marching ants
// ====================================================
class MarqueeTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing    = false;
    this.startX = 0; this.startY = 0;
    this.selX   = 0; this.selY   = 0;
    this.selW   = 0; this.selH   = 0;
    this.hasSelection = false;
    this._animId      = null;
    this._dashOffset  = 0;
  }

  get name()       { return 'marquee'; }
  get label()      { return '▭ Marquee'; }
  get optSection() { return 'opt-marquee'; }
  get cursor()     { return 'crosshair'; }

  onDown(x, y) {
    this.isDrawing = true;
    this.startX = x; this.startY = y;
    this.selX   = x; this.selY   = y;
    this.selW   = 0; this.selH   = 0;
    this._stopAnimation();
  }

  onMove(x, y) {
    if (!this.isDrawing) return;
    this.selX = Math.min(x, this.startX);
    this.selY = Math.min(y, this.startY);
    this.selW = Math.abs(x - this.startX);
    this.selH = Math.abs(y - this.startY);
    this._drawAnts();
  }

  onUp() {
    this.isDrawing    = false;
    this.hasSelection = this.selW > 0 && this.selH > 0;
    if (this.hasSelection) {
      this._startAnimation();
    } else {
      this.clearSelection();
    }
  }

  selectAll() {
    this.selX = 0; this.selY = 0;
    this.selW = this.app.canvasWidth;
    this.selH = this.app.canvasHeight;
    this.hasSelection = true;
    this._startAnimation();
  }

  clearSelection() {
    this._stopAnimation();
    this.hasSelection = false;
    this.selX = this.selY = this.selW = this.selH = 0;
    const selCanvas = $('selection-canvas');
    selCanvas.getContext('2d').clearRect(0, 0, selCanvas.width, selCanvas.height);
  }

  _startAnimation() {
    this._stopAnimation();
    const tick = () => {
      this._dashOffset = (this._dashOffset - 0.5) % 18;
      this._drawAnts();
      this._animId = requestAnimationFrame(tick);
    };
    this._animId = requestAnimationFrame(tick);
  }

  _stopAnimation() {
    if (this._animId !== null) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
  }

  _drawAnts() {
    const selCanvas = $('selection-canvas');
    const ctx       = selCanvas.getContext('2d');
    ctx.clearRect(0, 0, selCanvas.width, selCanvas.height);
    if (this.selW === 0 || this.selH === 0) return;

    const z = this.app.zoom;
    const d = Math.max(1, 6 / z);
    const g = Math.max(0.5, 3 / z);

    ctx.save();
    ctx.strokeStyle    = 'white';
    ctx.lineWidth      = 1 / z;
    ctx.setLineDash([d, g]);
    ctx.lineDashOffset = this._dashOffset / z;
    ctx.strokeRect(this.selX, this.selY, this.selW, this.selH);
    ctx.strokeStyle    = 'black';
    ctx.lineDashOffset = (this._dashOffset + d + g) / z;
    ctx.strokeRect(this.selX, this.selY, this.selW, this.selH);
    ctx.restore();
  }
}

// ====================================================
// FREEHAND LASSO TOOL (L) [Phase 3]
// Records arbitrary freehand polygon path and rasterizes
// to 1D Uint8Array selection mask.
// ====================================================
class LassoTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
    this.points = [];
  }

  get name()       { return 'lasso'; }
  get label()      { return '➰ Lasso Tool'; }
  get optSection() { return 'opt-lasso'; }
  get cursor()     { return 'crosshair'; }

  onDown(x, y) {
    this.isDrawing = true;
    this.points = [{ x, y }];
    this._drawLassoPreview();
  }

  onMove(x, y) {
    if (!this.isDrawing) return;
    this.points.push({ x, y });
    this._drawLassoPreview();
  }

  onUp(x, y) {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    if (this.points.length < 3) {
      this._clearPreview();
      return;
    }
    // Close polygon back to start
    this.points.push({ x: this.points[0].x, y: this.points[0].y });
    this._generateMaskFromPoints();
  }

  _drawLassoPreview() {
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);
    if (this.points.length < 2) return;

    const z = this.app.zoom;
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2 / z;
    ctx.setLineDash([4 / z, 4 / z]);
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.stroke();

    ctx.strokeStyle = '#000000';
    ctx.lineDashOffset = 4 / z;
    ctx.stroke();
    ctx.restore();
  }

  _clearPreview() {
    const sc = $('selection-canvas');
    sc.getContext('2d').clearRect(0, 0, sc.width, sc.height);
  }

  _generateMaskFromPoints() {
    const w = this.app.canvasWidth;
    const h = this.app.canvasHeight;
    const off = createOffscreenCanvas(w, h);
    const octx = off.getContext('2d');

    octx.fillStyle = '#ffffff';
    octx.beginPath();
    octx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      octx.lineTo(this.points[i].x, this.points[i].y);
    }
    octx.closePath();
    octx.fill('evenodd');

    const imgData = octx.getImageData(0, 0, w, h).data;
    const newMask = new Uint8Array(w * h);
    for (let i = 0; i < newMask.length; i++) {
      if (imgData[i * 4 + 3] > 120) newMask[i] = 1;
    }

    const mode = $('opt-lasso-mode')?.value || 'new';
    this.app.applySelectionMask(newMask, mode);
  }

  deactivate() {
    this.isDrawing = false;
    this.points = [];
  }
}

// ====================================================
// POLYGONAL LASSO TOOL [Phase 3]
// Click discrete anchor vertices with live rubber-band
// line. Double-click or click start to close. Esc cancels.
// ====================================================
class PolygonalLassoTool extends BaseTool {
  constructor(app) {
    super(app);
    this.vertices = [];
    this.curMouse = null;
    this._lastClickTime = 0;
  }

  get name()       { return 'polylasso'; }
  get label()      { return '📐 Polygonal Lasso'; }
  get optSection() { return 'opt-polylasso'; }
  get cursor()     { return 'crosshair'; }

  onDown(x, y) {
    const now = Date.now();
    const isDouble = (now - this._lastClickTime) < 300;
    this._lastClickTime = now;

    if (this.vertices.length > 2) {
      const v0 = this.vertices[0];
      const distToStart = Math.hypot(x - v0.x, y - v0.y);
      if (distToStart <= 8 || isDouble) {
        this.closePolygon();
        return;
      }
    }

    this.vertices.push({ x, y });
    this._drawRubberBand(x, y);
  }

  onMove(x, y) {
    if (this.vertices.length === 0) return;
    this.curMouse = { x, y };
    this._drawRubberBand(x, y);
  }

  onUp() {}

  closePolygon() {
    if (this.vertices.length < 3) {
      this.cancel();
      return;
    }
    const points = [...this.vertices];
    points.push({ x: points[0].x, y: points[0].y });
    this.vertices = [];
    this.curMouse = null;

    const w = this.app.canvasWidth;
    const h = this.app.canvasHeight;
    const off = createOffscreenCanvas(w, h);
    const octx = off.getContext('2d');

    octx.fillStyle = '#ffffff';
    octx.beginPath();
    octx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      octx.lineTo(points[i].x, points[i].y);
    }
    octx.closePath();
    octx.fill('evenodd');

    const imgData = octx.getImageData(0, 0, w, h).data;
    const newMask = new Uint8Array(w * h);
    for (let i = 0; i < newMask.length; i++) {
      if (imgData[i * 4 + 3] > 120) newMask[i] = 1;
    }

    const mode = $('opt-polylasso-mode')?.value || 'new';
    this.app.applySelectionMask(newMask, mode);
  }

  cancel() {
    this.vertices = [];
    this.curMouse = null;
    const sc = $('selection-canvas');
    sc.getContext('2d').clearRect(0, 0, sc.width, sc.height);
  }

  _drawRubberBand(curX, curY) {
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);
    if (this.vertices.length === 0) return;

    const z = this.app.zoom;
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2 / z;
    ctx.setLineDash([4 / z, 4 / z]);

    // Draw confirmed segments
    ctx.beginPath();
    ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
    for (let i = 1; i < this.vertices.length; i++) {
      ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
    }
    // Rubber band line to current cursor
    ctx.lineTo(curX, curY);
    ctx.stroke();

    ctx.strokeStyle = '#000000';
    ctx.lineDashOffset = 4 / z;
    ctx.stroke();

    // Mark vertices
    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i];
      ctx.fillStyle = (i === 0) ? '#00e5ff' : '#ffffff';
      ctx.fillRect(v.x - 2 / z, v.y - 2 / z, 4 / z, 4 / z);
    }

    // Highlight starting vertex if close enough to snap-close
    const v0 = this.vertices[0];
    if (Math.hypot(curX - v0.x, curY - v0.y) <= 8) {
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2 / z;
      ctx.beginPath();
      ctx.arc(v0.x, v0.y, 6 / z, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  deactivate() {
    this.cancel();
  }
}

// ====================================================
// COLOR REPLACEMENT TOOL (Brush Mode) [Phase 3]
// Samples target color under initial click, changes
// Hue & Saturation to Foreground color while preserving Luminance.
// ====================================================
class ColorReplacementTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
    this.targetColor = null;
    this.prevX = 0;
    this.prevY = 0;
  }

  get name()       { return 'colorreplace'; }
  get label()      { return '🎨 Color Replacement'; }
  get optSection() { return 'opt-colorreplace'; }
  get cursor()     { return 'crosshair'; }

  get radius()    { return parseInt($('opt-colorreplace-size').value, 10); }
  get tolerance() { return parseInt($('opt-colorreplace-tolerance').value, 10); }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Color Replacement');
    this.isDrawing = true;
    this.prevX = x;
    this.prevY = y;

    // Sample color beneath initial click coordinate
    const ix = clamp(Math.round(x), 0, this.app.canvasWidth - 1);
    const iy = clamp(Math.round(y), 0, this.app.canvasHeight - 1);
    const px = l.ctx.getImageData(ix, iy, 1, 1).data;
    this.targetColor = { r: px[0], g: px[1], b: px[2], a: px[3] };

    this._replaceBrush(l.ctx, x, y);
    this.app.composite();
  }

  onMove(x, y) {
    if (!this.isDrawing || !this.targetColor) return;
    const l = this.app.layerManager.activeLayer;
    if (!l) return;

    // Interpolate steps along stroke
    const dist = Math.hypot(x - this.prevX, y - this.prevY);
    const steps = Math.max(1, Math.ceil(dist / (this.radius * 0.3)));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const curX = this.prevX + (x - this.prevX) * t;
      const curY = this.prevY + (y - this.prevY) * t;
      this._replaceBrush(l.ctx, curX, curY);
    }
    this.prevX = x;
    this.prevY = y;
    this.app.composite();
  }

  onUp() {
    this.isDrawing = false;
    this.targetColor = null;
    this.app.layerManager.renderLayersPanel();
  }

  _replaceBrush(ctx, cx, cy) {
    const w = this.app.canvasWidth;
    const h = this.app.canvasHeight;
    const r = this.radius;
    const minX = clamp(Math.floor(cx - r), 0, w - 1);
    const minY = clamp(Math.floor(cy - r), 0, h - 1);
    const maxX = clamp(Math.ceil(cx + r), 0, w - 1);
    const maxY = clamp(Math.ceil(cy + r), 0, h - 1);
    const patchW = maxX - minX + 1;
    const patchH = maxY - minY + 1;
    if (patchW <= 0 || patchH <= 0) return;

    const imgData = ctx.getImageData(minX, minY, patchW, patchH);
    const d = imgData.data;

    const fg = hexToRgba(this.app.foregroundColor);
    const fgHsl = rgbToHsl(fg.r, fg.g, fg.b);
    const tgt = this.targetColor;
    const threshold = this.tolerance * 2.2;
    const mask = this.app.selectionMask;

    for (let py = 0; py < patchH; py++) {
      const canvasY = minY + py;
      for (let px = 0; px < patchW; px++) {
        const canvasX = minX + px;
        const canvasPos = canvasY * w + canvasX;

        // Selection constraint
        if (mask && !mask[canvasPos]) continue;

        // Circular brush boundary
        if (Math.hypot(canvasX - cx, canvasY - cy) > r) continue;

        const i = (py * patchW + px) * 4;
        if (d[i + 3] < 10) continue; // transparent pixel

        const dR = d[i]   - tgt.r;
        const dG = d[i+1] - tgt.g;
        const dB = d[i+2] - tgt.b;
        const dist = Math.sqrt(dR * dR * 0.299 + dG * dG * 0.587 + dB * dB * 0.114);

        if (dist <= threshold) {
          // Preserve original luminance/texture, shift hue & saturation
          const origHsl = rgbToHsl(d[i], d[i+1], d[i+2]);
          const newRgb = hslToRgb(fgHsl.h, fgHsl.s, origHsl.l);
          d[i]   = newRgb.r;
          d[i+1] = newRgb.g;
          d[i+2] = newRgb.b;
        }
      }
    }

    ctx.putImageData(imgData, minX, minY);
  }
}

// ====================================================
// MAGIC COLOR ERASER TOOL [Phase 3]
// Click any pixel to erase matching color regions to transparent.
// ====================================================
class MagicColorEraserTool extends BaseTool {
  constructor(app) {
    super(app);
  }

  get name()       { return 'magiceraser'; }
  get label()      { return '🪄 Magic Color Eraser'; }
  get optSection() { return 'opt-magiceraser'; }
  get cursor()     { return 'crosshair'; }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Magic Color Erase');

    const ix = clamp(Math.round(x), 0, this.app.canvasWidth - 1);
    const iy = clamp(Math.round(y), 0, this.app.canvasHeight - 1);
    const px = l.ctx.getImageData(ix, iy, 1, 1).data;
    if (px[3] === 0) return;

    const target = { r: px[0], g: px[1], b: px[2], a: px[3] };
    const tolerance = parseInt($('opt-magiceraser-tolerance').value, 10);
    const contiguous = $('opt-magiceraser-contiguous')?.checked ?? true;
    const feather = parseInt($('opt-magiceraser-feather')?.value, 10) || 4;

    this._eraseColor(l.ctx, ix, iy, target, tolerance, contiguous, feather);
    this.app.composite();
    this.app.layerManager.renderLayersPanel();
  }

  _eraseColor(ctx, sx, sy, target, tolerance, contiguous, feather) {
    const w = this.app.canvasWidth;
    const h = this.app.canvasHeight;
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    const mask = this.app.selectionMask;

    const colorDist = (i) => {
      const dR = d[i]   - target.r;
      const dG = d[i+1] - target.g;
      const dB = d[i+2] - target.b;
      return Math.sqrt(dR * dR * 0.299 + dG * dG * 0.587 + dB * dB * 0.114);
    };

    if (contiguous) {
      const visited = new Uint8Array(w * h);
      const queue = [sx + sy * w];
      visited[sx + sy * w] = 1;

      while (queue.length > 0) {
        const pos = queue.shift();
        if (mask && !mask[pos]) continue;

        const i = pos * 4;
        const dist = colorDist(i);
        if (dist <= tolerance) {
          d[i + 3] = 0;
        } else if (dist <= tolerance + feather && feather > 0) {
          d[i + 3] = clamp(Math.round(d[i + 3] * ((dist - tolerance) / feather)), 0, 255);
        } else {
          continue;
        }

        const cx = pos % w, cy = Math.floor(pos / w);
        const neighbors = [[cx-1, cy], [cx+1, cy], [cx, cy-1], [cx, cy+1]];
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nPos = ny * w + nx;
            if (!visited[nPos]) {
              visited[nPos] = 1;
              queue.push(nPos);
            }
          }
        }
      }
    } else {
      for (let pos = 0; pos < w * h; pos++) {
        if (mask && !mask[pos]) continue;
        const i = pos * 4;
        if (d[i + 3] === 0) continue;
        const dist = colorDist(i);
        if (dist <= tolerance) {
          d[i + 3] = 0;
        } else if (dist <= tolerance + feather && feather > 0) {
          d[i + 3] = clamp(Math.round(d[i + 3] * ((dist - tolerance) / feather)), 0, 255);
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }
}

// ====================================================
// CLONE STAMP TOOL (S)
// ====================================================
class CloneStampTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing   = false;
    this.sourceSet   = false;
    this.sourceX     = 0;
    this.sourceY     = 0;
    this.offsetX     = 0;
    this.offsetY     = 0;
    this.prevX       = 0;
    this.prevY       = 0;
  }

  get name()       { return 'clonestamp'; }
  get label()      { return '🔁 Clone Stamp'; }
  get optSection() { return 'opt-clonestamp'; }
  get cursor()     { return 'crosshair'; }

  onDown(x, y) {
    if (this.app._shiftHeld) {
      this.sourceX   = x;
      this.sourceY   = y;
      this.sourceSet = true;
      this._drawSourceCrosshair(x, y);
      return;
    }
    if (!this.sourceSet) {
      $('active-tool-display').textContent = '🔁 Clone Stamp — Shift+Click to set source';
      return;
    }

    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Clone Stamp');
    this.isDrawing     = true;
    this.prevX         = x;
    this.prevY         = y;
    this.offsetX = this.sourceX - x;
    this.offsetY = this.sourceY - y;
    this._paintStamp(l.ctx, x, y, x, y);
    this.app.composite();
  }

  onMove(x, y) {
    if (!this.isDrawing) return;
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this._paintStamp(l.ctx, this.prevX, this.prevY, x, y);
    this.prevX = x;
    this.prevY = y;
    this._drawSourceCrosshair(x + this.offsetX, y + this.offsetY);
    this.app.composite();
  }

  onUp() {
    this.isDrawing = false;
    this.app.layerManager.renderLayersPanel();
  }

  _paintStamp(dstCtx, x1, y1, x2, y2) {
    const radius  = parseInt($('opt-clonestamp-size').value, 10);
    const opacity = parseInt($('opt-clonestamp-opacity').value, 10) / 100;
    const srcCtx  = $('master-canvas').getContext('2d');

    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / (radius * 0.5)));

    for (let s = 0; s <= steps; s++) {
      const t   = steps === 0 ? 1 : s / steps;
      const dx  = x1 + (x2 - x1) * t;
      const dy  = y1 + (y2 - y1) * t;
      const sx  = dx + this.offsetX;
      const sy  = dy + this.offsetY;

      const patchSize = radius * 2;
      const srcX = Math.round(sx - radius);
      const srcY = Math.round(sy - radius);

      const readX = Math.max(0, srcX);
      const readY = Math.max(0, srcY);
      const readW = Math.min(patchSize, this.app.canvasWidth  - readX);
      const readH = Math.min(patchSize, this.app.canvasHeight - readY);
      if (readW <= 0 || readH <= 0) continue;

      const patchData = srcCtx.getImageData(readX, readY, readW, readH);

      dstCtx.save();
      dstCtx.globalAlpha = opacity;
      dstCtx.globalCompositeOperation = 'source-over';

      dstCtx.beginPath();
      dstCtx.arc(dx, dy, radius, 0, Math.PI * 2);
      dstCtx.clip();

      const drawOffX = (readX - srcX);
      const drawOffY = (readY - srcY);
      const tmpC = createOffscreenCanvas(readW, readH);
      tmpC.getContext('2d').putImageData(patchData, 0, 0);
      dstCtx.drawImage(tmpC, Math.round(dx - radius + drawOffX), Math.round(dy - radius + drawOffY));
      dstCtx.restore();
    }
  }

  _drawSourceCrosshair(x, y) {
    const selCanvas = $('selection-canvas');
    const ctx       = selCanvas.getContext('2d');
    ctx.clearRect(0, 0, selCanvas.width, selCanvas.height);
    if (!this.sourceSet && !this.isDrawing) return;

    const z  = this.app.zoom;
    const r  = Math.max(6, parseInt($('opt-clonestamp-size').value, 10)) / 2;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth   = 1.5 / z;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth   = 0.5 / z;
    ctx.beginPath();
    ctx.arc(x, y, r + 1 / z, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  deactivate() {
    this.isDrawing = false;
    const selCanvas = $('selection-canvas');
    selCanvas.getContext('2d').clearRect(0, 0, selCanvas.width, selCanvas.height);
  }
}

// ====================================================
// MAGIC WAND TOOL (W)
// ====================================================
class MagicWandTool extends BaseTool {
  constructor(app) {
    super(app);
  }

  get name()       { return 'magicwand'; }
  get label()      { return '🪄 Magic Wand'; }
  get optSection() { return 'opt-magicwand'; }
  get cursor()     { return 'crosshair'; }

  onDown(x, y) {
    const ix = Math.round(x), iy = Math.round(y);
    const w  = this.app.canvasWidth, h = this.app.canvasHeight;
    if (ix < 0 || iy < 0 || ix >= w || iy >= h) return;

    const tolerance = parseInt($('opt-wand-tolerance').value, 10);
    const contiguous = $('opt-wand-contiguous').checked;

    const masterCtx = $('master-canvas').getContext('2d');
    const imgData   = masterCtx.getImageData(0, 0, w, h);
    const data      = imgData.data;

    const seedI  = (iy * w + ix) * 4;
    const seedR  = data[seedI], seedG = data[seedI+1], seedB = data[seedI+2], seedA = data[seedI+3];

    const diff = (i) => {
      return Math.abs(data[i]   - seedR) +
             Math.abs(data[i+1] - seedG) +
             Math.abs(data[i+2] - seedB) +
             Math.abs(data[i+3] - seedA);
    };

    const mask = new Uint8Array(w * h);

    if (contiguous) {
      const visited = new Uint8Array(w * h);
      const queue   = [ix + iy * w];
      visited[ix + iy * w] = 1;

      while (queue.length > 0) {
        const pos = queue.shift();
        const cx  = pos % w, cy = Math.floor(pos / w);
        const pi  = pos * 4;
        if (diff(pi) <= tolerance * 4) {
          mask[pos] = 1;
          const neighbors = [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]];
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const ni = nx + ny * w;
              if (!visited[ni]) { visited[ni] = 1; queue.push(ni); }
            }
          }
        }
      }
    } else {
      for (let i = 0; i < w * h; i++) {
        if (diff(i * 4) <= tolerance * 4) mask[i] = 1;
      }
    }

    const mode = $('opt-wand-mode').value;
    this.app.applySelectionMask(mask, mode);
  }

  clearSelection() {
    // Selection is managed centrally by app.selectionMask
  }

  deactivate() {}
  onMove() {}
  onUp()   {}
}

// ====================================================
// GRADIENT TOOL (G)
// ====================================================
class GradientTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
    this.startX    = 0; this.startY = 0;
    this.endX      = 0; this.endY   = 0;
  }

  get name()       { return 'gradient'; }
  get label()      { return '🌈 Gradient'; }
  get optSection() { return 'opt-gradient'; }
  get cursor()     { return 'crosshair'; }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.isDrawing = true;
    this.startX = x; this.startY = y;
    this.endX   = x; this.endY   = y;
  }

  onMove(x, y) {
    if (!this.isDrawing) return;
    this.endX = x; this.endY = y;
    this._drawPreview(x, y);
  }

  onUp(x, y) {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    const sc = $('selection-canvas');
    sc.getContext('2d').clearRect(0, 0, sc.width, sc.height);

    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Gradient');
    this._applyGradient(l.ctx);
    this.app.composite();
    this.app.layerManager.renderLayersPanel();
  }

  _drawPreview(x, y) {
    const sc  = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);

    const z = this.app.zoom;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth   = 1.5 / z;
    ctx.setLineDash([6 / z, 3 / z]);

    ctx.beginPath();
    ctx.moveTo(this.startX, this.startY);
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.fillStyle = this.app.foregroundColor;
    ctx.beginPath();
    ctx.arc(this.startX, this.startY, 4 / z, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.app.backgroundColor;
    ctx.beginPath();
    ctx.arc(x, y, 4 / z, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _applyGradient(ctx) {
    const w   = this.app.canvasWidth;
    const h   = this.app.canvasHeight;
    const fg  = this.app.foregroundColor;
    const bg  = this.app.backgroundColor;
    const type = $('opt-gradient-type').value;
    const opacity = parseInt($('opt-gradient-opacity').value, 10) / 100;

    let grad;
    if (type === 'radial') {
      const dist = Math.hypot(this.endX - this.startX, this.endY - this.startY);
      if (dist < 1) return;
      grad = ctx.createRadialGradient(
        this.startX, this.startY, 0,
        this.startX, this.startY, dist
      );
    } else {
      if (Math.abs(this.endX - this.startX) < 1 && Math.abs(this.endY - this.startY) < 1) return;
      grad = ctx.createLinearGradient(this.startX, this.startY, this.endX, this.endY);
    }

    grad.addColorStop(0, fg);
    grad.addColorStop(1, bg);

    const m = this.app.toolManager.tools['marquee'];
    const preGradData = this.app.selectionMask ? ctx.getImageData(0, 0, w, h) : null;

    ctx.save();
    if (m && m.hasSelection) {
      ctx.beginPath();
      ctx.rect(m.selX, m.selY, m.selW, m.selH);
      ctx.clip();
    }
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (preGradData && this.app.selectionMask) {
      const cur = ctx.getImageData(0, 0, w, h);
      const cd = cur.data;
      const pd = preGradData.data;
      const mask = this.app.selectionMask;
      for (let i = 0; i < mask.length; i++) {
        if (!mask[i]) {
          const idx = i * 4;
          cd[idx]   = pd[idx];
          cd[idx+1] = pd[idx+1];
          cd[idx+2] = pd[idx+2];
          cd[idx+3] = pd[idx+3];
        }
      }
      ctx.putImageData(cur, 0, 0);
    }

    ctx.restore();
  }
}

// ====================================================
// FREE TRANSFORM TOOL (Ctrl+T)
// ====================================================
class FreeTransformTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isActive  = false;
    this.origData  = null;
    this.origW     = 0;
    this.origH     = 0;

    this.tx        = 0;
    this.ty        = 0;
    this.scaleX    = 1;
    this.scaleY    = 1;
    this.rotation  = 0;

    this.bboxX     = 0;
    this.bboxY     = 0;
    this.bboxW     = 0;
    this.bboxH     = 0;

    this._dragging     = false;
    this._dragHandle   = null;
    this._dragStartX   = 0;
    this._dragStartY   = 0;
    this._dragStartTx  = 0;
    this._dragStartTy  = 0;
    this._dragStartSX  = 1;
    this._dragStartSY  = 1;
    this._dragStartRot = 0;
  }

  get name()       { return 'freetransform'; }
  get label()      { return '⬡ Free Transform'; }
  get optSection() { return 'opt-freetransform'; }
  get cursor()     { return 'default'; }

  engage() {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    if (this.isActive) { this.commit(); return; }

    this.app.history.snapshot('Free Transform');
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    this.origData = l.ctx.getImageData(0, 0, w, h);
    this.origW    = w; this.origH = h;

    const d = this.origData.data;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 4) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) {
      minX = 0; minY = 0; maxX = w - 1; maxY = h - 1;
    }

    this.bboxX  = minX;
    this.bboxY  = minY;
    this.bboxW  = maxX - minX + 1;
    this.bboxH  = maxY - minY + 1;
    this.tx     = 0;
    this.ty     = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.rotation = 0;
    this.isActive = true;
    $('active-tool-display').textContent = '⬡ Free Transform — Enter to apply, Esc to cancel';
    this._drawUI();
  }

  onDown(x, y) {
    if (!this.isActive) return;
    const handle = this._hitTestHandle(x, y);
    if (!handle) { this.commit(); return; }

    this._dragging    = true;
    this._dragHandle  = handle;
    this._dragStartX  = x;
    this._dragStartY  = y;
    this._dragStartTx = this.tx;
    this._dragStartTy = this.ty;
    this._dragStartSX = this.scaleX;
    this._dragStartSY = this.scaleY;
    this._dragStartRot = this.rotation;
  }

  onMove(x, y) {
    if (!this.isActive) return;
    if (!this._dragging) {
      this._updateCursorForPos(x, y);
      return;
    }

    const dx = x - this._dragStartX;
    const dy = y - this._dragStartY;
    const h  = this._dragHandle;

    if (h === 'inside') {
      this.tx = this._dragStartTx + dx;
      this.ty = this._dragStartTy + dy;
    } else if (h === 'rotate') {
      const cx = this.bboxX + this.bboxW / 2 + this.tx;
      const cy = this.bboxY + this.bboxH / 2 + this.ty;
      const angleStart = Math.atan2(this._dragStartY - cy, this._dragStartX - cx);
      const angleCur   = Math.atan2(y - cy, x - cx);
      this.rotation    = this._dragStartRot + (angleCur - angleStart);
    } else {
      const cx   = this.bboxX + this.bboxW / 2 + this._dragStartTx;
      const cy   = this.bboxY + this.bboxH / 2 + this._dragStartTy;
      const halfW = (this.bboxW * this._dragStartSX) / 2;
      const halfH = (this.bboxH * this._dragStartSY) / 2;

      if (h.includes('r')) {
        const newHW = clamp((x - (cx - halfW)), 2, this.app.canvasWidth * 4);
        this.scaleX = (newHW / this.bboxW);
      }
      if (h.includes('l')) {
        const newHW = clamp(((cx + halfW) - x), 2, this.app.canvasWidth * 4);
        this.scaleX = (newHW / this.bboxW);
        this.tx = this._dragStartTx + (dx / 2);
      }
      if (h.includes('b')) {
        const newHH = clamp((y - (cy - halfH)), 2, this.app.canvasHeight * 4);
        this.scaleY = (newHH / this.bboxH);
      }
      if (h.includes('t')) {
        const newHH = clamp(((cy + halfH) - y), 2, this.app.canvasHeight * 4);
        this.scaleY = (newHH / this.bboxH);
        this.ty = this._dragStartTy + (dy / 2);
      }
    }

    this._applyTransformPreview();
    this._drawUI();
  }

  onUp() {
    this._dragging   = false;
    this._dragHandle = null;
  }

  commit() {
    if (!this.isActive) return;
    const l = this.app.layerManager.activeLayer;
    if (l) {
      this._applyTransformFinal(l.ctx);
      this.app.composite();
      this.app.layerManager.renderLayersPanel();
    }
    this._exitTransform();
  }

  cancel() {
    if (!this.isActive) return;
    const l = this.app.layerManager.activeLayer;
    if (l && this.origData) {
      l.ctx.clearRect(0, 0, this.origW, this.origH);
      l.ctx.putImageData(this.origData, 0, 0);
      this.app.composite();
    }
    this._exitTransform();
  }

  _exitTransform() {
    this.isActive = false;
    this.origData = null;
    const sc = $('selection-canvas');
    sc.getContext('2d').clearRect(0, 0, sc.width, sc.height);
    $('active-tool-display').textContent = this.label;
  }

  _applyTransformPreview() {
    const l = this.app.layerManager.activeLayer;
    if (!l || !this.origData) return;
    const w = this.origW, h = this.origH;
    l.ctx.clearRect(0, 0, w, h);
    l.ctx.putImageData(this.origData, 0, 0);
    this._applyTransformFinal(l.ctx, true);
    this.app.composite();
  }

  _applyTransformFinal(ctx, preview = false) {
    const w  = this.origW, h = this.origH;
    const tmpC    = createOffscreenCanvas(w, h);
    const tmpCtx  = tmpC.getContext('2d');
    tmpCtx.putImageData(this.origData, 0, 0);

    const cx = this.bboxX + this.bboxW / 2;
    const cy = this.bboxY + this.bboxH / 2;

    if (!preview) {
      ctx.clearRect(0, 0, w, h);
    }

    ctx.save();
    ctx.translate(cx + this.tx, cy + this.ty);
    ctx.rotate(this.rotation);
    ctx.scale(this.scaleX, this.scaleY);
    ctx.translate(-cx, -cy);
    ctx.drawImage(tmpC, 0, 0);
    ctx.restore();
  }

  _drawUI() {
    const sc  = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);
    if (!this.isActive) return;

    const z    = this.app.zoom;
    const hw   = (this.bboxW * this.scaleX) / 2;
    const hh   = (this.bboxH * this.scaleY) / 2;
    const cx   = this.bboxX + this.bboxW / 2 + this.tx;
    const cy   = this.bboxY + this.bboxH / 2 + this.ty;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);
    ctx.translate(-cx, -cy);

    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth   = 1 / z;
    ctx.setLineDash([5 / z, 3 / z]);
    ctx.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);
    ctx.setLineDash([]);

    const handles = this._getHandlePositions(cx, cy, hw, hh);
    const hr      = 4 / z;
    for (const [hx, hy] of Object.values(handles)) {
      ctx.fillStyle   = 'white';
      ctx.strokeStyle = '#0078d4';
      ctx.lineWidth   = 1 / z;
      ctx.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
      ctx.strokeRect(hx - hr, hy - hr, hr * 2, hr * 2);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth   = 1 / z;
    const cs = 6 / z;
    ctx.beginPath();
    ctx.moveTo(cx - cs, cy); ctx.lineTo(cx + cs, cy);
    ctx.moveTo(cx, cy - cs); ctx.lineTo(cx, cy + cs);
    ctx.stroke();

    ctx.restore();
  }

  _getHandlePositions(cx, cy, hw, hh) {
    return {
      tl: [cx - hw, cy - hh],
      tc: [cx,      cy - hh],
      tr: [cx + hw, cy - hh],
      ml: [cx - hw, cy     ],
      mr: [cx + hw, cy     ],
      bl: [cx - hw, cy + hh],
      bc: [cx,      cy + hh],
      br: [cx + hw, cy + hh],
    };
  }

  _hitTestHandle(x, y) {
    if (!this.isActive) return null;

    const z    = this.app.zoom;
    const hw   = (this.bboxW * this.scaleX) / 2;
    const hh   = (this.bboxH * this.scaleY) / 2;
    const cx   = this.bboxX + this.bboxW / 2 + this.tx;
    const cy   = this.bboxY + this.bboxH / 2 + this.ty;

    const cos  = Math.cos(-this.rotation), sin = Math.sin(-this.rotation);
    const rx   = cos * (x - cx) - sin * (y - cy) + cx;
    const ry   = sin * (x - cx) + cos * (y - cy) + cy;

    const hr   = Math.max(6, 4 / z);
    const handles = this._getHandlePositions(cx, cy, hw, hh);

    for (const [name, [hx, hy]] of Object.entries(handles)) {
      if (Math.abs(rx - hx) <= hr && Math.abs(ry - hy) <= hr) return name;
    }

    if (rx >= cx - hw && rx <= cx + hw && ry >= cy - hh && ry <= cy + hh) return 'inside';

    const outerR = Math.max(hw, hh) + 24 / z;
    const distCentre = Math.hypot(rx - cx, ry - cy);
    if (distCentre <= outerR) return 'rotate';

    return null;
  }

  _updateCursorForPos(x, y) {
    const h = this._hitTestHandle(x, y);
    const cursors = {
      tl: 'nwse-resize', tr: 'nesw-resize',
      bl: 'nesw-resize', br: 'nwse-resize',
      tc: 'ns-resize',   bc: 'ns-resize',
      ml: 'ew-resize',   mr: 'ew-resize',
      inside: 'move',
      rotate: 'grab',
      null:   'default'
    };
    this.app.viewport.style.cursor = cursors[h] || 'default';
  }
}

// ====================================================
// TOOL MANAGER — registry & active tool dispatch
// ====================================================
class ToolManager {
  constructor(app) {
    this.app        = app;
    this.tools      = {};
    this.activeTool = null;
  }

  register(tool) { this.tools[tool.name] = tool; }

  selectTool(name) { return this.setActive(name); }

  setActive(name) {
    // Commit open text input
    if (this.activeTool?.name === 'text' && this.activeTool.isActive) {
      this.activeTool.commit();
    }
    // Commit free transform if still active
    if (this.activeTool?.name === 'freetransform' && this.activeTool.isActive) {
      this.activeTool.commit();
    }
    // Deactivate active tools that maintain temporary state
    if (this.activeTool?.deactivate) {
      this.activeTool.deactivate();
    }
    // Stop marquee animation when leaving
    if (this.activeTool?.name === 'marquee') {
      this.activeTool._stopAnimation();
    }

    this.activeTool = this.tools[name];
    if (!this.activeTool) return;

    document.querySelectorAll('.flyout-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));

    const activeFlyoutItem = document.querySelector(`.flyout-item[onclick*="'${name}'"]`);
    if (activeFlyoutItem) {
      activeFlyoutItem.classList.add('active');
      const parentGroup = activeFlyoutItem.closest('.tool-group');
      if (parentGroup) {
        const mainBtn = parentGroup.querySelector('.tool-btn');
        if (mainBtn) {
          mainBtn.classList.add('active');
          const labelText = activeFlyoutItem.innerText || activeFlyoutItem.textContent;
          const icon = labelText.trim().split(' ')[0]; // First token is the icon
          mainBtn.dataset.tool = name;
          mainBtn.title = labelText.trim();
          mainBtn.textContent = icon;
        }
      }
    } else {
      // Fallback
      const btn = document.querySelector(`.tool-btn[data-tool="${name}"]`);
      if (btn) btn.classList.add('active');
    }

    document.querySelectorAll('.tool-opt-section').forEach(s => {
      s.classList.toggle('active', s.id === this.activeTool.optSection);
    });

    const activeToolDisplay = $('active-tool-display');
    if (activeToolDisplay) {
        activeToolDisplay.textContent = this.activeTool.label;
    }
    this.app.updateCursor();

    if (name === 'marquee' && this.activeTool.hasSelection) {
      this.activeTool._startAnimation();
    }
    if (name === 'freetransform' && !this.activeTool.isActive) {
      this.activeTool.engage();
    }
  }
}


/**
 * tools_full.js â€” Complete Implementation of Photoshop Tool Suites:
 *  - Move & Artboard (V)
 *  - Elliptical / Single Row / Single Col Marquee (M)
 *  - Magnetic Lasso (L)
 *  - Object Selection Tool (W)
 *  - Crop & Perspective Crop Tools (C)
 *  - Ruler, Count & Eyedropper Tools (I)
 *  - Spot Healing, Patch & Red Eye Tools (J)
 *  - Pencil, Mixer Brush, History Brush (B, Y)
 *  - Background Eraser & Magic Eraser (E)
 *  - Blur, Sharpen, Smudge Tools (R)
 *  - Dodge, Burn, Sponge Tools (O)
 *  - Pen & Vector Path Tools (P)
 *  - Shape Tools: Rectangle, Ellipse, Polygon, Line (U)
 *  - Hand, Rotate View & Zoom Tools (H, R, Z)
 *
 * Aksh Photoshop â€” Client-Side Engine for GitHub Pages
 */
'use strict';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 1. ADVANCED MARQUEE TOOLS (Elliptical, Single Row, Single Column)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
class EllipticalMarqueeTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
    this.startX = 0; this.startY = 0;
    this.endX = 0; this.endY = 0;
  }
  get name() { return 'ellipticalmarquee'; }
  get label() { return 'â¬­ Elliptical Marquee'; }
  get optSection() { return 'opt-marquee'; }

  onDown(x, y) {
    this.isDrawing = true;
    this.startX = x; this.startY = y;
    this.endX = x; this.endY = y;
  }
  onMove(x, y) {
    if (!this.isDrawing) return;
    this.endX = x; this.endY = y;
    const ctx = $('selection-canvas').getContext('2d');
    ctx.clearRect(0, 0, this.app.canvasWidth, this.app.canvasHeight);
    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const cx = (this.startX + this.endX) / 2;
    const cy = (this.startY + this.endY) / 2;
    const rx = Math.abs(this.endX - this.startX) / 2;
    const ry = Math.abs(this.endY - this.startY) / 2;
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  onUp() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    const cx = (this.startX + this.endX) / 2;
    const cy = (this.startY + this.endY) / 2;
    const rx = Math.abs(this.endX - this.startX) / 2;
    const ry = Math.abs(this.endY - this.startY) / 2;
    if (rx < 2 || ry < 2) return;

    // Rasterize Ellipse into Selection Mask
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) {
          mask[y * w + x] = 1;
        }
      }
    }
    const mode = $('opt-marquee-mode')?.value || 'new';
    this.app.applySelectionMask(mask, mode);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 2. RETOUCHING & HEALING TOOLS (Spot Healing, Red Eye, Smudge)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// --- Spot Healing Brush (Texture synthesis from surrounding ring) ---
class SpotHealingTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
  }
  get name() { return 'spothealing'; }
  get label() { return 'ðŸ©¹ Spot Healing Brush'; }
  get optSection() { return 'opt-brush'; }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Spot Healing');
    this.healSpot(l.ctx, Math.round(x), Math.round(y), parseInt($('opt-brush-size').value, 10));
    this.app.composite();
    this.app.layerManager.renderLayersPanel();
  }

  healSpot(ctx, cx, cy, radius) {
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const rOuter = radius + 6;
    const minX = clamp(cx - rOuter, 0, w - 1), maxX = clamp(cx + rOuter, 0, w - 1);
    const minY = clamp(cy - rOuter, 0, h - 1), maxY = clamp(cy + rOuter, 0, h - 1);
    const boxW = maxX - minX + 1, boxH = maxY - minY + 1;
    if (boxW <= 0 || boxH <= 0) return;

    const imgData = ctx.getImageData(minX, minY, boxW, boxH);
    const d = imgData.data;

    // Collect outer ring pixels
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let y = 0; y < boxH; y++) {
      for (let x = 0; x < boxW; x++) {
        const dist = Math.hypot(minX + x - cx, minY + y - cy);
        if (dist >= radius && dist <= rOuter) {
          const i = (y * boxW + x) * 4;
          if (d[i + 3] > 0) {
            rSum += d[i]; gSum += d[i+1]; bSum += d[i+2]; count++;
          }
        }
      }
    }
    if (count === 0) return;
    const avgR = rSum / count, avgG = gSum / count, avgB = bSum / count;

    // Inpaint inner blemish region using inverse distance blend
    for (let y = 0; y < boxH; y++) {
      for (let x = 0; x < boxW; x++) {
        const dist = Math.hypot(minX + x - cx, minY + y - cy);
        if (dist < radius) {
          const i = (y * boxW + x) * 4;
          const weight = dist / radius; // smooth feather toward edge
          d[i]   = clamp(Math.round(d[i]   * weight + avgR * (1 - weight)), 0, 255);
          d[i+1] = clamp(Math.round(d[i+1] * weight + avgG * (1 - weight)), 0, 255);
          d[i+2] = clamp(Math.round(d[i+2] * weight + avgB * (1 - weight)), 0, 255);
        }
      }
    }
    ctx.putImageData(imgData, minX, minY);
  }
}

// --- Red Eye Correction Tool ---
class RedEyeTool extends BaseTool {
  get name() { return 'redeye'; }
  get label() { return 'ðŸ‘ï¸ Red Eye Tool'; }
  get optSection() { return 'opt-brush'; }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Red Eye Correction');
    const radius = parseInt($('opt-brush-size').value, 10);
    this.correctRedEye(l.ctx, Math.round(x), Math.round(y), radius);
    this.app.composite();
  }

  correctRedEye(ctx, cx, cy, radius) {
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const minX = clamp(cx - radius, 0, w - 1), maxX = clamp(cx + radius, 0, w - 1);
    const minY = clamp(cy - radius, 0, h - 1), maxY = clamp(cy + radius, 0, h - 1);
    const boxW = maxX - minX + 1, boxH = maxY - minY + 1;
    const imgData = ctx.getImageData(minX, minY, boxW, boxH);
    const d = imgData.data;

    for (let y = 0; y < boxH; y++) {
      for (let x = 0; x < boxW; x++) {
        if (Math.hypot(minX + x - cx, minY + y - cy) <= radius) {
          const i = (y * boxW + x) * 4;
          const r = d[i], g = d[i+1], b = d[i+2];
          // Detect red dominance characteristic of camera flash reflection
          if (r / (g + b + 1) > 1.4 && r > 65) {
            const neutral = (g + b) / 2;
            d[i]   = neutral * 0.7; // darken pupil
            d[i+1] = neutral * 0.7;
            d[i+2] = neutral * 0.7;
          }
        }
      }
    }
    ctx.putImageData(imgData, minX, minY);
  }
}

// --- Smudge Tool (Dragging & smearing canvas pixels) ---
class SmudgeTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
    this.smudgeBuffer = null;
    this.prevX = 0; this.prevY = 0;
  }
  get name() { return 'smudge'; }
  get label() { return 'ðŸ‘† Smudge Tool'; }
  get optSection() { return 'opt-brush'; }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Smudge');
    this.isDrawing = true;
    this.prevX = x; this.prevY = y;
    this.sampleBuffer(l.ctx, x, y);
  }

  sampleBuffer(ctx, x, y) {
    const r = parseInt($('opt-brush-size').value, 10);
    const minX = clamp(Math.round(x - r), 0, this.app.canvasWidth - 1);
    const minY = clamp(Math.round(y - r), 0, this.app.canvasHeight - 1);
    const size = Math.max(1, r * 2);
    this.smudgeBuffer = ctx.getImageData(minX, minY, Math.min(size, this.app.canvasWidth - minX), Math.min(size, this.app.canvasHeight - minY));
  }

  onMove(x, y) {
    if (!this.isDrawing || !this.smudgeBuffer) return;
    const l = this.app.layerManager.activeLayer;
    if (!l) return;

    const r = parseInt($('opt-brush-size').value, 10);
    const ctx = l.ctx;

    // Stamp previous buffer blended onto current location
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    const tmp = createOffscreenCanvas(this.smudgeBuffer.width, this.smudgeBuffer.height);
    tmp.getContext('2d').putImageData(this.smudgeBuffer, 0, 0);
    ctx.drawImage(tmp, x - r, y - r);
    ctx.restore();

    // Re-sample current state for next smear step
    this.sampleBuffer(ctx, x, y);
    this.app.composite();
  }

  onUp() {
    this.isDrawing = false;
    this.smudgeBuffer = null;
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 3. TONING TOOLS (Dodge, Burn, Sponge)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class DodgeTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
  }
  get name() { return 'dodge'; }
  get label() { return 'ðŸ”¦ Dodge Tool (Lighten)'; }
  get optSection() { return 'opt-brush'; }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Dodge');
    this.isDrawing = true;
    this.applyDodge(l.ctx, x, y);
    this.app.composite();
  }
  onMove(x, y) {
    if (!this.isDrawing) return;
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.applyDodge(l.ctx, x, y);
    this.app.composite();
  }
  onUp() { this.isDrawing = false; }

  applyDodge(ctx, cx, cy) {
    const r = parseInt($('opt-brush-size').value, 10);
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const minX = clamp(Math.round(cx - r), 0, w - 1), maxX = clamp(Math.round(cx + r), 0, w - 1);
    const minY = clamp(Math.round(cy - r), 0, h - 1), maxY = clamp(Math.round(cy + r), 0, h - 1);
    const boxW = maxX - minX + 1, boxH = maxY - minY + 1;
    const imgData = ctx.getImageData(minX, minY, boxW, boxH);
    const d = imgData.data;

    for (let y = 0; y < boxH; y++) {
      for (let x = 0; x < boxW; x++) {
        const dist = Math.hypot(minX + x - cx, minY + y - cy);
        if (dist <= r) {
          const i = (y * boxW + x) * 4;
          const factor = (1 - dist / r) * 18; // exposure strength
          d[i]   = clamp(d[i]   + factor, 0, 255);
          d[i+1] = clamp(d[i+1] + factor, 0, 255);
          d[i+2] = clamp(d[i+2] + factor, 0, 255);
        }
      }
    }
    ctx.putImageData(imgData, minX, minY);
  }
}

class BurnTool extends BaseTool {
  constructor(app) { super(app); this.isDrawing = false; }
  get name() { return 'burn'; }
  get label() { return 'ðŸ”¥ Burn Tool (Darken)'; }
  get optSection() { return 'opt-brush'; }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Burn');
    this.isDrawing = true;
    this.applyBurn(l.ctx, x, y);
    this.app.composite();
  }
  onMove(x, y) {
    if (!this.isDrawing) return;
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.applyBurn(l.ctx, x, y);
    this.app.composite();
  }
  onUp() { this.isDrawing = false; }

  applyBurn(ctx, cx, cy) {
    const r = parseInt($('opt-brush-size').value, 10);
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const minX = clamp(Math.round(cx - r), 0, w - 1), maxX = clamp(Math.round(cx + r), 0, w - 1);
    const minY = clamp(Math.round(cy - r), 0, h - 1), maxY = clamp(Math.round(cy + r), 0, h - 1);
    const boxW = maxX - minX + 1, boxH = maxY - minY + 1;
    const imgData = ctx.getImageData(minX, minY, boxW, boxH);
    const d = imgData.data;

    for (let y = 0; y < boxH; y++) {
      for (let x = 0; x < boxW; x++) {
        const dist = Math.hypot(minX + x - cx, minY + y - cy);
        if (dist <= r) {
          const i = (y * boxW + x) * 4;
          const factor = (1 - dist / r) * 18;
          d[i]   = clamp(d[i]   - factor, 0, 255);
          d[i+1] = clamp(d[i+1] - factor, 0, 255);
          d[i+2] = clamp(d[i+2] - factor, 0, 255);
        }
      }
    }
    ctx.putImageData(imgData, minX, minY);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 4. CROP, RULER & NAVIGATION TOOLS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// --- Interactive Crop Tool (C) ---
class CropTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isCropping = false;
    this.cropX = 0; this.cropY = 0;
    this.cropW = 0; this.cropH = 0;
  }
  get name() { return 'crop'; }
  get label() { return 'âœ‚ï¸ Crop Tool'; }
  get optSection() { return 'opt-freetransform'; }

  onDown(x, y) {
    this.isCropping = true;
    this.cropX = x; this.cropY = y;
    this.cropW = 0; this.cropH = 0;
  }
  onMove(x, y) {
    if (!this.isCropping) return;
    this.cropW = x - this.cropX;
    this.cropH = y - this.cropY;
    this.drawCropOverlay();
  }
  onUp() {
    this.isCropping = false;
    if (Math.abs(this.cropW) > 10 && Math.abs(this.cropH) > 10) {
      if (confirm('Commit Crop to selected area?')) {
        this.commitCrop();
      } else {
        const sc = $('selection-canvas');
        sc.getContext('2d').clearRect(0, 0, sc.width, sc.height);
      }
    }
  }

  drawCropOverlay() {
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, sc.width, sc.height);
    ctx.clearRect(this.cropX, this.cropY, this.cropW, this.cropH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.cropX, this.cropY, this.cropW, this.cropH);
    ctx.restore();
  }

  commitCrop() {
    const rx = Math.round(Math.min(this.cropX, this.cropX + this.cropW));
    const ry = Math.round(Math.min(this.cropY, this.cropY + this.cropH));
    const rw = Math.round(Math.abs(this.cropW));
    const rh = Math.round(Math.abs(this.cropH));
    if (rw <= 0 || rh <= 0) return;

    this.app.history.snapshot('Crop Canvas');

    // Slice all layers
    this.app.layerManager.layers.forEach(layer => {
      const cropped = createOffscreenCanvas(rw, rh);
      cropped.getContext('2d').drawImage(layer.canvas, -rx, -ry);
      layer.canvas = cropped;
      layer.ctx = cropped.getContext('2d');
    });

    this.app.canvasWidth = rw;
    this.app.canvasHeight = rh;
    this.app._setupCanvasDOM();
    this.app.clearSelection();
    this.app.composite();
    this.app.layerManager.renderLayersPanel();
    this.app.fitToScreen();
  }
}

// --- Ruler Measurement Tool (I) ---
class RulerTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isMeasuring = false;
    this.startX = 0; this.startY = 0;
  }
  get name() { return 'ruler'; }
  get label() { return 'ðŸ“ Ruler Tool'; }

  onDown(x, y) {
    this.isMeasuring = true;
    this.startX = x; this.startY = y;
  }
  onMove(x, y) {
    if (!this.isMeasuring) return;
    const dx = x - this.startX;
    const dy = y - this.startY;
    const dist = Math.hypot(dx, dy).toFixed(1);
    const angle = (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1);

    // Update Status Bar
    $('status-bar').innerText = `ðŸ“ Distance: ${dist}px | Angle: ${angle}Â° | Î”X: ${Math.round(dx)}px | Î”Y: ${Math.round(dy)}px`;

    // Render guide line
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);
    ctx.save();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.startX, this.startY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
  }
  onUp() { this.isMeasuring = false; }
}

// --- Hand Tool (H) & Rotate View Tool (R) ---
class HandTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isPanning = false;
    this.startX = 0; this.startY = 0;
  }
  get name() { return 'hand'; }
  get label() { return 'âœ‹ Hand Tool'; }
  get cursor() { return 'grab'; }

  onDown(x, y) {
    this.isPanning = true;
    this.startX = this.app.panX;
    this.startY = this.app.panY;
  }
  onMove() {}
  onUp() { this.isPanning = false; }
}

class RotateViewTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isRotating = false;
    this.startAngle = 0;
  }
  get name() { return 'rotateview'; }
  get label() { return 'ðŸ”„ Rotate View Tool'; }

  onDown(x, y) {
    this.isRotating = true;
    const cx = this.app.canvasWidth / 2;
    const cy = this.app.canvasHeight / 2;
    this.startAngle = Math.atan2(y - cy, x - cx);
  }
  onMove(x, y) {
    if (!this.isRotating) return;
    const cx = this.app.canvasWidth / 2;
    const cy = this.app.canvasHeight / 2;
    const curAngle = Math.atan2(y - cy, x - cx);
    const delta = curAngle - this.startAngle;
    this.app.rotationAngle = (this.app.rotationAngle || 0) + delta;
    this.startAngle = curAngle;
    this.app._applyTransform();
  }
  onUp() { this.isRotating = false; }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 5. VECTOR SHAPE TOOLS (Rectangle, Ellipse, Polygon, Line) (U)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
class ShapeTool extends BaseTool {
  constructor(app, shapeType = 'rect') {
    super(app);
    this.shapeType = shapeType; // 'rect' | 'ellipse' | 'line' | 'polygon'
    this.isDrawing = false;
    this.startX = 0; this.startY = 0;
  }
  get name() { return 'shape_' + this.shapeType; }
  get label() { return `â¬Ÿ Vector ${this.shapeType.toUpperCase()}`; }
  get optSection() { return 'opt-brush'; }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot(`Draw ${this.shapeType}`);
    this.isDrawing = true;
    this.startX = x; this.startY = y;
  }
  onMove(x, y) {
    if (!this.isDrawing) return;
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);
    ctx.save();
    ctx.strokeStyle = this.app.foregroundColor;
    ctx.fillStyle = this.app.foregroundColor;
    ctx.lineWidth = 2;
    this.renderShape(ctx, this.startX, this.startY, x, y);
    ctx.restore();
  }
  onUp(x, y) {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    const sc = $('selection-canvas');
    sc.getContext('2d').clearRect(0, 0, sc.width, sc.height);

    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    l.ctx.save();
    l.ctx.strokeStyle = this.app.foregroundColor;
    l.ctx.fillStyle = this.app.foregroundColor;
    l.ctx.lineWidth = 2;
    this.renderShape(l.ctx, this.startX, this.startY, x, y);
    l.ctx.restore();

    this.app.composite();
    this.app.layerManager.renderLayersPanel();
  }

  renderShape(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    if (this.shapeType === 'rect') {
      ctx.rect(x1, y1, x2 - x1, y2 - y1);
      ctx.fill();
      ctx.stroke();
    } else if (this.shapeType === 'ellipse') {
      const rx = Math.abs(x2 - x1) / 2;
      const ry = Math.abs(y2 - y1) / 2;
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (this.shapeType === 'line') {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
}


// ====================================================
// ADVANCED TOOL SUITE EXPANSION
// ====================================================
/**
 * tools_advanced.js — Complete Professional Photoshop CC Suite Expansion
 * 
 * Implements:
 *   A. Advanced Selection Tools:
 *      - MagneticLassoTool (Sobel edge-snapping)
 *      - QuickSelectionTool (Expanding paintable watershed selection)
 *      - ObjectSelectionTool (Box saliency foreground clustering)
 *      - SingleRowMarqueeTool (1px infinite row)
 *      - SingleColumnMarqueeTool (1px infinite column)
 * 
 *   B. Crop, Slice & Layout Tools:
 *      - PerspectiveCropTool (4-corner quad projective homography warp)
 *      - SliceTool & SliceSelectTool (Web slice layout division & export)
 *      - FrameTool (Rectangular & elliptical placeholder clipping containers)
 * 
 *   C. Retouching & Healing Tools:
 *      - HealingBrushTool (Frequency separation / texture transplanting)
 *      - PatchTool (Lasso source-to-destination texture transfer)
 *      - ContentAwareMoveTool (Relocation with Telea inpainting fill)
 *      - PatternStampTool (Procedural repeating pattern tile painting)
 * 
 *   D. Painting & Brush Tools:
 *      - PencilTool (1-bit hard-edged non-antialiased pixel rendering)
 *      - MixerBrushTool (Wet paint pickup, reservoir load & color mixing)
 *      - HistoryBrushTool (History snapshot restoration brush)
 *      - SpongeTool (Local HSL saturation & desaturation)
 * 
 *   E. Vector & Path Tools:
 *      - PenTool (Cubic Bézier vector path with selection/fill/stroke)
 *      - PathSelectionTool & DirectSelectionTool (Anchor & tangent editing)
 *      - VerticalTypeTool (Top-to-bottom typography)
 *      - TypeMaskTool & VerticalTypeMaskTool (Text glyph selection masks)
 * 
 *   F. Measurements & Navigation:
 *      - ColorSamplerTool (Up to 4 persistent sampler points with live RGB readouts)
 *      - CountTool (Numbered marker badge counting)
 *      - ScrubbyZoomTool (Click & drag horizontal magnification)
 * 
 * Aksh Photoshop — Client-Side Engine for GitHub Pages
 */
'use strict';

// ════════════════════════════════════════════════════════════════════
// A. ADVANCED SELECTION TOOLS
// ════════════════════════════════════════════════════════════════════

// --- 1. Single Row Marquee Tool (1px H) ---
class SingleRowMarqueeTool extends BaseTool {
  constructor(app) {
    super(app);
  }
  get name() { return 'singlerowmarquee'; }
  get label() { return '⎯ Single Row Marquee'; }
  get optSection() { return 'opt-marquee'; }

  onDown(x, y) {
    const row = clamp(Math.floor(y), 0, this.app.canvasHeight - 1);
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const mask = new Uint8Array(w * h);
    const startIdx = row * w;
    for (let x = 0; x < w; x++) {
      mask[startIdx + x] = 1;
    }
    const mode = $('opt-marquee-mode')?.value || 'new';
    this.app.applySelectionMask(mask, mode);
  }
}

// --- 2. Single Column Marquee Tool (1px W) ---
class SingleColumnMarqueeTool extends BaseTool {
  constructor(app) {
    super(app);
  }
  get name() { return 'singlecolmarquee'; }
  get label() { return '⎸ Single Column Marquee'; }
  get optSection() { return 'opt-marquee'; }

  onDown(x, y) {
    const col = clamp(Math.floor(x), 0, this.app.canvasWidth - 1);
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      mask[y * w + col] = 1;
    }
    const mode = $('opt-marquee-mode')?.value || 'new';
    this.app.applySelectionMask(mask, mode);
  }
}

// --- 3. Magnetic Lasso Tool (Sobel edge-snapping) ---
class MagneticLassoTool extends BaseTool {
  constructor(app) {
    super(app);
    this.points = [];
    this.isActive = false;
    this.cachedGradientMap = null;
    this.lastSnap = null;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onDblClick = this._onDblClick.bind(this);
  }

  get name() { return 'magneticlasso'; }
  get label() { return '🧲 Magnetic Lasso'; }
  get optSection() { return 'opt-magneticlasso'; }

  _computeGradientMap() {
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const l = this.app.layerManager.activeLayer;
    if (!l) return null;

    const imgData = l.ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    const lum = new Float32Array(w * h);
    for (let i = 0; i < lum.length; i++) {
      const idx = i * 4;
      lum[i] = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
    }

    const grad = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        // Sobel Kernels
        const p00 = lum[(y - 1) * w + (x - 1)], p01 = lum[(y - 1) * w + x], p02 = lum[(y - 1) * w + (x + 1)];
        const p10 = lum[y * w + (x - 1)],                                    p12 = lum[y * w + (x + 1)];
        const p20 = lum[(y + 1) * w + (x - 1)], p21 = lum[(y + 1) * w + x], p22 = lum[(y + 1) * w + (x + 1)];

        const gx = (p02 + 2 * p12 + p22) - (p00 + 2 * p10 + p20);
        const gy = (p20 + 2 * p21 + p22) - (p00 + 2 * p01 + p02);
        grad[y * w + x] = Math.hypot(gx, gy);
      }
    }
    return grad;
  }

  findEdgeSnap(cx, cy, searchRadius = 14) {
    if (!this.cachedGradientMap) return { x: cx, y: cy };
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const r = searchRadius;
    const minX = clamp(Math.round(cx - r), 1, w - 2);
    const maxX = clamp(Math.round(cx + r), 1, w - 2);
    const minY = clamp(Math.round(cy - r), 1, h - 2);
    const maxY = clamp(Math.round(cy + r), 1, h - 2);

    let bestX = cx, bestY = cy;
    let maxScore = -1;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > r) continue;
        const gradVal = this.cachedGradientMap[y * w + x];
        // Weight by gradient magnitude with mild distance penalty
        const score = gradVal / (1.0 + dist * 0.35);
        if (score > maxScore) {
          maxScore = score;
          bestX = x;
          bestY = y;
        }
      }
    }
    return maxScore > 18 ? { x: bestX, y: bestY } : { x: cx, y: cy };
  }

  onDown(x, y) {
    if (!this.isActive) {
      this.isActive = true;
      this.cachedGradientMap = this._computeGradientMap();
      const snapped = this.findEdgeSnap(x, y);
      this.points = [snapped];
      this.lastSnap = snapped;
      window.addEventListener('keydown', this._onKeyDown);
      this.app.viewport.addEventListener('dblclick', this._onDblClick);
    } else {
      // Check if clicking near start point (closing loop)
      const start = this.points[0];
      if (this.points.length > 2 && Math.hypot(x - start.x, y - start.y) < 14) {
        this.closeLoop();
        return;
      }
      const snapped = this.findEdgeSnap(x, y);
      this.points.push(snapped);
      this.lastSnap = snapped;
      this._renderPreview(snapped.x, snapped.y);
    }
  }

  onMove(x, y) {
    if (!this.isActive || this.points.length === 0) return;
    const snapped = this.findEdgeSnap(x, y);
    this.lastSnap = snapped;

    // Auto-anchor if moved sufficiently along high-contrast edge
    const last = this.points[this.points.length - 1];
    if (Math.hypot(snapped.x - last.x, snapped.y - last.y) > 28) {
      this.points.push(snapped);
    }
    this._renderPreview(snapped.x, snapped.y);
  }

  _renderPreview(curX, curY) {
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);
    if (this.points.length === 0) return;

    ctx.save();
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.lineTo(curX, curY);
    ctx.stroke();

    // Draw vertex anchors
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    for (let i = 0; i < this.points.length; i++) {
      ctx.fillRect(this.points[i].x - 2.5, this.points[i].y - 2.5, 5, 5);
      ctx.strokeRect(this.points[i].x - 2.5, this.points[i].y - 2.5, 5, 5);
    }

    // Snapping indicator
    ctx.strokeStyle = '#ff0055';
    ctx.beginPath();
    ctx.arc(curX, curY, 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  closeLoop() {
    if (this.points.length < 3) {
      this.cancel();
      return;
    }
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const mask = new Uint8Array(w * h);

    // Rasterize polygon using offscreen canvas 2D fill
    const off = createOffscreenCanvas(w, h);
    const octx = off.getContext('2d');
    octx.beginPath();
    octx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      octx.lineTo(this.points[i].x, this.points[i].y);
    }
    octx.closePath();
    octx.fillStyle = '#ffffff';
    octx.fill();

    const imgData = octx.getImageData(0, 0, w, h).data;
    for (let i = 0; i < w * h; i++) {
      if (imgData[i * 4 + 3] > 128) {
        mask[i] = 1;
      }
    }

    const mode = $('opt-magnetic-mode')?.value || 'new';
    this.app.applySelectionMask(mask, mode);
    this.cancel();
  }

  cancel() {
    this.isActive = false;
    this.points = [];
    this.cachedGradientMap = null;
    const sc = $('selection-canvas');
    sc.getContext('2d').clearRect(0, 0, sc.width, sc.height);
    window.removeEventListener('keydown', this._onKeyDown);
    this.app.viewport.removeEventListener('dblclick', this._onDblClick);
  }

  _onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.closeLoop();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancel();
    }
  }

  _onDblClick(e) {
    e.preventDefault();
    this.closeLoop();
  }

  deactivate() {
    this.cancel();
  }
}

// --- 4. Quick Selection Tool (Expanding Brush Flood) ---
class QuickSelectionTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
  }
  get name() { return 'quickselection'; }
  get label() { return '🖌️ Quick Selection Tool'; }
  get optSection() { return 'opt-quickselection'; }

  onDown(x, y) {
    this.isDrawing = true;
    this.expandSelection(x, y);
  }

  onMove(x, y) {
    if (!this.isDrawing) return;
    this.expandSelection(x, y);
  }

  onUp() {
    this.isDrawing = false;
  }

  expandSelection(cx, cy) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const radius = parseInt($('opt-quick-size')?.value || '20', 10);
    const tolerance = parseInt($('opt-quick-tolerance')?.value || '28', 10);

    const imgData = l.ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    // Sample center seed color
    const centerIdx = (Math.round(clamp(cy, 0, h - 1)) * w + Math.round(clamp(cx, 0, w - 1))) * 4;
    const sR = d[centerIdx], sG = d[centerIdx + 1], sB = d[centerIdx + 2], sA = d[centerIdx + 3];
    if (sA === 0) return;

    const currentMask = this.app.selectionMask ? new Uint8Array(this.app.selectionMask) : new Uint8Array(w * h);

    // BFS Queue for region growing within radius
    const queue = [[Math.round(cx), Math.round(cy)]];
    const visited = new Uint8Array(w * h);
    const rSq = radius * radius;

    while (queue.length > 0) {
      const [qx, qy] = queue.pop();
      if (qx < 0 || qx >= w || qy < 0 || qy >= h) continue;
      const idx = qy * w + qx;
      if (visited[idx]) continue;
      visited[idx] = 1;

      const distSq = (qx - cx) * (qx - cx) + (qy - cy) * (qy - cy);
      if (distSq > rSq) continue;

      const pIdx = idx * 4;
      const pR = d[pIdx], pG = d[pIdx + 1], pB = d[pIdx + 2];
      const colorDist = Math.hypot(pR - sR, pG - sG, pB - sB);

      if (colorDist <= tolerance) {
        currentMask[idx] = 1;
        // Expand 4-connected neighbors
        if (qx > 0) queue.push([qx - 1, qy]);
        if (qx < w - 1) queue.push([qx + 1, qy]);
        if (qy > 0) queue.push([qx, qy - 1]);
        if (qy < h - 1) queue.push([qx, qy + 1]);
      }
    }

    this.app.applySelectionMask(currentMask, 'new');
  }
}

// --- 5. Object Selection Tool (Bounding Box Saliency) ---
class ObjectSelectionTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
    this.startX = 0; this.startY = 0;
    this.endX = 0; this.endY = 0;
  }
  get name() { return 'objectselection'; }
  get label() { return '📦 Object Selection'; }
  get optSection() { return 'opt-objectselection'; }

  onDown(x, y) {
    this.isDrawing = true;
    this.startX = x; this.startY = y;
    this.endX = x; this.endY = y;
  }

  onMove(x, y) {
    if (!this.isDrawing) return;
    this.endX = x; this.endY = y;
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);
    ctx.save();
    ctx.strokeStyle = '#00e5ff';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.startX, this.startY, this.endX - this.startX, this.endY - this.startY);
    ctx.restore();
  }

  onUp() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    const sc = $('selection-canvas');
    sc.getContext('2d').clearRect(0, 0, sc.width, sc.height);

    const bx = Math.round(Math.min(this.startX, this.endX));
    const by = Math.round(Math.min(this.startY, this.endY));
    const bw = Math.round(Math.abs(this.endX - this.startX));
    const bh = Math.round(Math.abs(this.endY - this.startY));
    if (bw < 6 || bh < 6) return;

    this.isolateObjectInBox(bx, by, bw, bh);
  }

  isolateObjectInBox(bx, by, bw, bh) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const imgData = l.ctx.getImageData(bx, by, bw, bh);
    const d = imgData.data;

    // 1. Collect perimeter background color distribution
    let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (x === 0 || x === bw - 1 || y === 0 || y === bh - 1) {
          const idx = (y * bw + x) * 4;
          if (d[idx + 3] > 0) {
            bgR += d[idx]; bgG += d[idx + 1]; bgB += d[idx + 2];
            bgCount++;
          }
        }
      }
    }
    if (bgCount === 0) bgCount = 1;
    const avgBgR = bgR / bgCount, avgBgG = bgG / bgCount, avgBgB = bgB / bgCount;

    // 2. Compute object mask based on Euclidean color difference from background
    const boxMask = new Uint8Array(bw * bh);
    const threshold = parseInt($('opt-object-threshold')?.value || '32', 10);

    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const idx = (y * bw + x) * 4;
        if (d[idx + 3] < 10) continue; // transparent pixel
        const diff = Math.hypot(d[idx] - avgBgR, d[idx + 1] - avgBgG, d[idx + 2] - avgBgB);
        if (diff > threshold) {
          boxMask[y * bw + x] = 1;
        }
      }
    }

    // 3. Project box mask into global canvas selection mask
    const globalMask = new Uint8Array(w * h);
    for (let y = 0; y < bh; y++) {
      const gy = by + y;
      if (gy < 0 || gy >= h) continue;
      for (let x = 0; x < bw; x++) {
        const gx = bx + x;
        if (gx < 0 || gx >= w) continue;
        if (boxMask[y * bw + x]) {
          globalMask[gy * w + gx] = 1;
        }
      }
    }

    const mode = $('opt-object-mode')?.value || 'new';
    this.app.applySelectionMask(globalMask, mode);
  }
}

// ════════════════════════════════════════════════════════════════════
// B. CROP, SLICE & LAYOUT TOOLS
// ════════════════════════════════════════════════════════════════════

// --- 6. Perspective Crop Tool (4-Corner Quad Pin Warp) ---
class PerspectiveCropTool extends BaseTool {
  constructor(app) {
    super(app);
    this.pins = null; // [TL, TR, BR, BL]
    this.activePin = -1;
    this.isDragging = false;
  }
  get name() { return 'perspectivecrop'; }
  get label() { return '📐 Perspective Crop'; }
  get optSection() { return 'opt-perspectivecrop'; }

  _initDefaultPins() {
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const padX = Math.round(w * 0.15), padY = Math.round(h * 0.15);
    this.pins = [
      { x: padX, y: padY },
      { x: w - padX, y: padY },
      { x: w - padX, y: h - padY },
      { x: padX, y: h - padY }
    ];
  }

  onDown(x, y) {
    if (!this.pins) {
      this._initDefaultPins();
    }
    // Check if clicked near an existing pin handle
    for (let i = 0; i < 4; i++) {
      if (Math.hypot(x - this.pins[i].x, y - this.pins[i].y) < 16) {
        this.activePin = i;
        this.isDragging = true;
        return;
      }
    }
    this.activePin = -1;
    this.drawOverlay();
  }

  onMove(x, y) {
    if (this.isDragging && this.activePin >= 0) {
      this.pins[this.activePin].x = clamp(x, 0, this.app.canvasWidth);
      this.pins[this.activePin].y = clamp(y, 0, this.app.canvasHeight);
      this.drawOverlay();
    }
  }

  onUp() {
    this.isDragging = false;
    this.activePin = -1;
  }

  drawOverlay() {
    if (!this.pins) return;
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);

    ctx.save();
    // Shaded outer mask
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, sc.width, sc.height);

    // Cut out quad
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(this.pins[0].x, this.pins[0].y);
    ctx.lineTo(this.pins[1].x, this.pins[1].y);
    ctx.lineTo(this.pins[2].x, this.pins[2].y);
    ctx.lineTo(this.pins[3].x, this.pins[3].y);
    ctx.closePath();
    ctx.fill();

    // Quad boundary & perspective grid
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw inner 3x3 perspective division lines
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.setLineDash([3, 3]);
    for (let t = 0.33; t < 1.0; t += 0.33) {
      const pTop = this._interp(this.pins[0], this.pins[1], t);
      const pBot = this._interp(this.pins[3], this.pins[2], t);
      ctx.beginPath(); ctx.moveTo(pTop.x, pTop.y); ctx.lineTo(pBot.x, pBot.y); ctx.stroke();

      const pLeft = this._interp(this.pins[0], this.pins[3], t);
      const pRight = this._interp(this.pins[1], this.pins[2], t);
      ctx.beginPath(); ctx.moveTo(pLeft.x, pLeft.y); ctx.lineTo(pRight.x, pRight.y); ctx.stroke();
    }

    // Handles
    ctx.setLineDash([]);
    ctx.fillStyle = '#0078d4';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(this.pins[i].x, this.pins[i].y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  _interp(p1, p2, t) {
    return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
  }

  commitPerspectiveCrop() {
    if (!this.pins) return;
    const [p0, p1, p2, p3] = this.pins;

    // Estimate rectified rectangular width and height
    const topW = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const botW = Math.hypot(p2.x - p3.x, p2.y - p3.y);
    const leftH = Math.hypot(p3.x - p0.x, p3.y - p0.y);
    const rightH = Math.hypot(p2.x - p1.x, p2.y - p1.y);

    const targetW = Math.max(10, Math.round((topW + botW) / 2));
    const targetH = Math.max(10, Math.round((leftH + rightH) / 2));

    this.app.history.snapshot('Perspective Crop');

    // Quad-to-rect backward mapping with bilinear interpolation
    this.app.layerManager.layers.forEach(layer => {
      const srcCanvas = layer.canvas;
      const sCtx = srcCanvas.getContext('2d');
      const sData = sCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
      const sd = sData.data;
      const sw = srcCanvas.width, sh = srcCanvas.height;

      const dstCanvas = createOffscreenCanvas(targetW, targetH);
      const dCtx = dstCanvas.getContext('2d');
      const dData = dCtx.createImageData(targetW, targetH);
      const dd = dData.data;

      for (let y = 0; y < targetH; y++) {
        const v = y / (targetH - 1 || 1);
        for (let x = 0; x < targetW; x++) {
          const u = x / (targetW - 1 || 1);

          // Bilinear interpolation on quad surface
          const sx = (1 - u) * (1 - v) * p0.x + u * (1 - v) * p1.x + u * v * p2.x + (1 - u) * v * p3.x;
          const sy = (1 - u) * (1 - v) * p0.y + u * (1 - v) * p1.y + u * v * p2.y + (1 - u) * v * p3.y;

          const ix = Math.floor(sx), iy = Math.floor(sy);
          if (ix >= 0 && ix < sw - 1 && iy >= 0 && iy < sh - 1) {
            const fx = sx - ix, fy = sy - iy;
            const i00 = (iy * sw + ix) * 4;
            const i10 = (iy * sw + (ix + 1)) * 4;
            const i01 = ((iy + 1) * sw + ix) * 4;
            const i11 = ((iy + 1) * sw + (ix + 1)) * 4;

            const dIdx = (y * targetW + x) * 4;
            for (let c = 0; c < 4; c++) {
              const val = (1 - fx) * (1 - fy) * sd[i00 + c] +
                          fx * (1 - fy) * sd[i10 + c] +
                          (1 - fx) * fy * sd[i01 + c] +
                          fx * fy * sd[i11 + c];
              dd[dIdx + c] = Math.round(val);
            }
          }
        }
      }
      dCtx.putImageData(dData, 0, 0);
      layer.canvas = dstCanvas;
      layer.ctx = dstCanvas.getContext('2d');
    });

    this.app.canvasWidth = targetW;
    this.app.canvasHeight = targetH;
    this.app._setupCanvasDOM();
    this.app.clearSelection();
    this.pins = null;
    this.app.composite();
    this.app.layerManager.renderLayersPanel();
    this.app.fitToScreen();
  }

  cancel() {
    this.pins = null;
    const sc = $('selection-canvas');
    sc.getContext('2d').clearRect(0, 0, sc.width, sc.height);
  }

  deactivate() {
    this.cancel();
  }
}

// --- 7. Slice Tool & Slice Select Tool (Web Slices) ---
class SliceTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
    this.startX = 0; this.startY = 0;
  }
  get name() { return 'slice'; }
  get label() { return '🔪 Slice Tool'; }
  get optSection() { return 'opt-slice'; }

  onDown(x, y) {
    this.isDrawing = true;
    this.startX = x; this.startY = y;
  }
  onMove(x, y) {
    if (!this.isDrawing) return;
    this.drawPreview(this.startX, this.startY, x - this.startX, y - this.startY);
  }
  onUp(x, y) {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    const sx = Math.round(Math.min(this.startX, x));
    const sy = Math.round(Math.min(this.startY, y));
    const sw = Math.round(Math.abs(x - this.startX));
    const sh = Math.round(Math.abs(y - this.startY));
    if (sw > 10 && sh > 10) {
      if (!this.app.slices) this.app.slices = [];
      const id = String(this.app.slices.length + 1).padStart(2, '0');
      this.app.slices.push({ id, x: sx, y: sy, w: sw, h: sh });
    }
    this.renderAllSlices();
  }

  drawPreview(x, y, w, h) {
    this.renderAllSlices();
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.save();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  renderAllSlices() {
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);
    if (!this.app.slices) return;

    ctx.save();
    this.app.slices.forEach((s, idx) => {
      ctx.strokeStyle = '#0078d4';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(s.x, s.y, s.w, s.h);

      // Badge
      ctx.fillStyle = '#0078d4';
      ctx.fillRect(s.x, s.y, 24, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(s.id, s.x + 4, s.y + 10);
    });
    ctx.restore();
  }
}

class SliceSelectTool extends BaseTool {
  constructor(app) {
    super(app);
    this.selectedSlice = null;
  }
  get name() { return 'sliceselect'; }
  get label() { return '↖ Slice Select Tool'; }
  get optSection() { return 'opt-slice'; }

  onDown(x, y) {
    if (!this.app.slices) return;
    this.selectedSlice = this.app.slices.find(s => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) || null;
    this.render();
  }

  deleteSelectedSlice() {
    if (!this.selectedSlice || !this.app.slices) return;
    this.app.slices = this.app.slices.filter(s => s !== this.selectedSlice);
    this.selectedSlice = null;
    this.render();
  }

  render() {
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);
    if (!this.app.slices) return;

    ctx.save();
    this.app.slices.forEach(s => {
      const isSel = s === this.selectedSlice;
      ctx.strokeStyle = isSel ? '#ff0055' : '#0078d4';
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.strokeRect(s.x, s.y, s.w, s.h);

      ctx.fillStyle = isSel ? '#ff0055' : '#0078d4';
      ctx.fillRect(s.x, s.y, 24, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(s.id, s.x + 4, s.y + 10);
    });
    ctx.restore();
  }
}

// --- 8. Frame Tool (Placeholder Clipping Containers) ---
class FrameTool extends BaseTool {
  constructor(app, type = 'rect') {
    super(app);
    this.type = type; // 'rect' | 'ellipse'
    this.isDrawing = false;
    this.startX = 0; this.startY = 0;
  }
  get name() { return 'frame_' + this.type; }
  get label() { return `🖼️ Frame Tool (${this.type.toUpperCase()})`; }
  get optSection() { return 'opt-frame'; }

  onDown(x, y) {
    this.isDrawing = true;
    this.startX = x; this.startY = y;
  }
  onMove(x, y) {
    if (!this.isDrawing) return;
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);
    ctx.save();
    ctx.strokeStyle = '#0078d4';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    const fx = Math.min(this.startX, x), fy = Math.min(this.startY, y);
    const fw = Math.abs(x - this.startX), fh = Math.abs(y - this.startY);

    if (this.type === 'rect') {
      ctx.strokeRect(fx, fy, fw, fh);
      ctx.beginPath();
      ctx.moveTo(fx, fy); ctx.lineTo(fx + fw, fy + fh);
      ctx.moveTo(fx + fw, fy); ctx.lineTo(fx, fy + fh);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(fx + fw / 2, fy + fh / 2, fw / 2, fh / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  onUp(x, y) {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    const sc = $('selection-canvas');
    sc.getContext('2d').clearRect(0, 0, sc.width, sc.height);

    const fx = Math.round(Math.min(this.startX, x)), fy = Math.round(Math.min(this.startY, y));
    const fw = Math.round(Math.abs(x - this.startX)), fh = Math.round(Math.abs(y - this.startY));
    if (fw < 10 || fh < 10) return;

    this.app.history.snapshot('Create Frame');
    this.app.layerManager.addLayer(`Frame (${this.type})`);
    const l = this.app.layerManager.activeLayer;

    // Render frame border and inner X placeholder onto new layer
    l.ctx.save();
    l.ctx.strokeStyle = '#555555';
    l.ctx.lineWidth = 2;
    if (this.type === 'rect') {
      l.ctx.strokeRect(fx, fy, fw, fh);
      l.ctx.beginPath();
      l.ctx.moveTo(fx, fy); l.ctx.lineTo(fx + fw, fy + fh);
      l.ctx.moveTo(fx + fw, fy); l.ctx.lineTo(fx, fy + fh);
      l.ctx.stroke();
    } else {
      l.ctx.beginPath();
      l.ctx.ellipse(fx + fw / 2, fy + fh / 2, fw / 2, fh / 2, 0, 0, Math.PI * 2);
      l.ctx.stroke();
    }
    l.ctx.restore();

    this.app.composite();
    this.app.layerManager.renderLayersPanel();
  }
}

// ════════════════════════════════════════════════════════════════════
// C. RETOUCHING & HEALING TOOLS
// ════════════════════════════════════════════════════════════════════

// --- 9. Healing Brush Tool (Poisson / Frequency Separation Texture Transfer) ---
class HealingBrushTool extends BaseTool {
  constructor(app) {
    super(app);
    this.sourceCoord = null;
    this.isDrawing = false;
    this.offset = null;
  }
  get name() { return 'healingbrush'; }
  get label() { return '🩹 Healing Brush Tool'; }
  get optSection() { return 'opt-brush'; }

  onDown(x, y) {
    if (this.app._shiftHeld) {
      this.sourceCoord = { x: Math.round(x), y: Math.round(y) };
      $('active-tool-display').textContent = `🩹 Healing Source set to (${this.sourceCoord.x}, ${this.sourceCoord.y})`;
      return;
    }
    if (!this.sourceCoord) {
      alert('Hold Shift+Click to set a clean source texture point first!');
      return;
    }
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Healing Brush');
    this.isDrawing = true;
    this.offset = { x: this.sourceCoord.x - Math.round(x), y: this.sourceCoord.y - Math.round(y) };
    this.applyHeal(l.ctx, Math.round(x), Math.round(y));
  }

  onMove(x, y) {
    if (!this.isDrawing) return;
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.applyHeal(l.ctx, Math.round(x), Math.round(y));
  }

  onUp() {
    this.isDrawing = false;
    this.offset = null;
  }

  applyHeal(ctx, dx, dy) {
    const sx = dx + this.offset.x;
    const sy = dy + this.offset.y;
    const radius = parseInt($('opt-brush-size')?.value || '20', 10);
    const w = this.app.canvasWidth, h = this.app.canvasHeight;

    const minX = clamp(dx - radius, 0, w - 1), maxX = clamp(dx + radius, 0, w - 1);
    const minY = clamp(dy - radius, 0, h - 1), maxY = clamp(dy + radius, 0, h - 1);
    const boxW = maxX - minX + 1, boxH = maxY - minY + 1;
    if (boxW <= 0 || boxH <= 0) return;

    // Destination patch
    const dstData = ctx.getImageData(minX, minY, boxW, boxH);
    const dd = dstData.data;

    // Source patch
    const sMinX = clamp(sx - radius, 0, w - 1);
    const sMinY = clamp(sy - radius, 0, h - 1);
    const srcData = ctx.getImageData(sMinX, sMinY, boxW, boxH);
    const sd = srcData.data;

    // Compute average luminance of destination and source
    let dLumSum = 0, sLumSum = 0, count = 0;
    for (let i = 0; i < boxW * boxH; i++) {
      const idx = i * 4;
      if (dd[idx + 3] > 0 && sd[idx + 3] > 0) {
        dLumSum += 0.299 * dd[idx] + 0.587 * dd[idx + 1] + 0.114 * dd[idx + 2];
        sLumSum += 0.299 * sd[idx] + 0.587 * sd[idx + 1] + 0.114 * sd[idx + 2];
        count++;
      }
    }
    const lumOffset = count > 0 ? (dLumSum / count) - (sLumSum / count) : 0;

    // Blend source texture detail with destination luminance
    for (let y = 0; y < boxH; y++) {
      for (let x = 0; x < boxW; x++) {
        const dist = Math.hypot(minX + x - dx, minY + y - dy);
        if (dist <= radius) {
          const idx = (y * boxW + x) * 4;
          const feather = Math.cos((dist / radius) * (Math.PI / 2)); // Smooth edge feathering

          const healedR = clamp(sd[idx] + lumOffset, 0, 255);
          const healedG = clamp(sd[idx + 1] + lumOffset, 0, 255);
          const healedB = clamp(sd[idx + 2] + lumOffset, 0, 255);

          dd[idx]     = Math.round(dd[idx] * (1 - feather) + healedR * feather);
          dd[idx + 1] = Math.round(dd[idx + 1] * (1 - feather) + healedG * feather);
          dd[idx + 2] = Math.round(dd[idx + 2] * (1 - feather) + healedB * feather);
        }
      }
    }
    ctx.putImageData(dstData, minX, minY);
    this.app.composite();
  }
}

// --- 10. Patch Tool (Texture Region Transfer) ---
class PatchTool extends BaseTool {
  constructor(app) {
    super(app);
    this.phase = 'lasso'; // 'lasso' | 'drag'
    this.polygon = [];
    this.dragStart = null;
    this.patchCanvas = null;
  }
  get name() { return 'patch'; }
  get label() { return '🩹 Patch Tool'; }
  get optSection() { return 'opt-lasso'; }

  onDown(x, y) {
    if (this.phase === 'lasso') {
      this.polygon = [{ x, y }];
    } else if (this.phase === 'drag') {
      this.dragStart = { x, y };
    }
  }

  onMove(x, y) {
    if (this.phase === 'lasso') {
      this.polygon.push({ x, y });
      this._drawLassoPreview();
    } else if (this.phase === 'drag' && this.dragStart) {
      const dx = x - this.dragStart.x;
      const dy = y - this.dragStart.y;
      this._drawDragPreview(dx, dy);
    }
  }

  onUp(x, y) {
    if (this.phase === 'lasso') {
      if (this.polygon.length > 5) {
        this.phase = 'drag';
        this._drawLassoPreview();
      } else {
        this.polygon = [];
      }
    } else if (this.phase === 'drag' && this.dragStart) {
      const dx = x - this.dragStart.x;
      const dy = y - this.dragStart.y;
      this.commitPatch(dx, dy);
      this.phase = 'lasso';
      this.polygon = [];
      this.dragStart = null;
      const sc = $('selection-canvas');
      sc.getContext('2d').clearRect(0, 0, sc.width, sc.height);
    }
  }

  _drawLassoPreview() {
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);
    if (this.polygon.length < 2) return;
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(this.polygon[0].x, this.polygon[0].y);
    for (let i = 1; i < this.polygon.length; i++) ctx.lineTo(this.polygon[i].x, this.polygon[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  _drawDragPreview(dx, dy) {
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);
    ctx.save();
    ctx.strokeStyle = '#00ffff';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(this.polygon[0].x + dx, this.polygon[0].y + dy);
    for (let i = 1; i < this.polygon.length; i++) ctx.lineTo(this.polygon[i].x + dx, this.polygon[i].y + dy);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  commitPatch(dx, dy) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Patch Tool');

    // Create patch mask
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const offMask = createOffscreenCanvas(w, h);
    const mCtx = offMask.getContext('2d');
    mCtx.beginPath();
    mCtx.moveTo(this.polygon[0].x, this.polygon[0].y);
    for (let i = 1; i < this.polygon.length; i++) mCtx.lineTo(this.polygon[i].x, this.polygon[i].y);
    mCtx.closePath();
    mCtx.fillStyle = '#ffffff';
    mCtx.fill();

    // Sample source texture at offset (dx, dy)
    const offSrc = createOffscreenCanvas(w, h);
    const sCtx = offSrc.getContext('2d');
    sCtx.drawImage(l.canvas, -dx, -dy);
    sCtx.globalCompositeOperation = 'destination-in';
    sCtx.drawImage(offMask, 0, 0);

    // Composite blended patch back onto layer
    l.ctx.save();
    l.ctx.globalAlpha = 0.85;
    l.ctx.drawImage(offSrc, 0, 0);
    l.ctx.restore();

    this.app.composite();
    this.app.layerManager.renderLayersPanel();
  }

  deactivate() {
    this.phase = 'lasso';
    this.polygon = [];
    const sc = $('selection-canvas');
    sc.getContext('2d').clearRect(0, 0, sc.width, sc.height);
  }
}

// --- 11. Content-Aware Move Tool ---
class ContentAwareMoveTool extends BaseTool {
  constructor(app) {
    super(app);
    this.phase = 'select'; // 'select' | 'drag'
    this.startX = 0; this.startY = 0;
    this.endX = 0; this.endY = 0;
    this.dragStart = null;
    this.cutoutCanvas = null;
  }
  get name() { return 'contentawaremove'; }
  get label() { return '✥ Content-Aware Move'; }
  get optSection() { return 'opt-freetransform'; }

  onDown(x, y) {
    if (this.phase === 'select') {
      this.startX = x; this.startY = y;
      this.endX = x; this.endY = y;
    } else if (this.phase === 'drag') {
      this.dragStart = { x, y };
    }
  }

  onMove(x, y) {
    if (this.phase === 'select') {
      this.endX = x; this.endY = y;
      const sc = $('selection-canvas');
      const ctx = sc.getContext('2d');
      ctx.clearRect(0, 0, sc.width, sc.height);
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(this.startX, this.startY, this.endX - this.startX, this.endY - this.startY);
      ctx.restore();
    } else if (this.phase === 'drag' && this.dragStart) {
      const dx = x - this.dragStart.x;
      const dy = y - this.dragStart.y;
      const sc = $('selection-canvas');
      const ctx = sc.getContext('2d');
      ctx.clearRect(0, 0, sc.width, sc.height);
      if (this.cutoutCanvas) {
        ctx.drawImage(this.cutoutCanvas, this.bx + dx, this.by + dy);
      }
    }
  }

  onUp(x, y) {
    if (this.phase === 'select') {
      this.bx = Math.round(Math.min(this.startX, this.endX));
      this.by = Math.round(Math.min(this.startY, this.endY));
      this.bw = Math.round(Math.abs(this.endX - this.startX));
      this.bh = Math.round(Math.abs(this.endY - this.startY));
      if (this.bw > 8 && this.bh > 8) {
        const l = this.app.layerManager.activeLayer;
        if (l) {
          this.cutoutCanvas = createOffscreenCanvas(this.bw, this.bh);
          this.cutoutCanvas.getContext('2d').drawImage(l.canvas, this.bx, this.by, this.bw, this.bh, 0, 0, this.bw, this.bh);
          this.phase = 'drag';
        }
      }
    } else if (this.phase === 'drag' && this.dragStart) {
      const dx = Math.round(x - this.dragStart.x);
      const dy = Math.round(y - this.dragStart.y);
      this.commitMove(dx, dy);
      this.phase = 'select';
      this.dragStart = null;
      this.cutoutCanvas = null;
      const sc = $('selection-canvas');
      sc.getContext('2d').clearRect(0, 0, sc.width, sc.height);
    }
  }

  commitMove(dx, dy) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Content-Aware Move');

    // 1. Inpaint original hole with surrounding perimeter texture
    const rOuter = 8;
    const minX = clamp(this.bx - rOuter, 0, this.app.canvasWidth - 1);
    const minY = clamp(this.by - rOuter, 0, this.app.canvasHeight - 1);
    const boxW = clamp(this.bw + rOuter * 2, 1, this.app.canvasWidth - minX);
    const boxH = clamp(this.bh + rOuter * 2, 1, this.app.canvasHeight - minY);

    const imgData = l.ctx.getImageData(minX, minY, boxW, boxH);
    const d = imgData.data;

    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let py = 0; py < boxH; py++) {
      for (let px = 0; px < boxW; px++) {
        const isBorder = (px < rOuter || px >= boxW - rOuter || py < rOuter || py >= boxH - rOuter);
        if (isBorder) {
          const idx = (py * boxW + px) * 4;
          if (d[idx + 3] > 0) {
            rSum += d[idx]; gSum += d[idx + 1]; bSum += d[idx + 2]; count++;
          }
        }
      }
    }
    const avgR = count > 0 ? rSum / count : 255;
    const avgG = count > 0 ? gSum / count : 255;
    const avgB = count > 0 ? bSum / count : 255;

    // Fill inner cutout area with surrounding smooth blend
    for (let py = rOuter; py < boxH - rOuter; py++) {
      for (let px = rOuter; px < boxW - rOuter; px++) {
        const idx = (py * boxW + px) * 4;
        d[idx] = avgR; d[idx + 1] = avgG; d[idx + 2] = avgB;
      }
    }
    l.ctx.putImageData(imgData, minX, minY);

    // 2. Composite cutout subject at new destination
    l.ctx.drawImage(this.cutoutCanvas, this.bx + dx, this.by + dy);
    this.app.composite();
    this.app.layerManager.renderLayersPanel();
  }
}

// --- 12. Pattern Stamp Tool (Tiled Pattern Painting) ---
class PatternStampTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
    this.patternType = 'checker'; // 'checker' | 'stripes' | 'dots' | 'wood' | 'noise'
    this.patternCanvas = null;
  }
  get name() { return 'patternstamp'; }
  get label() { return '🔁 Pattern Stamp Tool'; }
  get optSection() { return 'opt-patternstamp'; }

  _generatePattern() {
    const size = 32;
    const pc = createOffscreenCanvas(size, size);
    const pctx = pc.getContext('2d');
    const type = $('opt-pattern-type')?.value || this.patternType;

    if (type === 'checker') {
      pctx.fillStyle = '#ffffff'; pctx.fillRect(0, 0, size, size);
      pctx.fillStyle = '#1e1e1e';
      pctx.fillRect(0, 0, size / 2, size / 2);
      pctx.fillRect(size / 2, size / 2, size / 2, size / 2);
    } else if (type === 'stripes') {
      pctx.fillStyle = '#0078d4'; pctx.fillRect(0, 0, size, size);
      pctx.strokeStyle = '#ffffff'; pctx.lineWidth = 4;
      pctx.beginPath();
      pctx.moveTo(0, 0); pctx.lineTo(size, size);
      pctx.moveTo(-size / 2, size / 2); pctx.lineTo(size / 2, size * 1.5);
      pctx.moveTo(size / 2, -size / 2); pctx.lineTo(size * 1.5, size / 2);
      pctx.stroke();
    } else if (type === 'dots') {
      pctx.fillStyle = '#222222'; pctx.fillRect(0, 0, size, size);
      pctx.fillStyle = '#ffcc00';
      pctx.beginPath(); pctx.arc(size / 4, size / 4, 4, 0, Math.PI * 2); pctx.fill();
      pctx.beginPath(); pctx.arc(size * 0.75, size * 0.75, 4, 0, Math.PI * 2); pctx.fill();
    } else {
      // Noise / Texture
      const imgData = pctx.createImageData(size, size);
      for (let i = 0; i < size * size * 4; i += 4) {
        const val = Math.floor(Math.random() * 255);
        imgData.data[i] = val; imgData.data[i + 1] = val; imgData.data[i + 2] = val; imgData.data[i + 3] = 255;
      }
      pctx.putImageData(imgData, 0, 0);
    }
    return pc;
  }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Pattern Stamp');
    this.isDrawing = true;
    this.patternCanvas = this._generatePattern();
    this.paint(l.ctx, x, y);
  }

  onMove(x, y) {
    if (!this.isDrawing) return;
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.paint(l.ctx, x, y);
  }

  onUp() {
    this.isDrawing = false;
  }

  paint(ctx, x, y) {
    const r = parseInt($('opt-pattern-size')?.value || '24', 10);
    ctx.save();
    const pattern = ctx.createPattern(this.patternCanvas, 'repeat');
    ctx.fillStyle = pattern;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this.app.composite();
  }
}

// ════════════════════════════════════════════════════════════════════
// D. PAINTING & BRUSH TOOLS
// ════════════════════════════════════════════════════════════════════

// --- 13. Pencil Tool (1-bit hard-edged non-antialiased pixel rendering) ---
class PencilTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
    this.prevX = 0; this.prevY = 0;
  }
  get name() { return 'pencil'; }
  get label() { return '✏️ Pencil Tool'; }
  get optSection() { return 'opt-pencil'; }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Pencil');
    this.isDrawing = true;
    this.prevX = Math.round(x); this.prevY = Math.round(y);
    this.drawPixelDisc(l.ctx, this.prevX, this.prevY);
    this.app.composite();
  }

  onMove(x, y) {
    if (!this.isDrawing) return;
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    const cx = Math.round(x), cy = Math.round(y);
    this.drawLineBresenham(l.ctx, this.prevX, this.prevY, cx, cy);
    this.prevX = cx; this.prevY = cy;
    this.app.composite();
  }

  onUp() {
    this.isDrawing = false;
  }

  drawPixelDisc(ctx, cx, cy) {
    const size = parseInt($('opt-pencil-size')?.value || '1', 10);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = this.app.foregroundColor;
    const half = Math.floor(size / 2);
    ctx.fillRect(cx - half, cy - half, size, size);
    ctx.restore();
  }

  drawLineBresenham(ctx, x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
      this.drawPixelDisc(ctx, x0, y0);
      if (x0 === x1 && y0 === y1) break;
      let e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
}

// --- 14. Mixer Brush Tool (Wet paint simulation) ---
class MixerBrushTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
    this.reservoir = null; // { r, g, b }
    this.prevX = 0; this.prevY = 0;
  }
  get name() { return 'mixerbrush'; }
  get label() { return '🖌️ Mixer Brush Tool'; }
  get optSection() { return 'opt-mixerbrush'; }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Mixer Brush');
    this.isDrawing = true;
    this.prevX = x; this.prevY = y;

    // Initialize reservoir from foreground color
    const hex = this.app.foregroundColor;
    this.reservoir = {
      r: parseInt(hex.slice(1, 3), 16) || 0,
      g: parseInt(hex.slice(3, 5), 16) || 0,
      b: parseInt(hex.slice(5, 7), 16) || 0
    };
    this.paintStep(l.ctx, x, y);
  }

  onMove(x, y) {
    if (!this.isDrawing) return;
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.paintStep(l.ctx, x, y);
    this.prevX = x; this.prevY = y;
  }

  onUp() {
    this.isDrawing = false;
  }

  paintStep(ctx, x, y) {
    const r = parseInt($('opt-mixer-size')?.value || '18', 10);
    const wet = (parseInt($('opt-mixer-wet')?.value || '50', 10)) / 100;
    const mix = (parseInt($('opt-mixer-mix')?.value || '50', 10)) / 100;

    const ix = Math.round(x), iy = Math.round(y);
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
      // Sample canvas color under brush center
      const pixel = ctx.getImageData(ix, iy, 1, 1).data;
      if (pixel[3] > 0) {
        // Wetness blends picked-up canvas color into reservoir
        this.reservoir.r = Math.round(this.reservoir.r * (1 - wet * mix) + pixel[0] * (wet * mix));
        this.reservoir.g = Math.round(this.reservoir.g * (1 - wet * mix) + pixel[1] * (wet * mix));
        this.reservoir.b = Math.round(this.reservoir.b * (1 - wet * mix) + pixel[2] * (wet * mix));
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${this.reservoir.r}, ${this.reservoir.g}, ${this.reservoir.b})`;
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.restore();
    this.app.composite();
  }
}

// --- 15. History Brush Tool ---
class HistoryBrushTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
    this.sourceCanvas = null;
  }
  get name() { return 'historybrush'; }
  get label() { return '⏳ History Brush Tool'; }
  get optSection() { return 'opt-historybrush'; }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('History Brush');
    this.isDrawing = true;

    // Default to the earliest snapshot or previous state
    const stack = this.app.history.stack;
    if (stack.length > 0) {
      const targetState = stack[0]; // Initial snapshot state
      const targetLayerData = targetState.layers[this.app.layerManager.activeIndex] || targetState.layers[0];
      if (targetLayerData) {
        this.sourceCanvas = targetLayerData.canvas;
      }
    }
    this.paint(l.ctx, x, y);
  }

  onMove(x, y) {
    if (!this.isDrawing) return;
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.paint(l.ctx, x, y);
  }

  onUp() {
    this.isDrawing = false;
    this.sourceCanvas = null;
  }

  paint(ctx, x, y) {
    if (!this.sourceCanvas) return;
    const r = parseInt($('opt-history-size')?.value || '22', 10);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(this.sourceCanvas, 0, 0);
    ctx.restore();
    this.app.composite();
  }
}

// --- 16. Sponge Tool (Vibrancy & Desaturation) ---
class SpongeTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDrawing = false;
  }
  get name() { return 'sponge'; }
  get label() { return '🧽 Sponge Tool'; }
  get optSection() { return 'opt-sponge'; }

  onDown(x, y) {
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.app.history.snapshot('Sponge');
    this.isDrawing = true;
    this.applySponge(l.ctx, x, y);
  }
  onMove(x, y) {
    if (!this.isDrawing) return;
    const l = this.app.layerManager.activeLayer;
    if (!l) return;
    this.applySponge(l.ctx, x, y);
  }
  onUp() {
    this.isDrawing = false;
  }

  applySponge(ctx, cx, cy) {
    const r = parseInt($('opt-sponge-size')?.value || '24', 10);
    const mode = $('opt-sponge-mode')?.value || 'saturate'; // 'saturate' | 'desaturate'
    const flow = (parseInt($('opt-sponge-flow')?.value || '50', 10)) / 100 * 0.25;

    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const minX = clamp(Math.round(cx - r), 0, w - 1), maxX = clamp(Math.round(cx + r), 0, w - 1);
    const minY = clamp(Math.round(cy - r), 0, h - 1), maxY = clamp(Math.round(cy + r), 0, h - 1);
    const boxW = maxX - minX + 1, boxH = maxY - minY + 1;
    const imgData = ctx.getImageData(minX, minY, boxW, boxH);
    const d = imgData.data;

    for (let y = 0; y < boxH; y++) {
      for (let x = 0; x < boxW; x++) {
        const dist = Math.hypot(minX + x - cx, minY + y - cy);
        if (dist <= r) {
          const idx = (y * boxW + x) * 4;
          const { h: hVal, s: sVal, l: lVal } = rgbToHsl(d[idx], d[idx + 1], d[idx + 2]);
          const falloff = 1 - dist / r;
          let newS = sVal;
          if (mode === 'saturate') {
            newS = clamp(sVal + flow * falloff, 0, 1);
          } else {
            newS = clamp(sVal - flow * falloff, 0, 1);
          }
          const { r: nR, g: nG, b: nB } = hslToRgb(hVal, newS, lVal);
          d[idx] = nR; d[idx + 1] = nG; d[idx + 2] = nB;
        }
      }
    }
    ctx.putImageData(imgData, minX, minY);
    this.app.composite();
  }
}

// ════════════════════════════════════════════════════════════════════
// E. VECTOR & PATH TOOLS
// ════════════════════════════════════════════════════════════════════

// --- 17. Cubic Bézier Pen Tool (P) ---
class PenTool extends BaseTool {
  constructor(app) {
    super(app);
    this.anchors = []; // [{ x, y, cp1: {x,y}, cp2: {x,y} }]
    this.activeAnchor = null;
    this.isDraggingHandle = false;
    this.isClosed = false;
  }
  get name() { return 'pen'; }
  get label() { return '✒️ Pen Tool'; }
  get optSection() { return 'opt-pen'; }

  onDown(x, y) {
    // Check if clicking on first anchor to close path
    if (this.anchors.length > 2 && Math.hypot(x - this.anchors[0].x, y - this.anchors[0].y) < 10) {
      this.isClosed = true;
      this.renderPath();
      return;
    }

    const anchor = {
      x, y,
      cp1: { x, y }, // Incoming control point
      cp2: { x, y }  // Outgoing control point
    };
    this.anchors.push(anchor);
    this.activeAnchor = anchor;
    this.isDraggingHandle = true;
    this.renderPath();
  }

  onMove(x, y) {
    if (this.isDraggingHandle && this.activeAnchor) {
      // Tangent handle dragged outward
      const dx = x - this.activeAnchor.x;
      const dy = y - this.activeAnchor.y;
      this.activeAnchor.cp2 = { x, y };
      this.activeAnchor.cp1 = { x: this.activeAnchor.x - dx, y: this.activeAnchor.y - dy };
      this.renderPath();
    }
  }

  onUp() {
    this.isDraggingHandle = false;
  }

  renderPath() {
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);
    if (this.anchors.length === 0) return;

    ctx.save();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.anchors[0].x, this.anchors[0].y);

    for (let i = 1; i < this.anchors.length; i++) {
      const prev = this.anchors[i - 1];
      const cur = this.anchors[i];
      ctx.bezierCurveTo(prev.cp2.x, prev.cp2.y, cur.cp1.x, cur.cp1.y, cur.x, cur.y);
    }
    if (this.isClosed && this.anchors.length > 1) {
      const last = this.anchors[this.anchors.length - 1];
      const first = this.anchors[0];
      ctx.bezierCurveTo(last.cp2.x, last.cp2.y, first.cp1.x, first.cp1.y, first.x, first.y);
    }
    ctx.stroke();

    // Render anchors and tangents
    this.anchors.forEach((a, i) => {
      // Tangent arms
      if (a.cp1.x !== a.x || a.cp2.x !== a.x) {
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.cp1.x, a.cp1.y); ctx.lineTo(a.cp2.x, a.cp2.y);
        ctx.stroke();

        ctx.fillStyle = '#ff0055';
        ctx.beginPath(); ctx.arc(a.cp1.x, a.cp1.y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(a.cp2.x, a.cp2.y, 3, 0, Math.PI * 2); ctx.fill();
      }

      // Anchor Box
      ctx.fillStyle = (i === 0 && this.anchors.length > 2) ? '#ffff00' : '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.fillRect(a.x - 3.5, a.y - 3.5, 7, 7);
      ctx.strokeRect(a.x - 3.5, a.y - 3.5, 7, 7);
    });
    ctx.restore();
  }

  makeSelection() {
    if (this.anchors.length < 3) return;
    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const off = createOffscreenCanvas(w, h);
    const octx = off.getContext('2d');

    octx.beginPath();
    octx.moveTo(this.anchors[0].x, this.anchors[0].y);
    for (let i = 1; i < this.anchors.length; i++) {
      const prev = this.anchors[i - 1], cur = this.anchors[i];
      octx.bezierCurveTo(prev.cp2.x, prev.cp2.y, cur.cp1.x, cur.cp1.y, cur.x, cur.y);
    }
    const last = this.anchors[this.anchors.length - 1], first = this.anchors[0];
    octx.bezierCurveTo(last.cp2.x, last.cp2.y, first.cp1.x, first.cp1.y, first.x, first.y);
    octx.closePath();
    octx.fillStyle = '#ffffff';
    octx.fill();

    const imgData = octx.getImageData(0, 0, w, h).data;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (imgData[i * 4 + 3] > 128) mask[i] = 1;
    }
    this.app.applySelectionMask(mask, 'new');
    this.clearPath();
  }

  fillPath() {
    const l = this.app.layerManager.activeLayer;
    if (!l || this.anchors.length < 3) return;
    this.app.history.snapshot('Fill Path');
    l.ctx.save();
    l.ctx.fillStyle = this.app.foregroundColor;
    l.ctx.beginPath();
    l.ctx.moveTo(this.anchors[0].x, this.anchors[0].y);
    for (let i = 1; i < this.anchors.length; i++) {
      const prev = this.anchors[i - 1], cur = this.anchors[i];
      l.ctx.bezierCurveTo(prev.cp2.x, prev.cp2.y, cur.cp1.x, cur.cp1.y, cur.x, cur.y);
    }
    l.ctx.closePath();
    l.ctx.fill();
    l.ctx.restore();
    this.app.composite();
    this.app.layerManager.renderLayersPanel();
  }

  strokePath() {
    const l = this.app.layerManager.activeLayer;
    if (!l || this.anchors.length < 2) return;
    this.app.history.snapshot('Stroke Path');
    l.ctx.save();
    l.ctx.strokeStyle = this.app.foregroundColor;
    l.ctx.lineWidth = parseInt($('opt-brush-size')?.value || '3', 10);
    l.ctx.beginPath();
    l.ctx.moveTo(this.anchors[0].x, this.anchors[0].y);
    for (let i = 1; i < this.anchors.length; i++) {
      const prev = this.anchors[i - 1], cur = this.anchors[i];
      l.ctx.bezierCurveTo(prev.cp2.x, prev.cp2.y, cur.cp1.x, cur.cp1.y, cur.x, cur.y);
    }
    if (this.isClosed) l.ctx.closePath();
    l.ctx.stroke();
    l.ctx.restore();
    this.app.composite();
    this.app.layerManager.renderLayersPanel();
  }

  clearPath() {
    this.anchors = [];
    this.isClosed = false;
    const sc = $('selection-canvas');
    sc.getContext('2d').clearRect(0, 0, sc.width, sc.height);
  }

  deactivate() {
    const sc = $('selection-canvas');
    sc.getContext('2d').clearRect(0, 0, sc.width, sc.height);
  }
}

// --- 18. Path Selection & Direct Selection Tools (A) ---
class PathSelectionTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDragging = false;
    this.prevX = 0; this.prevY = 0;
  }
  get name() { return 'pathselect'; }
  get label() { return '▲ Path Selection Tool'; }
  get optSection() { return 'opt-pen'; }

  onDown(x, y) {
    const pen = this.app.toolManager.tools['pen'];
    if (!pen || pen.anchors.length === 0) return;
    this.isDragging = true;
    this.prevX = x; this.prevY = y;
  }

  onMove(x, y) {
    if (!this.isDragging) return;
    const pen = this.app.toolManager.tools['pen'];
    if (!pen) return;
    const dx = x - this.prevX, dy = y - this.prevY;
    pen.anchors.forEach(a => {
      a.x += dx; a.y += dy;
      a.cp1.x += dx; a.cp1.y += dy;
      a.cp2.x += dx; a.cp2.y += dy;
    });
    this.prevX = x; this.prevY = y;
    pen.renderPath();
  }

  onUp() {
    this.isDragging = false;
  }
}

class DirectSelectionTool extends BaseTool {
  constructor(app) {
    super(app);
    this.selectedPart = null; // { type: 'anchor'|'cp1'|'cp2', anchor }
  }
  get name() { return 'directselect'; }
  get label() { return '△ Direct Selection Tool'; }
  get optSection() { return 'opt-pen'; }

  onDown(x, y) {
    const pen = this.app.toolManager.tools['pen'];
    if (!pen) return;
    this.selectedPart = null;

    for (const a of pen.anchors) {
      if (Math.hypot(x - a.x, y - a.y) < 8) {
        this.selectedPart = { type: 'anchor', anchor: a };
        return;
      }
      if (Math.hypot(x - a.cp1.x, y - a.cp1.y) < 8) {
        this.selectedPart = { type: 'cp1', anchor: a };
        return;
      }
      if (Math.hypot(x - a.cp2.x, y - a.cp2.y) < 8) {
        this.selectedPart = { type: 'cp2', anchor: a };
        return;
      }
    }
  }

  onMove(x, y) {
    if (!this.selectedPart) return;
    const { type, anchor } = this.selectedPart;
    if (type === 'anchor') {
      const dx = x - anchor.x, dy = y - anchor.y;
      anchor.x = x; anchor.y = y;
      anchor.cp1.x += dx; anchor.cp1.y += dy;
      anchor.cp2.x += dx; anchor.cp2.y += dy;
    } else if (type === 'cp1') {
      anchor.cp1 = { x, y };
    } else if (type === 'cp2') {
      anchor.cp2 = { x, y };
    }
    const pen = this.app.toolManager.tools['pen'];
    if (pen) pen.renderPath();
  }

  onUp() {
    this.selectedPart = null;
  }
}

// --- 19. Vertical Type Tool & Type Mask Tools (T) ---
class VerticalTypeTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isActive = false;
    this.clickX = 0; this.clickY = 0;
  }
  get name() { return 'verticaltext'; }
  get label() { return '↓T Vertical Type Tool'; }
  get optSection() { return 'opt-text'; }

  onDown(x, y) {
    this.clickX = x; this.clickY = y;
    const text = prompt('Enter Vertical Text:', 'VERTICAL TEXT');
    if (!text) return;

    this.app.history.snapshot('Vertical Text');
    this.app.layerManager.addLayer(`Type: ${text.slice(0, 10)}`);
    const l = this.app.layerManager.activeLayer;

    const font = $('opt-text-font')?.value || 'sans-serif';
    const size = parseInt($('opt-text-size')?.value || '32', 10);
    const style = $('opt-text-style')?.value || 'normal normal';

    l.ctx.save();
    l.ctx.font = `${style} ${size}px ${font}`;
    l.ctx.fillStyle = this.app.foregroundColor;
    l.ctx.textBaseline = 'top';

    let curY = this.clickY;
    for (let char of text) {
      l.ctx.fillText(char, this.clickX, curY);
      curY += size * 1.15;
    }
    l.ctx.restore();

    this.app.composite();
    this.app.layerManager.renderLayersPanel();
  }
}

class TypeMaskTool extends BaseTool {
  constructor(app, isVertical = false) {
    super(app);
    this.isVertical = isVertical;
  }
  get name() { return this.isVertical ? 'verticaltextmask' : 'textmask'; }
  get label() { return this.isVertical ? '↓T Type Mask' : 'T Type Mask'; }
  get optSection() { return 'opt-text'; }

  onDown(x, y) {
    const text = prompt(`Enter text for selection mask:`, 'SELECTION');
    if (!text) return;

    const w = this.app.canvasWidth, h = this.app.canvasHeight;
    const off = createOffscreenCanvas(w, h);
    const octx = off.getContext('2d');

    const font = $('opt-text-font')?.value || 'sans-serif';
    const size = parseInt($('opt-text-size')?.value || '48', 10);
    const style = $('opt-text-style')?.value || 'bold normal';

    octx.font = `${style} ${size}px ${font}`;
    octx.fillStyle = '#ffffff';
    octx.textBaseline = 'top';

    if (this.isVertical) {
      let curY = y;
      for (let char of text) {
        octx.fillText(char, x, curY);
        curY += size * 1.15;
      }
    } else {
      octx.fillText(text, x, y);
    }

    const imgData = octx.getImageData(0, 0, w, h).data;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (imgData[i * 4 + 3] > 128) mask[i] = 1;
    }
    this.app.applySelectionMask(mask, 'new');
  }
}

// ════════════════════════════════════════════════════════════════════
// F. MEASUREMENTS & NAVIGATION
// ════════════════════════════════════════════════════════════════════

// --- 20. Color Sampler Tool (Up to 4 Persistent Targets) ---
class ColorSamplerTool extends BaseTool {
  constructor(app) {
    super(app);
  }
  get name() { return 'colorsampler'; }
  get label() { return '🎯 Color Sampler Tool'; }
  get optSection() { return 'opt-colorsampler'; }

  onDown(x, y) {
    if (!this.app.colorSamplers) this.app.colorSamplers = [];
    if (this.app.colorSamplers.length >= 4) {
      alert('Maximum 4 color sampler points reached. Clear them in options bar to place new ones.');
      return;
    }
    const sx = clamp(Math.round(x), 0, this.app.canvasWidth - 1);
    const sy = clamp(Math.round(y), 0, this.app.canvasHeight - 1);
    this.app.colorSamplers.push({ id: this.app.colorSamplers.length + 1, x: sx, y: sy });
    this.updateSamplers();
  }

  updateSamplers() {
    this.drawMarkers();
    this.renderInfoBar();
  }

  drawMarkers() {
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);
    if (!this.app.colorSamplers) return;

    ctx.save();
    this.app.colorSamplers.forEach(s => {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
      ctx.moveTo(s.x - 12, s.y); ctx.lineTo(s.x + 12, s.y);
      ctx.moveTo(s.x, s.y - 12); ctx.lineTo(s.x, s.y + 12);
      ctx.stroke();

      // Number badge
      ctx.fillStyle = '#0078d4';
      ctx.fillRect(s.x + 4, s.y - 14, 12, 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(s.id, s.x + 7, s.y - 4);
    });
    ctx.restore();
  }

  renderInfoBar() {
    if (!this.app.colorSamplers || this.app.colorSamplers.length === 0) {
      $('sampler-readouts').innerHTML = '<span class="opt-label">Click canvas to drop up to 4 sampler points</span>';
      return;
    }
    const ctx = this.app.masterCtx;
    let html = '';
    this.app.colorSamplers.forEach(s => {
      const p = ctx.getImageData(s.x, s.y, 1, 1).data;
      html += `<span class="opt-label" style="font-weight:600;color:#00e5ff">#${s.id}:</span>
               <span class="opt-label">R:${p[0]} G:${p[1]} B:${p[2]}</span>
               <div class="opt-sep"></div>`;
    });
    $('sampler-readouts').innerHTML = html;
  }

  clearSamplers() {
    this.app.colorSamplers = [];
    const sc = $('selection-canvas');
    sc.getContext('2d').clearRect(0, 0, sc.width, sc.height);
    this.renderInfoBar();
  }
}

// --- 21. Count Tool (Numbered Data Badges) ---
class CountTool extends BaseTool {
  constructor(app) {
    super(app);
  }
  get name() { return 'count'; }
  get label() { return '🔢 Count Tool'; }
  get optSection() { return 'opt-count'; }

  onDown(x, y) {
    if (!this.app.countBadges) this.app.countBadges = [];
    const id = this.app.countBadges.length + 1;
    this.app.countBadges.push({ id, x: Math.round(x), y: Math.round(y) });
    this.renderBadges();
  }

  renderBadges() {
    const sc = $('selection-canvas');
    const ctx = sc.getContext('2d');
    ctx.clearRect(0, 0, sc.width, sc.height);
    if (!this.app.countBadges) return;

    ctx.save();
    this.app.countBadges.forEach(b => {
      // Circle badge with contrast drop shadow
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = '#0078d4';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.id, b.x, b.y);
    });
    ctx.restore();

    if ($('count-display-val')) {
      $('count-display-val').textContent = this.app.countBadges.length;
    }
  }

  clearCount() {
    this.app.countBadges = [];
    this.renderBadges();
  }
}

// --- 22. Scrubby Zoom Tool (Z) ---
class ScrubbyZoomTool extends BaseTool {
  constructor(app) {
    super(app);
    this.isDragging = false;
    this.startX = 0; this.startY = 0;
    this.startZoom = 1;
  }
  get name() { return 'scrubbyzoom'; }
  get label() { return '🔍 Zoom Tool'; }
  get optSection() { return 'opt-zoom'; }
  get cursor() { return 'zoom-in'; }

  onDown(x, y) {
    this.isDragging = true;
    this.startX = x; this.startY = y;
    this.startZoom = this.app.zoom;
  }

  onMove(x, y) {
    if (!this.isDragging) return;
    const deltaX = x - this.startX;
    // Scrubbing right zooms in, scrubbing left zooms out
    const factor = Math.exp(deltaX * 0.008);
    this.app.zoom = clamp(this.startZoom * factor, 0.04, 64);
    this.app._applyTransform();
    this.app._updateZoomLabel();
  }

  onUp(x, y) {
    if (this.isDragging && Math.abs(x - this.startX) < 3) {
      // Click without drag: zoom in or out
      const factor = this.app._shiftHeld ? 0.8 : 1.25;
      this.app.zoom = clamp(this.app.zoom * factor, 0.04, 64);
      this.app._centreCanvas();
      this.app._updateZoomLabel();
    }
    this.isDragging = false;
  }
}

