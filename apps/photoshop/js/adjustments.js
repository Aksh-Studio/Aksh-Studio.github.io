/**
 * adjustments.js — Phase 3: Pixel-buffer image adjustments, convolution filters,
 * color replacement, color-to-alpha, background removal, and color range selection.
 * Aksh Photoshop
 */
'use strict';

class ImageAdjustments {
  /**
   * @param {AkshPhotoshop} app
   */
  constructor(app) { this.app = app; }

  /** @private */
  _getCtx() { return this.app.layerManager.activeLayer?.ctx ?? null; }

  // ──────────────────────────────────────────────────────────────────────
  // BRIGHTNESS / CONTRAST
  // ──────────────────────────────────────────────────────────────────────

  adjustBrightnessContrast(brightness, contrast) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const { canvasWidth: w, canvasHeight: h } = this.app;
    const imgData = ctx.getImageData(0, 0, w, h);
    const d       = imgData.data;

    const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < d.length; i += 4) {
      d[i]   = clamp(cf * (d[i]   + brightness - 128) + 128, 0, 255);
      d[i+1] = clamp(cf * (d[i+1] + brightness - 128) + 128, 0, 255);
      d[i+2] = clamp(cf * (d[i+2] + brightness - 128) + 128, 0, 255);
    }

    ctx.putImageData(imgData, 0, 0);
    this.app.composite();
  }

  // ──────────────────────────────────────────────────────────────────────
  // INVERT
  // ──────────────────────────────────────────────────────────────────────

  invert() {
    const ctx = this._getCtx();
    if (!ctx) return;
    const { canvasWidth: w, canvasHeight: h } = this.app;
    const imgData = ctx.getImageData(0, 0, w, h);
    const d       = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
      d[i]   = 255 - d[i];
      d[i+1] = 255 - d[i+1];
      d[i+2] = 255 - d[i+2];
    }

    ctx.putImageData(imgData, 0, 0);
    this.app.composite();
  }

  // ──────────────────────────────────────────────────────────────────────
  // GRAYSCALE (ITU-R BT.601 luminosity)
  // ──────────────────────────────────────────────────────────────────────

  grayscale() {
    const ctx = this._getCtx();
    if (!ctx) return;
    const { canvasWidth: w, canvasHeight: h } = this.app;
    const imgData = ctx.getImageData(0, 0, w, h);
    const d       = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
      d[i] = d[i+1] = d[i+2] = lum;
    }

    ctx.putImageData(imgData, 0, 0);
    this.app.composite();
  }

  // ──────────────────────────────────────────────────────────────────────
  // SEPIA
  // ──────────────────────────────────────────────────────────────────────

  sepia() {
    const ctx = this._getCtx();
    if (!ctx) return;
    const { canvasWidth: w, canvasHeight: h } = this.app;
    const imgData = ctx.getImageData(0, 0, w, h);
    const d       = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      d[i]   = clamp(r * 0.393 + g * 0.769 + b * 0.189, 0, 255);
      d[i+1] = clamp(r * 0.349 + g * 0.686 + b * 0.168, 0, 255);
      d[i+2] = clamp(r * 0.272 + g * 0.534 + b * 0.131, 0, 255);
    }

    ctx.putImageData(imgData, 0, 0);
    this.app.composite();
  }

  // ──────────────────────────────────────────────────────────────────────
  // GAUSSIAN BLUR (3 box-blur passes)
  // ──────────────────────────────────────────────────────────────────────

  gaussianBlur(radius) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const { canvasWidth: w, canvasHeight: h } = this.app;
    let imgData = ctx.getImageData(0, 0, w, h);
    for (let pass = 0; pass < 3; pass++) {
      imgData = this._boxBlur(imgData, w, h, Math.round(radius));
    }
    ctx.putImageData(imgData, 0, 0);
    this.app.composite();
  }

  _boxBlur(imgData, w, h, r) {
    const src = new Uint8ClampedArray(imgData.data);
    const tmp = new Uint8ClampedArray(imgData.data.length);
    const dst = new Uint8ClampedArray(imgData.data.length);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let rS = 0, gS = 0, bS = 0, aS = 0, count = 0;
        for (let dx = -r; dx <= r; dx++) {
          const nx = clamp(x + dx, 0, w - 1);
          const i  = (y * w + nx) * 4;
          rS += src[i]; gS += src[i+1]; bS += src[i+2]; aS += src[i+3];
          count++;
        }
        const i = (y * w + x) * 4;
        tmp[i] = rS/count; tmp[i+1] = gS/count; tmp[i+2] = bS/count; tmp[i+3] = aS/count;
      }
    }

    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let rS = 0, gS = 0, bS = 0, aS = 0, count = 0;
        for (let dy = -r; dy <= r; dy++) {
          const ny = clamp(y + dy, 0, h - 1);
          const i  = (ny * w + x) * 4;
          rS += tmp[i]; gS += tmp[i+1]; bS += tmp[i+2]; aS += tmp[i+3];
          count++;
        }
        const i = (y * w + x) * 4;
        dst[i] = rS/count; dst[i+1] = gS/count; dst[i+2] = bS/count; dst[i+3] = aS/count;
      }
    }

    return new ImageData(dst, w, h);
  }

  // ──────────────────────────────────────────────────────────────────────
  // HUE / SATURATION / LIGHTNESS
  // ──────────────────────────────────────────────────────────────────────

  adjustHSL(hue, sat, lgt) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const { canvasWidth: w, canvasHeight: h } = this.app;
    const imgData = ctx.getImageData(0, 0, w, h);
    const d       = imgData.data;

    const satDelta = sat / 100;
    const lgtDelta = lgt / 100;

    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const hsl = rgbToHsl(d[i], d[i+1], d[i+2]);
      const newH = ((hsl.h + hue) % 360 + 360) % 360;
      const newS = clamp(hsl.s + satDelta, 0, 1);
      const newL = clamp(hsl.l + lgtDelta, 0, 1);
      const rgb = hslToRgb(newH, newS, newL);
      d[i]   = rgb.r;
      d[i+1] = rgb.g;
      d[i+2] = rgb.b;
    }

    ctx.putImageData(imgData, 0, 0);
    this.app.composite();
  }

  // ──────────────────────────────────────────────────────────────────────
  // CONVOLUTION ENGINE (3×3)
  // ──────────────────────────────────────────────────────────────────────

  _convolve3x3(kernel, bias, strength = 1.0) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const { canvasWidth: w, canvasHeight: h } = this.app;
    const imgData = ctx.getImageData(0, 0, w, h);
    const src     = new Uint8ClampedArray(imgData.data);
    const dst     = imgData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let rSum = 0, gSum = 0, bSum = 0;

        for (let ky = 0; ky < 3; ky++) {
          for (let kx = 0; kx < 3; kx++) {
            const nx   = clamp(x + kx - 1, 0, w - 1);
            const ny   = clamp(y + ky - 1, 0, h - 1);
            const idx  = (ny * w + nx) * 4;
            const kVal = kernel[ky * 3 + kx];
            rSum += src[idx]     * kVal;
            gSum += src[idx + 1] * kVal;
            bSum += src[idx + 2] * kVal;
          }
        }

        const i   = (y * w + x) * 4;
        const rO  = src[i], gO = src[i+1], bO = src[i+2];
        dst[i]   = clamp(Math.round(rO * (1 - strength) + (rSum + bias) * strength), 0, 255);
        dst[i+1] = clamp(Math.round(gO * (1 - strength) + (gSum + bias) * strength), 0, 255);
        dst[i+2] = clamp(Math.round(bO * (1 - strength) + (bSum + bias) * strength), 0, 255);
      }
    }

    ctx.putImageData(imgData, 0, 0);
    this.app.composite();
  }

  sharpen(strength = 1.0) {
    const kernel = [
       0, -1,  0,
      -1,  5, -1,
       0, -1,  0
    ];
    this._convolve3x3(kernel, 0, clamp(strength, 0, 1));
  }

  emboss(strength = 1.0) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const { canvasWidth: w, canvasHeight: h } = this.app;
    const imgData = ctx.getImageData(0, 0, w, h);
    const src     = new Uint8ClampedArray(imgData.data);
    const dst     = imgData.data;

    const kernel = [
      -2, -1, 0,
      -1,  1, 1,
       0,  1, 2
    ];
    const bias = 128;
    const str  = clamp(strength, 0, 1);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let rSum = 0, gSum = 0, bSum = 0;

        for (let ky = 0; ky < 3; ky++) {
          for (let kx = 0; kx < 3; kx++) {
            const nx   = clamp(x + kx - 1, 0, w - 1);
            const ny   = clamp(y + ky - 1, 0, h - 1);
            const idx  = (ny * w + nx) * 4;
            const kVal = kernel[ky * 3 + kx];
            rSum += src[idx]     * kVal;
            gSum += src[idx + 1] * kVal;
            bSum += src[idx + 2] * kVal;
          }
        }

        const i = (y * w + x) * 4;
        const rO = src[i], gO = src[i+1], bO = src[i+2];

        const er = clamp(rSum + bias, 0, 255);
        const eg = clamp(gSum + bias, 0, 255);
        const eb = clamp(bSum + bias, 0, 255);
        const lum = 0.299 * er + 0.587 * eg + 0.114 * eb;
        const embossed = Math.round(lum);

        dst[i]   = clamp(Math.round(rO * (1 - str) + embossed * str), 0, 255);
        dst[i+1] = clamp(Math.round(gO * (1 - str) + embossed * str), 0, 255);
        dst[i+2] = clamp(Math.round(bO * (1 - str) + embossed * str), 0, 255);
      }
    }

    ctx.putImageData(imgData, 0, 0);
    this.app.composite();
  }

  // ══════════════════════════════════════════════════════════════════════
  // PHASE 3 — NEW ENGINES: BACKGROUND REMOVAL, COLOR TO ALPHA, REPLACE COLOR
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Smart client-side background removal algorithm.
   * Samples border perimeter pixels, clusters dominant background tones,
   * conducts inward multi-pass edge-matting, and applies a morphological
   * feather pass along the boundary.
   *
   * @param {number} [tolerance=36]  Color difference tolerance
   * @param {number} [edgeThreshold=45] Gradient boundary threshold
   */
  removeBackground(tolerance = 36, edgeThreshold = 45) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const w = this.app.canvasWidth;
    const h = this.app.canvasHeight;
    const imgData = ctx.getImageData(0, 0, w, h);
    const d       = imgData.data;

    // ── STEP 1: Sample perimeter border pixels to identify background palette ──
    const borderSamples = [];
    const step = Math.max(1, Math.floor((w + h) / 300));

    // Top & Bottom rows
    for (let x = 0; x < w; x += step) {
      const topIdx = (0 * w + x) * 4;
      const botIdx = ((h - 1) * w + x) * 4;
      if (d[topIdx + 3] > 10) borderSamples.push({ r: d[topIdx], g: d[topIdx+1], b: d[topIdx+2] });
      if (d[botIdx + 3] > 10) borderSamples.push({ r: d[botIdx], g: d[botIdx+1], b: d[botIdx+2] });
    }
    // Left & Right columns
    for (let y = 0; y < h; y += step) {
      const lftIdx = (y * w + 0) * 4;
      const rgtIdx = (y * w + (w - 1)) * 4;
      if (d[lftIdx + 3] > 10) borderSamples.push({ r: d[lftIdx], g: d[lftIdx+1], b: d[lftIdx+2] });
      if (d[rgtIdx + 3] > 10) borderSamples.push({ r: d[rgtIdx], g: d[rgtIdx+1], b: d[rgtIdx+2] });
    }

    if (borderSamples.length === 0) return;

    // Cluster samples into top 3 dominant reference colors
    const clusters = [];
    for (const sample of borderSamples) {
      let matched = false;
      for (const cl of clusters) {
        const dist = Math.abs(cl.r - sample.r) + Math.abs(cl.g - sample.g) + Math.abs(cl.b - sample.b);
        if (dist < 40) {
          cl.r = (cl.r * cl.count + sample.r) / (cl.count + 1);
          cl.g = (cl.g * cl.count + sample.g) / (cl.count + 1);
          cl.b = (cl.b * cl.count + sample.b) / (cl.count + 1);
          cl.count++;
          matched = true;
          break;
        }
      }
      if (!matched && clusters.length < 5) {
        clusters.push({ r: sample.r, g: sample.g, b: sample.b, count: 1 });
      }
    }
    clusters.sort((a, b) => b.count - a.count);
    const topClusters = clusters.slice(0, 3);

    // Helper: color distance to nearest background cluster
    const distToBg = (r, g, b) => {
      let minD = 9999;
      for (const cl of topClusters) {
        const dR = r - cl.r, dG = g - cl.g, dB = b - cl.b;
        const dist = Math.sqrt(dR * dR * 0.299 + dG * dG * 0.587 + dB * dB * 0.114);
        if (dist < minD) minD = dist;
      }
      return minD;
    };

    // Helper: compute local luminance gradient
    const getLum = (px, py) => {
      const i = (clamp(py, 0, h - 1) * w + clamp(px, 0, w - 1)) * 4;
      return 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
    };
    const getGradient = (px, py) => {
      const gx = Math.abs(getLum(px + 1, py) - getLum(px - 1, py));
      const gy = Math.abs(getLum(px, py + 1) - getLum(px, py - 1));
      return Math.sqrt(gx * gx + gy * gy);
    };

    // ── STEP 2: Inward multi-pass flood edge-matting ──
    const visited = new Uint8Array(w * h);
    const isBg    = new Uint8Array(w * h);
    const queue   = [];

    // Seed perimeter pixels
    for (let x = 0; x < w; x++) {
      const tPos = 0 * w + x;
      const bPos = (h - 1) * w + x;
      if (!visited[tPos]) { visited[tPos] = 1; queue.push(tPos); }
      if (!visited[bPos]) { visited[bPos] = 1; queue.push(bPos); }
    }
    for (let y = 0; y < h; y++) {
      const lPos = y * w + 0;
      const rPos = y * w + (w - 1);
      if (!visited[lPos]) { visited[lPos] = 1; queue.push(lPos); }
      if (!visited[rPos]) { visited[rPos] = 1; queue.push(rPos); }
    }

    while (queue.length > 0) {
      const pos = queue.shift();
      const px = pos % w;
      const py = Math.floor(pos / w);
      const i  = pos * 4;

      if (d[i + 3] === 0) {
        isBg[pos] = 1;
      } else {
        const bgDist = distToBg(d[i], d[i+1], d[i+2]);
        const grad   = getGradient(px, py);

        // Classify as background if color matches background clusters and gradient is not high
        if (bgDist <= tolerance && grad < edgeThreshold) {
          isBg[pos] = 1;
        } else {
          continue; // Don't propagate past strong object boundaries
        }
      }

      // Propagate inward
      const neighbors = [[px-1, py], [px+1, py], [px, py-1], [px, py+1]];
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

    // ── STEP 3: Morphological feathering along the alpha boundary ──
    // Zero out background pixels
    for (let pos = 0; pos < w * h; pos++) {
      if (isBg[pos]) {
        d[pos * 4 + 3] = 0;
      }
    }

    // Detect boundary transition pixels for 1px morphological edge antialiasing
    const originalAlpha = new Uint8Array(w * h);
    for (let pos = 0; pos < w * h; pos++) originalAlpha[pos] = d[pos * 4 + 3];

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const pos = y * w + x;
        if (originalAlpha[pos] > 0) {
          // Check if any neighbor was removed
          const n1 = (y - 1) * w + x;
          const n2 = (y + 1) * w + x;
          const n3 = y * w + (x - 1);
          const n4 = y * w + (x + 1);
          const bgNeighbors = (isBg[n1] ? 1 : 0) + (isBg[n2] ? 1 : 0) +
                              (isBg[n3] ? 1 : 0) + (isBg[n4] ? 1 : 0);
          if (bgNeighbors > 0) {
            // Feather edge pixel alpha proportionally
            const i = pos * 4;
            d[i + 3] = clamp(Math.round(d[i + 3] * (1 - (bgNeighbors * 0.18))), 40, 255);
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    this.app.composite();
    this.app.layerManager.renderLayersPanel();
  }

  /**
   * Color to Alpha (Color Remover): shifts matching pixels' alpha to 0 with feathering.
   * @param {string|{r:number, g:number, b:number}} targetColor
   * @param {number} tolerance  Threshold 0–255
   * @param {number} feather    Softness edge 0–50
   */
  colorToAlpha(targetColor, tolerance = 32, feather = 8) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const w = this.app.canvasWidth;
    const h = this.app.canvasHeight;
    const imgData = ctx.getImageData(0, 0, w, h);
    const d       = imgData.data;

    const tgt = typeof targetColor === 'string' ? hexToRgba(targetColor) : targetColor;

    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const dR = d[i]   - tgt.r;
      const dG = d[i+1] - tgt.g;
      const dB = d[i+2] - tgt.b;
      const dist = Math.sqrt(dR * dR * 0.299 + dG * dG * 0.587 + dB * dB * 0.114);

      if (dist <= tolerance) {
        d[i + 3] = 0;
      } else if (dist <= tolerance + feather && feather > 0) {
        const t = (dist - tolerance) / feather;
        d[i + 3] = clamp(Math.round(d[i + 3] * t), 0, 255);
      }
    }

    ctx.putImageData(imgData, 0, 0);
    this.app.composite();
    this.app.layerManager.renderLayersPanel();
  }

  /**
   * Replace Color: changes pixels matching srcColor to dstColor,
   * preserving original luminance and shadows.
   * @param {string} srcHex
   * @param {string} dstHex
   * @param {number} fuzziness (0–200)
   */
  replaceColor(srcHex, dstHex, fuzziness = 40) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const w = this.app.canvasWidth;
    const h = this.app.canvasHeight;
    const imgData = ctx.getImageData(0, 0, w, h);
    const d       = imgData.data;

    const src = hexToRgba(srcHex);
    const dst = hexToRgba(dstHex);
    const dstHsl = rgbToHsl(dst.r, dst.g, dst.b);
    const threshold = fuzziness * 1.8;

    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const dR = d[i]   - src.r;
      const dG = d[i+1] - src.g;
      const dB = d[i+2] - src.b;
      const dist = Math.sqrt(dR * dR * 0.299 + dG * dG * 0.587 + dB * dB * 0.114);

      if (dist <= threshold) {
        const origHsl = rgbToHsl(d[i], d[i+1], d[i+2]);
        // Shift hue and saturation to destination, keeping original luminance
        const blend = threshold > 0 ? (1 - (dist / threshold) * 0.4) : 1;
        const newH = dstHsl.h;
        const newS = origHsl.s * (1 - blend) + dstHsl.s * blend;
        const newL = origHsl.l;
        const newRgb = hslToRgb(newH, newS, newL);

        d[i]   = newRgb.r;
        d[i+1] = newRgb.g;
        d[i+2] = newRgb.b;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    this.app.composite();
    this.app.layerManager.renderLayersPanel();
  }

  /**
   * Select Color Range: creates a 1D selection mask of pixels matching target color.
   * @param {string} targetHex
   * @param {number} fuzziness (0–200)
   * @param {boolean} invert
   */
  selectColorRange(targetHex, fuzziness = 40, invert = false) {
    this.app.composite();
    const w = this.app.canvasWidth;
    const h = this.app.canvasHeight;
    const masterCtx = this.app.masterCtx;
    const imgData   = masterCtx.getImageData(0, 0, w, h);
    const d         = imgData.data;

    const tgt = hexToRgba(targetHex);
    const threshold = fuzziness * 1.8;
    const mask = new Uint8Array(w * h);

    for (let pos = 0; pos < w * h; pos++) {
      const i = pos * 4;
      if (d[i + 3] < 10) {
        mask[pos] = invert ? 1 : 0;
        continue;
      }
      const dR = d[i]   - tgt.r;
      const dG = d[i+1] - tgt.g;
      const dB = d[i+2] - tgt.b;
      const dist = Math.sqrt(dR * dR * 0.299 + dG * dG * 0.587 + dB * dB * 0.114);

      const matches = dist <= threshold;
      mask[pos] = (matches !== invert) ? 1 : 0;
    }

    this.app.setSelectionMask(mask);
  }
}
