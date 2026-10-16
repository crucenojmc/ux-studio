// CIEDE2000 colour difference for CSS colours. Pure ES module, no dependencies.
//
//   parseColor('rgb(15 23 42 / 50%)')   -> { r, g, b, a }        (r,g,b 0..255, a 0..1) or null
//   srgbToLab({ r, g, b })              -> { L, a, b }           (CIELAB, D65, 2° observer)
//   deltaE2000(lab1, lab2)              -> number                (Sharma, Wu & Dalal 2005)
//   deltaE2000Css('#0f172a', '#334155') -> number                (alpha composited over a background)
//
// Formula and reference data: G. Sharma, W. Wu, E. N. Dalal, "The CIEDE2000 Color-Difference
// Formula: Implementation Notes, Supplementary Test Data, and Mathematical Observations",
// Color Research and Application 30(1):21-30, 2005.

const RAD = Math.PI / 180;
const POW25_7 = 25 ** 7;

/** Parse a CSS colour string: #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() (comma or space syntax), transparent. */
export function parseColor(input) {
  if (input && typeof input === 'object' && 'r' in input) return { a: 1, ...input };
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (s.startsWith('#')) return parseHex(s.slice(1));
  const m = s.match(/^rgba?\((.*)\)$/);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const channel = (p) => (p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p));
  const alpha = (p) => (p === undefined ? 1 : p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p));
  const out = { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alpha(parts[3]) };
  return Object.values(out).some(Number.isNaN) ? null : out;
}

function parseHex(h) {
  if (!/^[0-9a-f]+$/.test(h) || ![3, 4, 6, 8].includes(h.length)) return null;
  const full = h.length <= 4 ? [...h].map((c) => c + c).join('') : h;
  const n = (i) => parseInt(full.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) / 255 : 1 };
}

/** Composite a colour with alpha over an opaque background (both {r,g,b,a}). */
export function compositeOver(color, background = { r: 255, g: 255, b: 255, a: 1 }) {
  const a = color.a ?? 1;
  return {
    r: color.r * a + background.r * (1 - a),
    g: color.g * a + background.g * (1 - a),
    b: color.b * a + background.b * (1 - a),
    a: 1,
  };
}

const linear = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const labF = (t) => (t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29);

// IEC 61966-2-1 sRGB -> XYZ matrix; the reference white is the sum of each row, so #fff maps to L 100, a 0, b 0.
const M = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
];
const WHITE = M.map((row) => row[0] + row[1] + row[2]);

/** sRGB (0..255 channels) -> CIELAB under D65. Alpha is ignored: composite first. */
export function srgbToLab({ r, g, b }) {
  const rgb = [linear(r), linear(g), linear(b)];
  const [x, y, z] = M.map((row, i) => (row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]) / WHITE[i]);
  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

const hueDeg = (b, ap) => {
  if (b === 0 && ap === 0) return 0;
  const h = Math.atan2(b, ap) / RAD;
  return h < 0 ? h + 360 : h;
};

/** CIEDE2000 between two CIELAB colours. kL, kC, kH are the parametric factors (1 for reference conditions). */
export function deltaE2000(lab1, lab2, { kL = 1, kC = 1, kH = 1 } = {}) {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const Cbar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + POW25_7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = hueDeg(b1, a1p);
  const h2p = hueDeg(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * RAD);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp;
  if (C1p * C2p === 0) hbarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
  else hbarp = (h1p + h2p - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * RAD) +
    0.24 * Math.cos(2 * hbarp * RAD) +
    0.32 * Math.cos((3 * hbarp + 6) * RAD) -
    0.2 * Math.cos((4 * hbarp - 63) * RAD);
  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + POW25_7));
  const SL = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(2 * dTheta * RAD) * RC;

  const l = dLp / (kL * SL);
  const c = dCp / (kC * SC);
  const h = dHp / (kH * SH);
  return Math.sqrt(l * l + c * c + h * h + RT * c * h);
}

/**
 * CIEDE2000 between two CSS colours (strings or {r,g,b,a}). Translucent colours are composited
 * over `background` (default white) first, so the number describes what is painted on that background.
 */
export function deltaE2000Css(c1, c2, { background = '#ffffff' } = {}) {
  const p = parseColor(c1);
  const q = parseColor(c2);
  const bg = parseColor(background);
  if (!p) throw new Error(`Unrecognised colour: ${c1}`);
  if (!q) throw new Error(`Unrecognised colour: ${c2}`);
  if (!bg) throw new Error(`Unrecognised colour: ${background}`);
  return deltaE2000(srgbToLab(compositeOver(p, bg)), srgbToLab(compositeOver(q, bg)));
}

/** {r,g,b,a} -> '#rrggbb' or '#rrggbbaa' when translucent. */
export function toHex({ r, g, b, a = 1 }) {
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}${a < 1 ? h(a * 255) : ''}`;
}
