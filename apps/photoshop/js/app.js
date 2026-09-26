/**
 * app.js — Phase 4: Main AkshPhotoshop application class
 * Orchestrates all subsystems: layers, history, tools, adjustments, selection engine, UI
 * Aksh Photoshop — Integrated with Aksh Studio Platform
 */
'use strict';

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio",
    storageBucket: "aksh-studio.firebasestorage.app",
    messagingSenderId: "349325785973",
    appId: "1:349325785973:web:86d5a15bcb700bfc15b13c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "../../index.html";
    }
});

class AkshPhotoshop {
  constructor() {
    this.canvasWidth  = 800;
    this.canvasHeight = 600;

    this.zoom  = 1.0;
    this.panX  = 0;
    this.panY  = 0;

    this.foregroundColor = '#000000';
    this.backgroundColor = '#ffffff';

    this.isPanning  = false;
    this.spaceHeld  = false;
    this._shiftHeld = false;
    this.panStartX  = 0; this.panStartY  = 0;
    this.panStartTX = 0; this.panStartTY = 0;

    // Unified 1D selection mask (Uint8Array of size canvasWidth * canvasHeight)
    this.selectionMask   = null;
    this._boundaryPixels = [];
    this._antsAnimId     = null;
    this._antsOffset     = 0;

    this.masterCanvas     = $('master-canvas');
    this.masterCtx        = this.masterCanvas.getContext('2d', { willReadFrequently: true });
    this.selCanvas        = $('selection-canvas');
    this.selCtx           = this.selCanvas.getContext('2d');
    this.viewport         = $('canvas-viewport');
    this.transformWrapper = $('canvas-transform-wrapper');
    this.checkerboard     = $('checkerboard');

    this.history      = new HistoryManager(this);
    this.layerManager = new LayerManager(this);
    this.adjustments  = new ImageAdjustments(this);
    this.toolManager  = new ToolManager(this);

    // Register all tools (Phase 1, 2, 3 & 4 Full Suite)
    [
      new BrushTool(this),
      new EraserTool(this),
      new FillTool(this),
      new EyedropperTool(this),
      new TextTool(this),
      new MoveTool(this),
      new MarqueeTool(this),
      new CloneStampTool(this),
      new MagicWandTool(this),
      new GradientTool(this),
      new FreeTransformTool(this),
      // Phase 3
      new LassoTool(this),
      new PolygonalLassoTool(this),
      new ColorReplacementTool(this),
      new MagicColorEraserTool(this),
      // Phase 4
      new EllipticalMarqueeTool(this),
      new SpotHealingTool(this),
      new RedEyeTool(this),
      new SmudgeTool(this),
      new DodgeTool(this),
      new BurnTool(this),
      new CropTool(this),
      new RulerTool(this),
      new HandTool(this),
      new RotateViewTool(this),
      new ShapeTool(this, 'rect'),
      new ShapeTool(this, 'ellipse'),
      new ShapeTool(this, 'line'),
      // Phase 4 Advanced Suite
      new SingleRowMarqueeTool(this),
      new SingleColumnMarqueeTool(this),
      new MagneticLassoTool(this),
      new QuickSelectionTool(this),
      new ObjectSelectionTool(this),
      new PerspectiveCropTool(this),
      new SliceTool(this),
      new SliceSelectTool(this),
      new FrameTool(this, 'rect'),
      new FrameTool(this, 'ellipse'),
      new HealingBrushTool(this),
      new PatchTool(this),
      new ContentAwareMoveTool(this),
      new PatternStampTool(this),
      new PencilTool(this),
      new MixerBrushTool(this),
      new HistoryBrushTool(this),
      new SpongeTool(this),
      new PenTool(this),
      new PathSelectionTool(this),
      new DirectSelectionTool(this),
      new VerticalTypeTool(this),
      new TypeMaskTool(this, false),
      new TypeMaskTool(this, true),
      new ColorSamplerTool(this),
      new CountTool(this),
      new ScrubbyZoomTool(this)
    ].forEach(t => this.toolManager.register(t));

    this._init();
  }

  get layers()      { return this.layerManager; }
  get tools()       { return this.toolManager; }
  get width()       { return this.canvasWidth; }
  get height()      { return this.canvasHeight; }
  get activeLayer() { return this.layerManager.activeLayer; }
  getActiveLayer()  { return this.layerManager.activeLayer; }
  get hasSelection(){ return !!this.selectionMask; }

  // ════════════════════════════════════════════════════════════════════
  // INITIALIZATION & THEME
  // ════════════════════════════════════════════════════════════════════

  _init() {
    this._setupThemeSync();
    this._setupCanvasDOM();
    this._createInitialLayer();
    this._bindViewportEvents();
    this._bindMenus();
    this._bindPanelControls();
    this._bindToolOptions();
    this._bindKeyboard();
    this._bindDragDrop();
    this.toolManager.setActive('brush');
    this.history.snapshot('Initial State');
    this.fitToScreen();
    this._updateStatusBar();
  }

  _setupThemeSync() {
    const applyTheme = (theme) => {
      const themeBtn = $('theme-toggle');
      if (theme === 'light') {
        document.body.classList.add('light-theme');
        if (themeBtn) themeBtn.innerText = '🌙';
      } else {
        document.body.classList.remove('light-theme');
        if (themeBtn) themeBtn.innerText = '☀️';
      }
    };

    const getStoredTheme = () => {
      return localStorage.getItem('theme') || localStorage.getItem('aksh-theme') || 'dark';
    };

    // Apply initially
    applyTheme(getStoredTheme());

    // Bind Toggle Button
    const themeBtn = $('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isLight = document.body.classList.contains('light-theme');
        const newTheme = isLight ? 'dark' : 'light';
        applyTheme(newTheme);
        localStorage.setItem('aksh-theme', newTheme);
        localStorage.setItem('theme', newTheme);
      });
    }

    // Auto-update if changed from the dashboard in another tab
    window.addEventListener('storage', () => {
      applyTheme(getStoredTheme());
    });
  }

  _setupCanvasDOM() {
    this.masterCanvas.width  = this.canvasWidth;
    this.masterCanvas.height = this.canvasHeight;
    this.selCanvas.width     = this.canvasWidth;
    this.selCanvas.height    = this.canvasHeight;
    this.checkerboard.style.width  = this.canvasWidth  + 'px';
    this.checkerboard.style.height = this.canvasHeight + 'px';
  }

  _createInitialLayer() {
    this.layerManager.addLayer('Background');
    const l = this.layerManager.activeLayer;
    l.ctx.fillStyle = '#ffffff';
    l.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.composite();
  }

  // ════════════════════════════════════════════════════════════════════
  // UNIFIED SELECTION MASK ENGINE & MARCHING ANTS
  // ════════════════════════════════════════════════════════════════════

  setSelectionMask(mask) {
    this.selectionMask = mask;
    this._boundaryPixels = [];
    if (!mask) {
      this._stopMarchingAnts();
      this.selCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
      return;
    }

    const w = this.canvasWidth;
    const h = this.canvasHeight;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!mask[i]) continue;
        const left   = x > 0     ? mask[i - 1] : 0;
        const right  = x < w - 1 ? mask[i + 1] : 0;
        const top    = y > 0     ? mask[i - w] : 0;
        const bottom = y < h - 1 ? mask[i + w] : 0;
        if (!left || !right || !top || !bottom) {
          this._boundaryPixels.push([x, y]);
        }
      }
    }

    if (this._boundaryPixels.length > 0) {
      this._startMarchingAnts();
    } else {
      this._stopMarchingAnts();
      this.selCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    }
  }

  applySelectionMask(newMask, mode = 'new') {
    const total = this.canvasWidth * this.canvasHeight;
    if (mode === 'add' && this.selectionMask && this.selectionMask.length === total) {
      for (let i = 0; i < total; i++) {
        if (newMask[i]) this.selectionMask[i] = 1;
      }
      this.setSelectionMask(this.selectionMask);
    } else if (mode === 'subtract' && this.selectionMask && this.selectionMask.length === total) {
      for (let i = 0; i < total; i++) {
        if (newMask[i]) this.selectionMask[i] = 0;
      }
      this.setSelectionMask(this.selectionMask);
    } else {
      this.setSelectionMask(newMask);
    }
  }

  clearSelection() {
    this.selectionMask = null;
    this._boundaryPixels = [];
    this._stopMarchingAnts();
    this.selCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.toolManager.tools['marquee']?.clearSelection();
    this.toolManager.tools['magicwand']?.clearSelection();
  }

  invertSelection() {
    const total = this.canvasWidth * this.canvasHeight;
    const m = this.toolManager.tools['marquee'];

    if (this.selectionMask) {
      for (let i = 0; i < total; i++) {
        this.selectionMask[i] = this.selectionMask[i] ? 0 : 1;
      }
      this.setSelectionMask(this.selectionMask);
    } else if (m && m.hasSelection) {
      const mask = new Uint8Array(total);
      for (let y = 0; y < this.canvasHeight; y++) {
        for (let x = 0; x < this.canvasWidth; x++) {
          const inMarquee = (x >= m.selX && x < m.selX + m.selW && y >= m.selY && y < m.selY + m.selH);
          mask[y * this.canvasWidth + x] = inMarquee ? 0 : 1;
        }
      }
      m.clearSelection();
      this.setSelectionMask(mask);
    } else {
      const mask = new Uint8Array(total);
      mask.fill(1);
      this.setSelectionMask(mask);
    }
  }

  _startMarchingAnts() {
    this._stopMarchingAnts();
    const tick = () => {
      this._antsOffset = (this._antsOffset + 0.3) % 6;
      this._drawMarchingAnts();
      this._antsAnimId = requestAnimationFrame(tick);
    };
    this._antsAnimId = requestAnimationFrame(tick);
  }

  _stopMarchingAnts() {
    if (this._antsAnimId !== null) {
      cancelAnimationFrame(this._antsAnimId);
      this._antsAnimId = null;
    }
  }

  _drawMarchingAnts() {
    if (!this._boundaryPixels || this._boundaryPixels.length === 0) return;
    const ctx = this.selCtx;
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    ctx.save();
    for (let k = 0; k < this._boundaryPixels.length; k++) {
      const [px, py] = this._boundaryPixels[k];
      const phase = Math.floor(((px + py) + Math.abs(Math.floor(this._antsOffset))) % 6);
      ctx.fillStyle = phase < 3 ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.85)';
      ctx.fillRect(px, py, 1, 1);
    }
    ctx.restore();
  }

  // ════════════════════════════════════════════════════════════════════
  // VIEWPORT EVENTS & CAMERA LIMITS
  // ════════════════════════════════════════════════════════════════════

  _bindViewportEvents() {
    const vp = this.viewport;

    vp.addEventListener('mousedown',  e => this._onMouseDown(e));
    vp.addEventListener('mousemove',  e => this._onMouseMove(e));
    vp.addEventListener('mouseup',    e => this._onMouseUp(e));
    vp.addEventListener('mouseleave', e => this._onMouseUp(e));
    vp.addEventListener('wheel',      e => this._onWheel(e), { passive: false });
    vp.addEventListener('contextmenu', e => { e.preventDefault(); this._showContextMenu(e); });

    vp.addEventListener('touchstart', e => { e.preventDefault(); this._onMouseDown(this._touchAsMouseEvent(e)); }, { passive: false });
    vp.addEventListener('touchmove',  e => { e.preventDefault(); this._onMouseMove(this._touchAsMouseEvent(e)); }, { passive: false });
    vp.addEventListener('touchend',   e => { e.preventDefault(); this._onMouseUp({}); }, { passive: false });

    document.addEventListener('click', e => {
      if (!e.target.closest('.menu-item')) {
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
      }
      if (!e.target.closest('#context-menu')) {
        $('context-menu').classList.remove('open');
      }
      document.querySelectorAll('.tool-group').forEach(g => g.classList.remove('flyout-open'));
    });

    document.querySelectorAll('.tool-group.has-flyout').forEach(group => {
      group.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll('.tool-group').forEach(g => g.classList.remove('flyout-open'));
        group.classList.add('flyout-open');
      });

      let pressTimer = null;
      group.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          pressTimer = setTimeout(() => {
            document.querySelectorAll('.tool-group').forEach(g => g.classList.remove('flyout-open'));
            group.classList.add('flyout-open');
          }, 350);
        }
      });
      group.addEventListener('mouseup', () => clearTimeout(pressTimer));
      group.addEventListener('mouseleave', () => clearTimeout(pressTimer));
    });
  }

  _touchAsMouseEvent(e) {
    const t = e.touches[0];
    return { clientX: t.clientX, clientY: t.clientY, button: 0, ctrlKey: false, shiftKey: false, preventDefault: () => {} };
  }

  _getCanvasCoords(e) {
    const rect = this.viewport.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left  - this.panX) / this.zoom,
      y: (e.clientY - rect.top   - this.panY) / this.zoom
    };
  }

  _onMouseDown(e) {
    this._shiftHeld = e.shiftKey;

    if (this.spaceHeld || e.button === 1) {
      e.preventDefault();
      this.isPanning  = true;
      this.panStartX  = e.clientX;
      this.panStartY  = e.clientY;
      this.panStartTX = this.panX;
      this.panStartTY = this.panY;
      this.viewport.classList.add('panning');
      return;
    }
    if (e.button !== 0) return;

    const { x, y } = this._getCanvasCoords(e);
    this.toolManager.activeTool?.onDown(x, y);
  }

  _onMouseMove(e) {
    const { x, y } = this._getCanvasCoords(e);

    const cx = Math.round(x), cy = Math.round(y);
    if (cx >= 0 && cy >= 0 && cx < this.canvasWidth && cy < this.canvasHeight) {
      $('cursor-pos').textContent = `X: ${cx}  Y: ${cy}`;
    }

    if (this.isPanning) {
      this.panX = this.panStartTX + (e.clientX - this.panStartX);
      this.panY = this.panStartTY + (e.clientY - this.panStartY);
      
      // FIXED: Prevent infinite panning so canvas never gets lost
      const panLimit = 4000;
      this.panX = Math.max(-panLimit, Math.min(this.panX, panLimit));
      this.panY = Math.max(-panLimit, Math.min(this.panY, panLimit));

      this._applyTransform();
      return;
    }

    this.toolManager.activeTool?.onMove(x, y);
  }

  _onMouseUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      this.viewport.classList.remove('panning');
      return;
    }
    const { x = 0, y = 0 } = e.clientX !== undefined ? this._getCanvasCoords(e) : {};
    this.toolManager.activeTool?.onUp(x, y);
    this.layerManager.renderLayersPanel();
  }

  _onWheel(e) {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      const rect  = this.viewport.getBoundingClientRect();
      const mx    = e.clientX - rect.left;
      const my    = e.clientY - rect.top;
      const oldZ  = this.zoom;
      
      // Smoother zoom steps
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      
      // FIXED: Clamp zoom strictly between 10% (0.1) and 1500% (15) to prevent extreme shrinking/growing
      this.zoom = Math.max(0.1, Math.min(this.zoom * delta, 15));

      this.panX = mx - (mx - this.panX) * (this.zoom / oldZ);
      this.panY = my - (my - this.panY) * (this.zoom / oldZ);
    } else {
      this.panX -= e.deltaX;
      this.panY -= e.deltaY;
    }

    // FIXED: Prevent infinite panning so canvas never gets lost
    const panLimit = 4000;
    this.panX = Math.max(-panLimit, Math.min(this.panX, panLimit));
    this.panY = Math.max(-panLimit, Math.min(this.panY, panLimit));

    this._applyTransform();
    this._updateZoomLabel();
  }

  // ════════════════════════════════════════════════════════════════════
  // TRANSFORM & VIEW
  // ════════════════════════════════════════════════════════════════════

  _applyTransform() {
    this.transformWrapper.style.transform =
      `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  fitToScreen() {
    const vp = this.viewport.getBoundingClientRect();
    const sx  = (vp.width  - 40) / this.canvasWidth;
    const sy  = (vp.height - 40) / this.canvasHeight;
    this.zoom = Math.max(0.1, Math.min(sx, sy, 15)); // Clamped correctly
    this.panX = (vp.width  - this.canvasWidth  * this.zoom) / 2;
    this.panY = (vp.height - this.canvasHeight * this.zoom) / 2;
    this._applyTransform();
    this._updateZoomLabel();
  }

  _centreCanvas() {
    const vp  = this.viewport.getBoundingClientRect();
    this.panX = (vp.width  - this.canvasWidth  * this.zoom) / 2;
    this.panY = (vp.height - this.canvasHeight * this.zoom) / 2;
    this._applyTransform();
  }

  _updateZoomLabel() {
    $('zoom-display').textContent = Math.round(this.zoom * 100) + '%';
  }

  // ════════════════════════════════════════════════════════════════════
  // COMPOSITING
  // ════════════════════════════════════════════════════════════════════

  composite() {
    const ctx = this.masterCtx;
    const w   = this.canvasWidth;
    const h   = this.canvasHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    this.layerManager.layers
      .filter(l => l.visible)
      .forEach(l => {
        if (l.mask && l.maskEnabled) {
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
  }

  // ════════════════════════════════════════════════════════════════════
  // COLOR
  // ════════════════════════════════════════════════════════════════════

  setForegroundColor(hex) {
    this.foregroundColor = hex;
    $('fg-color-display').style.background       = hex;
    $('fg-color-picker').value                   = hex;
    $('opt-brush-color-swatch').style.background = hex;
    $('opt-brush-color').value                   = hex;
    $('opt-fill-color-swatch').style.background  = hex;
    $('opt-fill-color').value                    = hex;
    $('opt-text-color-swatch').style.background  = hex;
    $('opt-text-color').value                    = hex;
  }

  setBackgroundColor(hex) {
    this.backgroundColor = hex;
    $('bg-color-display').style.background = hex;
    $('bg-color-picker').value = hex;
  }

  // ════════════════════════════════════════════════════════════════════
  // FILE OPERATIONS
  // ════════════════════════════════════════════════════════════════════

  newCanvas(w, h, bg) {
    if (!confirm(`Create a new ${w}×${h} canvas?\nUnsaved changes will be lost.`)) return;
    this.canvasWidth  = w;
    this.canvasHeight = h;
    this._setupCanvasDOM();
    this.layerManager.layers      = [];
    this.layerManager.activeIndex = 0;
    this.layerManager.addLayer('Background');

    const l = this.layerManager.activeLayer;
    if (bg === 'white') { l.ctx.fillStyle = '#ffffff'; l.ctx.fillRect(0, 0, w, h); }
    if (bg === 'black') { l.ctx.fillStyle = '#000000'; l.ctx.fillRect(0, 0, w, h); }

    this.clearSelection();
    this.composite();
    this.history.stack  = [];
    this.history.cursor = -1;
    this.history.snapshot('New Canvas');
    this.fitToScreen();
    this._updateStatusBar();
    $('app-title').textContent = `Aksh Photoshop — ${w} × ${h}`;
  }

  openImage(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        this.canvasWidth  = img.width;
        this.canvasHeight = img.height;
        this._setupCanvasDOM();

        this.layerManager.layers      = [];
        this.layerManager.activeIndex = 0;
        this.layerManager.addLayer('Background');

        const l = this.layerManager.activeLayer;
        l.ctx.drawImage(img, 0, 0);

        this.clearSelection();
        this.composite();
        this.history.stack  = [];
        this.history.cursor = -1;
        this.history.snapshot('Open Image');
        this.history.render();
        this.fitToScreen();
        this._updateStatusBar();
        $('app-title').textContent = `Aksh Photoshop — ${file.name}`;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  exportPNG() {
    this.composite();
    const a = document.createElement('a');
    a.href     = this.masterCanvas.toDataURL('image/png');
    a.download = 'aksh-photoshop.png';
    a.click();
  }

  exportJPEG() {
    const tmp  = createOffscreenCanvas(this.canvasWidth, this.canvasHeight);
    const tctx = tmp.getContext('2d');
    tctx.fillStyle = '#ffffff';
    tctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.composite();
    tctx.drawImage(this.masterCanvas, 0, 0);
    const a = document.createElement('a');
    a.href     = tmp.toDataURL('image/jpeg', 0.92);
    a.download = 'aksh-photoshop.jpg';
    a.click();
  }

  exportSlices() {
    if (!this.slices || this.slices.length === 0) {
      alert('No slices created yet! Select the Slice Tool (🔪) to draw slices on the canvas first.');
      return;
    }
    this.composite();
    this.slices.forEach(s => {
      const sliceC = createOffscreenCanvas(s.w, s.h);
      sliceC.getContext('2d').drawImage(this.masterCanvas, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
      const a = document.createElement('a');
      a.href = sliceC.toDataURL('image/png');
      a.download = `slice_${s.id}.png`;
      a.click();
    });
  }

  _resizeCanvas(nw, nh, anchor) {
    this.layerManager.resizeAll(nw, nh, anchor);
    this.canvasWidth  = nw;
    this.canvasHeight = nh;
    this._setupCanvasDOM();
    this.clearSelection();
    this.composite();
    this.layerManager.renderLayersPanel();
    this.fitToScreen();
    this._updateStatusBar();
  }

  // ════════════════════════════════════════════════════════════════════
  // MENU BINDING & ACTION DISPATCH
  // ════════════════════════════════════════════════════════════════════

  _bindMenus() {
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', e => {
        e.stopPropagation();
        const wasActive = item.classList.contains('active');
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
        if (!wasActive) item.classList.add('active');
      });
    });

    document.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
        this._dispatch(el.dataset.action);
      });
    });

    document.querySelectorAll('[data-ctx]').forEach(el => {
      el.addEventListener('click', () => {
        $('context-menu').classList.remove('open');
        this._dispatch(el.dataset.ctx);
      });
    });
  }

  _dispatch(action) {
    const lm   = this.layerManager;
    const hist = this.history;

    switch (action) {
      // ── File ──
      case 'file-new':          this._openModal('modal-new'); break;
      case 'file-open':         $('file-input').click(); break;
      case 'file-export-png':   this.exportPNG(); break;
      case 'file-export-jpeg':  this.exportJPEG(); break;

      // ── Edit ──
      case 'edit-undo': hist.undo(); break;
      case 'edit-redo': hist.redo(); break;
      case 'edit-clear': {
        hist.snapshot('Clear Layer');
        const al = lm.activeLayer;
        if (al) { al.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight); this.composite(); }
        break;
      }
      case 'edit-free-transform':
        this.toolManager.setActive('freetransform');
        this.toolManager.tools['freetransform'].engage();
        break;

      // ── Image ──
      case 'image-adjustments': this._openAdjModal(); break;
      case 'image-hsl':         this._openHSLModal(); break;
      case 'image-invert':
        hist.snapshot('Invert'); this.adjustments.invert(); break;
      case 'image-grayscale':
        hist.snapshot('Grayscale'); this.adjustments.grayscale(); break;
      case 'image-sepia':
        hist.snapshot('Sepia'); this.adjustments.sepia(); break;
      case 'image-sharpen':     this._openModal('modal-sharpen'); break;
      case 'image-emboss':      this._openModal('modal-emboss'); break;
      case 'image-blur':        this._openModal('modal-blur'); break;
      case 'image-resize':      this._openResizeModal(); break;

      // ── Phase 3 Image Actions ──
      case 'image-remove-bg':
        hist.snapshot('Remove Background');
        this.adjustments.removeBackground();
        break;
      case 'image-color-to-alpha':
        this._openColorToAlphaModal();
        break;
      case 'image-replace-color':
        this._openReplaceColorModal();
        break;

      // ── Select Menu Actions ──
      case 'select-all':
        this.toolManager.setActive('marquee');
        this.toolManager.tools['marquee'].selectAll();
        break;
      case 'select-deselect':
      case 'deselect':
        this.clearSelection();
        break;
      case 'select-invert':
        this.invertSelection();
        break;
      case 'select-color-range':
        this._openColorRangeModal();
        break;

      // ── Layer ──
      case 'layer-new':        hist.snapshot('New Layer');       lm.addLayer(); break;
      case 'layer-duplicate':  hist.snapshot('Duplicate Layer'); lm.duplicateLayer(); break;
      case 'layer-delete':     hist.snapshot('Delete Layer');    lm.deleteLayer(); break;
      case 'layer-merge-down': hist.snapshot('Merge Down');      lm.mergeDown(); break;
      case 'layer-flatten':    hist.snapshot('Flatten');         lm.flatten(); break;

      // ── Layer Masks ──
      case 'layer-mask-add':    hist.snapshot('Add Mask');    lm.addMask();    break;
      case 'layer-mask-delete': hist.snapshot('Delete Mask'); lm.deleteMask(); break;
      case 'layer-mask-toggle': lm.toggleMask(); break;
      case 'layer-mask-apply':  hist.snapshot('Apply Mask');  lm.applyMask();  break;

      // ── View ──
      case 'view-zoom-in':
        this.zoom = Math.max(0.1, Math.min(this.zoom * 1.1, 15));
        this._centreCanvas(); this._updateZoomLabel(); break;
      case 'view-zoom-out':
        this.zoom = Math.max(0.1, Math.min(this.zoom * 0.9, 15));
        this._centreCanvas(); this._updateZoomLabel(); break;
      case 'view-zoom-fit':  this.fitToScreen(); break;
      case 'view-zoom-100':
        this.zoom = 1; this._centreCanvas(); this._updateZoomLabel(); break;

      default:
        console.warn('Unknown action:', action);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // PANEL CONTROLS & MODALS BINDING
  // ════════════════════════════════════════════════════════════════════

  _bindPanelControls() {
    ['layers-panel', 'history-panel'].forEach(id => {
      const panel  = $(id);
      const header = $(`${id}-header`);
      if (header) header.addEventListener('click', () => panel.classList.toggle('collapsed'));
    });

    $('layer-add-btn').addEventListener('click', () => {
      this.history.snapshot('New Layer'); this.layerManager.addLayer();
    });
    $('layer-dupe-btn').addEventListener('click', () => {
      this.history.snapshot('Duplicate Layer'); this.layerManager.duplicateLayer();
    });
    $('layer-del-btn').addEventListener('click', () => {
      this.history.snapshot('Delete Layer'); this.layerManager.deleteLayer();
    });

    // Layer Mask buttons
    $('mask-add-btn').addEventListener('click', () => this._dispatch('layer-mask-add'));$('mask-del-btn').addEventListener('click', () => this._dispatch('layer-mask-delete'));
    $('mask-toggle-btn').addEventListener('click', () => this._dispatch('layer-mask-toggle'));$('mask-apply-btn').addEventListener('click', () => this._dispatch('layer-mask-apply'));

    $('layer-blend-mode').addEventListener('change', e => {
      const l = this.layerManager.activeLayer;
      if (l) { l.blendMode = e.target.value; this.composite(); }
    });

    $('layer-opacity').addEventListener('input', e => {
      const l = this.layerManager.activeLayer;
      if (l) {
        l.opacity = parseInt(e.target.value, 10) / 100;
        $('layer-opacity-val').textContent = e.target.value + '%';
        this.composite();
      }
    });

    // Modal close listeners
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._closeModal(btn.dataset.closeModal);
      });
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) this._closeModal(overlay.id);
      });
      overlay.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.stopPropagation(); this._closeModal(overlay.id); }
        e.stopPropagation();
      });
    });

    // New canvas confirm
    $('new-canvas-confirm').addEventListener('click', () => {
      const w  = parseInt($('new-canvas-width').value, 10);
      const h  = parseInt($('new-canvas-height').value, 10);
      const bg = $('new-canvas-bg').value;
      if (w > 0 && h > 0) { this._closeModal('modal-new'); this.newCanvas(w, h, bg); }
    });

    // Brightness / Contrast
    $('adj-brightness').addEventListener('input', e => { $('adj-brightness-val').textContent = e.target.value; });$('adj-contrast').addEventListener('input',   e => { $('adj-contrast-val').textContent   = e.target.value; });$('adj-apply').addEventListener('click', () => {
      this.history.snapshot('Brightness/Contrast');
      this.adjustments.adjustBrightnessContrast(
        parseInt($('adj-brightness').value, 10),
        parseInt($('adj-contrast').value,   10)
      );
      this._closeModal('modal-adjustments');
    });

    // Gaussian Blur
    $('blur-radius').addEventListener('input', e => { $('blur-radius-val').textContent = e.target.value; });$('blur-apply').addEventListener('click', () => {
      this.history.snapshot('Gaussian Blur');
      this.adjustments.gaussianBlur(parseInt($('blur-radius').value, 10));
      this._closeModal('modal-blur');
    });

    // HSL
    ['hsl-hue', 'hsl-sat', 'hsl-lgt'].forEach(id => {
      $(id).addEventListener('input', e => {$(`${id}-val`).textContent = e.target.value; });
    });
    $('hsl-apply').addEventListener('click', () => {
      this.history.snapshot('Hue/Saturation/Lightness');
      this.adjustments.adjustHSL(
        parseInt($('hsl-hue').value, 10),
        parseInt($('hsl-sat').value, 10),
        parseInt($('hsl-lgt').value, 10)
      );
      this._closeModal('modal-hsl');
    });

    // Sharpen
    $('sharpen-strength').addEventListener('input', e => { $('sharpen-strength-val').textContent = e.target.value; });$('sharpen-apply').addEventListener('click', () => {
      this.history.snapshot('Sharpen');
      this.adjustments.sharpen(parseInt($('sharpen-strength').value, 10) / 100);
      this._closeModal('modal-sharpen');
    });

    // Emboss
    $('emboss-strength').addEventListener('input', e => { $('emboss-strength-val').textContent = e.target.value; });$('emboss-apply').addEventListener('click', () => {
      this.history.snapshot('Emboss');
      this.adjustments.emboss(parseInt($('emboss-strength').value, 10) / 100);
      this._closeModal('modal-emboss');
    });

    // Canvas Resize
    $('resize-confirm').addEventListener('click', () => {
      const nw = parseInt($('resize-width').value, 10);
      const nh = parseInt($('resize-height').value, 10);
      if (nw > 0 && nh > 0) {
        this.history.snapshot('Canvas Resize');
        this._resizeCanvas(nw, nh, $('resize-anchor').value);
        this._closeModal('modal-resize');
      }
    });

    // ── PHASE 3 MODALS BINDING ──

    // Color to Alpha Modal
    $('c2a-tolerance').addEventListener('input', e => { $('c2a-tolerance-val').textContent = e.target.value; });$('c2a-feather').addEventListener('input',   e => { $('c2a-feather-val').textContent   = e.target.value; });$('c2a-color-swatch').addEventListener('click', () => $('c2a-color').click());$('c2a-color').addEventListener('input', e => { $('c2a-color-swatch').style.background = e.target.value; });$('c2a-apply').addEventListener('click', () => {
      this.history.snapshot('Color to Alpha');
      this.adjustments.colorToAlpha(
        $('c2a-color').value,
        parseInt($('c2a-tolerance').value, 10),
        parseInt($('c2a-feather').value, 10)
      );
      this._closeModal('modal-color-to-alpha');
    });

    // Replace Color Modal
    $('replace-src-swatch').addEventListener('click', () => $('replace-src-color').click());$('replace-src-color').addEventListener('input', e => { $('replace-src-swatch').style.background = e.target.value; });$('replace-dst-swatch').addEventListener('click', () => $('replace-dst-color').click());$('replace-dst-color').addEventListener('input', e => { $('replace-dst-swatch').style.background = e.target.value; });$('replace-fuzziness').addEventListener('input', e => { $('replace-fuzziness-val').textContent = e.target.value; });$('replace-color-apply').addEventListener('click', () => {
      this.history.snapshot('Replace Color');
      this.adjustments.replaceColor(
        $('replace-src-color').value,
        $('replace-dst-color').value,
        parseInt($('replace-fuzziness').value, 10)
      );
      this._closeModal('modal-replace-color');
    });

    // Color Range Modal
    $('color-range-swatch').addEventListener('click', () => $('color-range-color').click());$('color-range-color').addEventListener('input', e => { $('color-range-swatch').style.background = e.target.value; });$('color-range-fuzziness').addEventListener('input', e => { $('color-range-fuzziness-val').textContent = e.target.value; });$('color-range-apply').addEventListener('click', () => {
      this.adjustments.selectColorRange(
        $('color-range-color').value,
        parseInt($('color-range-fuzziness').value, 10),$('color-range-invert').checked
      );
      this._closeModal('modal-color-range');
    });

    // File input
    $('file-input').addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) this.openImage(f);
      e.target.value = '';
    });

    $('zoom-display').addEventListener('click', () => this.fitToScreen());

    // Color pickers
    $('fg-color-display').addEventListener('click', e => { e.stopPropagation(); $('fg-color-picker').click(); });$('fg-color-picker').addEventListener('input', e => this.setForegroundColor(e.target.value));

    $('bg-color-display').addEventListener('click', e => { e.stopPropagation(); $('bg-color-picker').click(); });$('bg-color-picker').addEventListener('input', e => this.setBackgroundColor(e.target.value));

    $('reset-colors-btn').addEventListener('click', e => {
      e.stopPropagation();
      this.setForegroundColor('#000000');
      this.setBackgroundColor('#ffffff');
    });
    $('swap-colors-btn').addEventListener('click', e => {
      e.stopPropagation();
      const tmp = this.foregroundColor;
      this.setForegroundColor(this.backgroundColor);
      this.setBackgroundColor(tmp);
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // TOOL OPTIONS BINDING
  // ════════════════════════════════════════════════════════════════════

  _bindToolOptions() {
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => this.toolManager.setActive(btn.dataset.tool));
    });

    // Range ↔ number input sync pairs
    [
      ['opt-brush-size',           'opt-brush-size-num'],
      ['opt-brush-hardness',       'opt-brush-hardness-num'],
      ['opt-brush-opacity',        'opt-brush-opacity-num'],
      ['opt-eraser-size',          'opt-eraser-size-num'],
      ['opt-eraser-opacity',       'opt-eraser-opacity-num'],
      ['opt-fill-tolerance',       'opt-fill-tolerance-num'],
      ['opt-marquee-feather',      'opt-marquee-feather-num'],
      ['opt-clonestamp-size',      'opt-clonestamp-size-num'],
      ['opt-clonestamp-opacity',   'opt-clonestamp-opacity-num'],
      ['opt-wand-tolerance',       'opt-wand-tolerance-num'],
      ['opt-gradient-opacity',     'opt-gradient-opacity-num'],
      // Phase 3
      ['opt-colorreplace-size',      'opt-colorreplace-size-num'],
      ['opt-colorreplace-tolerance', 'opt-colorreplace-tolerance-num'],
      ['opt-magiceraser-tolerance',  'opt-magiceraser-tolerance-num'],
      ['opt-magiceraser-feather',    'opt-magiceraser-feather-num']
    ].forEach(([r, n]) => syncRangeNumber(r, n));

    // Color swatches
    const bindSwatch = (swatchId, inputId) => {
      const swatch = $(swatchId), input =$(inputId);
      if (!swatch || !input) return;
      swatch.addEventListener('click', () => input.click());
      input.addEventListener('input', () => {
        swatch.style.background = input.value;
        this.setForegroundColor(input.value);
      });
    };
    bindSwatch('opt-brush-color-swatch', 'opt-brush-color');
    bindSwatch('opt-fill-color-swatch',  'opt-fill-color');
    bindSwatch('opt-text-color-swatch',  'opt-text-color');

    // Polygonal Lasso tool options buttons
    $('opt-polylasso-close')?.addEventListener('click', () => {
      this.toolManager.tools['polylasso']?.closePolygon();
    });
    $('opt-polylasso-cancel')?.addEventListener('click', () => {
      this.toolManager.tools['polylasso']?.cancel();
    });

    // Text overlay keyboard handling
    $('text-input-overlay').addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); this.toolManager.tools['text'].cancel(); }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.toolManager.tools['text'].commit(); }
    });

    // Free Transform tool options buttons
    $('opt-transform-apply')?.addEventListener('click', () => {
      if (this.toolManager.tools['freetransform']?.isActive) {
        this.toolManager.tools['freetransform'].commit();
      }
    });
    $('opt-transform-cancel')?.addEventListener('click', () => {
      if (this.toolManager.tools['freetransform']?.isActive) {
        this.toolManager.tools['freetransform'].cancel();
      }
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS
  // ════════════════════════════════════════════════════════════════════

  _bindKeyboard() {
    document.addEventListener('keydown', e => {
      if (document.querySelector('.modal-overlay.open')) return;

      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === ' ') {
        e.preventDefault();
        this.spaceHeld = true;
        this.viewport.classList.add('space-held');
        return;
      }

      this._shiftHeld = e.shiftKey;

      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey) {
          switch (e.key.toLowerCase()) {
            case 'i': e.preventDefault(); this.invertSelection(); return;
            case 'n': e.preventDefault(); this.history.snapshot('New Layer'); this.layerManager.addLayer(); return;
            case 'z': e.preventDefault(); this.history.redo(); return;
          }
        }
        switch (e.key.toLowerCase()) {
          case 'z': e.preventDefault(); this.history.undo(); return;
          case 'y': e.preventDefault(); this.history.redo(); return;
          case 'n': e.preventDefault(); this._openModal('modal-new'); return;
          case 'o': e.preventDefault(); $('file-input').click(); return;
          case 'e': e.preventDefault(); this.exportPNG(); return;
          case 'i': e.preventDefault(); this.history.snapshot('Invert'); this.adjustments.invert(); return;
          case 't': e.preventDefault(); this._dispatch('edit-free-transform'); return;
          case '=': case '+': e.preventDefault(); this._dispatch('view-zoom-in');  return;
          case '-':           e.preventDefault(); this._dispatch('view-zoom-out'); return;
          case '0':           e.preventDefault(); this.fitToScreen();  return;
          case '1':           e.preventDefault(); this._dispatch('view-zoom-100'); return;
          case 'a':           e.preventDefault(); this._dispatch('select-all'); return;
          case 'd':           e.preventDefault(); this.clearSelection(); return;
        }
        return;
      }

      // Free Transform: Enter commits, Escape cancels
      if (this.toolManager.activeTool?.name === 'freetransform' && this.toolManager.activeTool.isActive) {
        if (e.key === 'Enter')  { e.preventDefault(); this.toolManager.activeTool.commit(); return; }
        if (e.key === 'Escape') { e.preventDefault(); this.toolManager.activeTool.cancel(); return; }
      }

      // Polygonal Lasso: Escape cancels
      if (this.toolManager.activeTool?.name === 'polylasso') {
        if (e.key === 'Escape') { e.preventDefault(); this.toolManager.activeTool.cancel(); return; }
      }

      // Single-key tool shortcuts
      switch (e.key.toLowerCase()) {
        case 'b': this.toolManager.setActive('brush');       break;
        case 'e': this.toolManager.setActive('eraser');      break;
        case 'g': this.toolManager.setActive('gradient');    break;
        case 'f': this.toolManager.setActive('fill');        break;
        case 'i': this.toolManager.setActive('eyedropper');  break;
        case 't': this.toolManager.setActive('text');        break;
        case 'v': this.toolManager.setActive('move');        break;
        case 'm': this.toolManager.setActive('marquee');     break;
        case 's': this.toolManager.setActive('clonestamp');  break;
        case 'w': this.toolManager.setActive('magicwand');   break;
        case 'l': this.toolManager.setActive('lasso');       break;
        case 'c': this.toolManager.setActive('crop');        break;
        case 'j': this.toolManager.setActive('spothealing'); break;
        case 'y': this.toolManager.setActive('historybrush');break;
        case 'p': this.toolManager.setActive('pen');         break;
        case 'a': this.toolManager.setActive('pathselect');  break;
        case 'u': this.toolManager.setActive('shape_rect');  break;
        case 'k': this.toolManager.setActive('frame_rect');  break;
        case 'h': this.toolManager.setActive('hand');        break;
        case 'z': this.toolManager.setActive('scrubbyzoom'); break;
        case 'o': this.toolManager.setActive('dodge');       break;
        case 'r': this.toolManager.setActive('rotateview');  break;

        case 'x': {
          const tmp = this.foregroundColor;
          this.setForegroundColor(this.backgroundColor);
          this.setBackgroundColor(tmp);
          break;
        }
        case 'd':
          this.setForegroundColor('#000000');
          this.setBackgroundColor('#ffffff');
          break;

        case 'delete':
        case 'backspace': {
          e.preventDefault();
          this.history.snapshot('Clear Selection / Layer');
          const al = this.layerManager.activeLayer;
          if (al) {
            if (this.selectionMask) {
              // Delete pixels within selection mask
              const imgData = al.ctx.getImageData(0, 0, this.canvasWidth, this.canvasHeight);
              const d = imgData.data;
              for (let p = 0; p < this.selectionMask.length; p++) {
                if (this.selectionMask[p]) d[p * 4 + 3] = 0;
              }
              al.ctx.putImageData(imgData, 0, 0);
            } else {
              al.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
            }
            this.composite();
            this.layerManager.renderLayersPanel();
          }
          break;
        }

        case '[': {
          const s = $('opt-brush-size');
          if (s) {
            s.value = Math.max(1, parseInt(s.value, 10) - 5);
            $('opt-brush-size-num').value = s.value;
          }
          break;
        }
        case ']': {
          const s = $('opt-brush-size');
          if (s) {
            s.value = Math.min(200, parseInt(s.value, 10) + 5);
            $('opt-brush-size-num').value = s.value;
          }
          break;
        }
      }
    });

    document.addEventListener('keyup', e => {
      if (e.key === ' ') {
        this.spaceHeld = false;
        this.viewport.classList.remove('space-held');
        this.updateCursor();
      }
      if (e.key === 'Shift') { this._shiftHeld = false; }
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // DRAG & DROP
  // ════════════════════════════════════════════════════════════════════

  _bindDragDrop() {
    const body    = document.body;
    const overlay = $('drop-overlay');
    let counter   = 0;

    body.addEventListener('dragenter', e => {
      if (e.dataTransfer.types.includes('Files')) {
        counter++;
        overlay.classList.add('active');
      }
    });
    body.addEventListener('dragleave', () => {
      counter--;
      if (counter <= 0) { counter = 0; overlay.classList.remove('active'); }
    });
    body.addEventListener('dragover', e => e.preventDefault());
    body.addEventListener('drop', e => {
      e.preventDefault();
      counter = 0;
      overlay.classList.remove('active');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) this.openImage(file);
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // MODAL OPENERS & HELPERS
  // ════════════════════════════════════════════════════════════════════

  _openModal(id)  { $(id).classList.add('open'); }
  _closeModal(id) { $(id).classList.remove('open'); }

  _openAdjModal() {
    $('adj-brightness').value         = 0;
    $('adj-contrast').value           = 0;
    $('adj-brightness-val').textContent = '0';$('adj-contrast-val').textContent   = '0';
    this._openModal('modal-adjustments');
  }

  _openHSLModal() {
    $('hsl-hue').value = 0; $('hsl-hue-val').textContent = '0';
    $('hsl-sat').value = 0; $('hsl-sat-val').textContent = '0';
    $('hsl-lgt').value = 0; $('hsl-lgt-val').textContent = '0';
    this._openModal('modal-hsl');
  }

  _openResizeModal() {
    $('resize-width').value  = this.canvasWidth;
    $('resize-height').value = this.canvasHeight;
    this._openModal('modal-resize');
  }

  _openColorToAlphaModal() {
    $('c2a-color').value = this.foregroundColor;
    $('c2a-color-swatch').style.background = this.foregroundColor;
    $('c2a-tolerance').value = 30;
    $('c2a-tolerance-val').textContent = '30';$('c2a-feather').value = 5;
    $('c2a-feather-val').textContent = '5';
    this._openModal('modal-color-to-alpha');
  }

  _openReplaceColorModal() {
    $('replace-src-color').value = this.backgroundColor;
    $('replace-src-swatch').style.background = this.backgroundColor;
    $('replace-dst-color').value = this.foregroundColor;
    $('replace-dst-swatch').style.background = this.foregroundColor;
    $('replace-fuzziness').value = 40;
    $('replace-fuzziness-val').textContent = '40';
    this._openModal('modal-replace-color');
  }

  _openColorRangeModal() {
    $('color-range-color').value = this.foregroundColor;
    $('color-range-swatch').style.background = this.foregroundColor;
    $('color-range-fuzziness').value = 40;
    $('color-range-fuzziness-val').textContent = '40';$('color-range-invert').checked = false;
    this._openModal('modal-color-range');
  }

  _updateStatusBar() {
    $('canvas-size-display').textContent  = `${this.canvasWidth} × ${this.canvasHeight}`;
    $('active-layer-display').textContent = this.layerManager.activeLayer?.name || '';
    this._updateZoomLabel();
  }

  updateCursor() {
    const tool = this.toolManager.activeTool;
    this.viewport.style.cursor = tool?.cursor ?? 'crosshair';
  }

  _showContextMenu(e) {
    const cm     = $('context-menu');
    const vpRect = document.body.getBoundingClientRect();
    let left = e.clientX, top = e.clientY;
    if (left + 190 > vpRect.width)  left = vpRect.width  - 195;
    if (top  + 220 > vpRect.height) top  = vpRect.height - 225;
    cm.style.left = left + 'px';
    cm.style.top  = top  + 'px';
    cm.classList.add('open');
  }
}

// ════════════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════════════
function boot() {
  if (!window.aksh) {
    window.AkshPhotoshop = AkshPhotoshop;
    window.aksh = new AkshPhotoshop();
    window.app  = window.aksh;

    console.log('%c🎨 Aksh Photoshop v4.0 — Professional Suite', 'color:#0078d4;font-size:16px;font-weight:bold;');
    console.log('%cIntegrated with Aksh Studio Platform (Firebase Auth, Theme Continuity, 55 Tools)', 'color:#aaa;font-size:11px;');
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
