/**
 * utils.js — Shared utility functions & color space math
 * Aksh Photoshop — Phase 3
 */
'use strict';

/**
 * Shorthand for document.getElementById
 * @param {string} id
 * @returns {HTMLElement}
 */
const $ = id => document.getElementById(id);

/**
 * Clamp a value between lo and hi (inclusive)
 */
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * Convert 6-digit hex color string to {r,g,b,a} object
 * @param {string} hex  e.g. "#ff3300"
 */
function hexToRgba(hex) {
  if (!hex || hex.length < 7) return { r: 0, g: 0, b: 0, a: 255 };
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return { r, g, b, a: 255 };
}

/**
 * Convert r,g,b integers (0–255) to a 6-digit hex string
 */
function rgbaToHex(r, g, b) {
  return '#' + [r, g, b]
    .map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create a blank offscreen <canvas> of given dimensions
 * @param {number} w
 * @param {number} h
 * @returns {HTMLCanvasElement}
 */
function createOffscreenCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

/**
 * Sync a range input value to a paired number input (bi-directional)
 * @param {string} rangeId
 * @param {string} numId
 */
function syncRangeNumber(rangeId, numId) {
  const rangeEl = $(rangeId);
  const numEl   = $(numId);
  if (!rangeEl || !numEl) return;

  rangeEl.addEventListener('input', () => { numEl.value = rangeEl.value; });
  numEl.addEventListener('input', () => {
    numEl.value   = clamp(parseInt(numEl.value, 10) || 0, parseInt(rangeEl.min, 10), parseInt(rangeEl.max, 10));
    rangeEl.value = numEl.value;
  });
}

// ──────────────────────────────────────────────────────────────────────
// COLOR SPACE CONVERSIONS: RGB ⇄ HSL
// ──────────────────────────────────────────────────────────────────────

/**
 * Convert sRGB (0–255) to HSL ({ h: 0–360, s: 0–1, l: 0–1 })
 */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  let l = (max + min) / 2;
  let s = 0;
  if (chroma !== 0) {
    s = chroma / (1 - Math.abs(2 * l - 1));
  }
  let h = 0;
  if (chroma !== 0) {
    if (max === r) {
      h = ((g - b) / chroma) % 6;
      if (h < 0) h += 6;
    } else if (max === g) {
      h = (b - r) / chroma + 2;
    } else {
      h = (r - g) / chroma + 4;
    }
    h *= 60; // 0–360 degrees
  }
  return { h, s, l };
}

/**
 * Convert HSL ({ h: 0–360, s: 0–1, l: 0–1 }) to sRGB ({ r, g, b } in 0–255)
 */
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 1);
  l = clamp(l, 0, 1);

  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const hPrime = h / 60;
  const x = chroma * (1 - Math.abs((hPrime % 2) - 1));
  let r = 0, g = 0, b = 0;

  if      (hPrime >= 0 && hPrime < 1) { r = chroma; g = x;      b = 0; }
  else if (hPrime >= 1 && hPrime < 2) { r = x;      g = chroma; b = 0; }
  else if (hPrime >= 2 && hPrime < 3) { r = 0;      g = chroma; b = x; }
  else if (hPrime >= 3 && hPrime < 4) { r = 0;      g = x;      b = chroma; }
  else if (hPrime >= 4 && hPrime < 5) { r = x;      g = 0;      b = chroma; }
  else if (hPrime >= 5 && hPrime < 6) { r = chroma; g = 0;      b = x; }

  const m = l - chroma / 2;
  return {
    r: clamp(Math.round((r + m) * 255), 0, 255),
    g: clamp(Math.round((g + m) * 255), 0, 255),
    b: clamp(Math.round((b + m) * 255), 0, 255)
  };
}

// ──────────────────────────────────────────────────────────────────────
// COLOR SPACE CONVERSIONS: RGB ⇄ CIELAB & Delta-E
// ──────────────────────────────────────────────────────────────────────

/**
 * Convert sRGB to CIELAB using D65 reference white
 */
function rgbToLab(r, g, b) {
  // sRGB to linear RGB
  let vr = r / 255, vg = g / 255, vb = b / 255;
  vr = vr > 0.04045 ? Math.pow((vr + 0.055) / 1.055, 2.4) : vr / 12.92;
  vg = vg > 0.04045 ? Math.pow((vg + 0.055) / 1.055, 2.4) : vg / 12.92;
  vb = vb > 0.04045 ? Math.pow((vb + 0.055) / 1.055, 2.4) : vb / 12.92;

  // Linear RGB to XYZ (D65)
  const x = vr * 0.4124564 + vg * 0.3575761 + vb * 0.1804375;
  const y = vr * 0.2126729 + vg * 0.7151522 + vb * 0.0721750;
  const z = vr * 0.0193339 + vg * 0.1191920 + vb * 0.9503041;

  // Normalize by D65 reference white (Xn=0.95047, Yn=1.0, Zn=1.08883)
  const xr = x / 0.95047, yr = y / 1.00000, zr = z / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

  const fx = f(xr), fy = f(yr), fz = f(zr);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
}

/**
 * Calculate CIE76 Delta-E (perceptual color distance) between two sRGB colors
 */
function colorDeltaE(r1, g1, b1, r2, g2, b2) {
  const lab1 = rgbToLab(r1, g1, b1);
  const lab2 = rgbToLab(r2, g2, b2);
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

// ──────────────────────────────────────────────────────────────────────
// POLYGON GEOMETRY
// ──────────────────────────────────────────────────────────────────────

/**
 * Standard Ray-Casting algorithm for point-in-polygon testing (Even-Odd rule)
 * @param {number} x
 * @param {number} y
 * @param {Array<{x:number, y:number}>} points
 * @returns {boolean}
 */
function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
