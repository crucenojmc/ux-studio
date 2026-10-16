// CIEDE2000 and sRGB -> CIELAB conversion tests for assets/delta-e.mjs.
// Reference pairs: G. Sharma, W. Wu, E. N. Dalal, "The CIEDE2000 Color-Difference Formula:
// Implementation Notes, Supplementary Test Data, and Mathematical Observations",
// Color Research and Application 30(1):21-30, 2005.
// Data file: https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/dataNprograms/ciede2000testdata.txt
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(HERE, '../../plugins/ux-studio/skills/implementation-fidelity/assets');
const { deltaE2000, srgbToLab, parseColor, deltaE2000Css, toHex } = await import(
  pathToFileURL(path.join(ASSETS, 'delta-e.mjs')).href
);

// L1 a1 b1 L2 a2 b2 dE00 — all 34 pairs of the published test data.
const SHARMA = [
  [50.0, 2.6772, -79.7751, 50.0, 0.0, -82.7485, 2.0425],
  [50.0, 3.1571, -77.2803, 50.0, 0.0, -82.7485, 2.8615],
  [50.0, 2.8361, -74.02, 50.0, 0.0, -82.7485, 3.4412],
  [50.0, -1.3802, -84.2814, 50.0, 0.0, -82.7485, 1.0],
  [50.0, -1.1848, -84.8006, 50.0, 0.0, -82.7485, 1.0],
  [50.0, -0.9009, -85.5211, 50.0, 0.0, -82.7485, 1.0],
  [50.0, 0.0, 0.0, 50.0, -1.0, 2.0, 2.3669],
  [50.0, -1.0, 2.0, 50.0, 0.0, 0.0, 2.3669],
  [50.0, 2.49, -0.001, 50.0, -2.49, 0.0009, 7.1792],
  [50.0, 2.49, -0.001, 50.0, -2.49, 0.001, 7.1792],
  [50.0, 2.49, -0.001, 50.0, -2.49, 0.0011, 7.2195],
  [50.0, 2.49, -0.001, 50.0, -2.49, 0.0012, 7.2195],
  [50.0, -0.001, 2.49, 50.0, 0.0009, -2.49, 4.8045],
  [50.0, -0.001, 2.49, 50.0, 0.001, -2.49, 4.8045],
  [50.0, -0.001, 2.49, 50.0, 0.0011, -2.49, 4.7461],
  [50.0, 2.5, 0.0, 50.0, 0.0, -2.5, 4.3065],
  [50.0, 2.5, 0.0, 73.0, 25.0, -18.0, 27.1492],
  [50.0, 2.5, 0.0, 61.0, -5.0, 29.0, 22.8977],
  [50.0, 2.5, 0.0, 56.0, -27.0, -3.0, 31.903],
  [50.0, 2.5, 0.0, 58.0, 24.0, 15.0, 19.4535],
  [50.0, 2.5, 0.0, 50.0, 3.1736, 0.5854, 1.0],
  [50.0, 2.5, 0.0, 50.0, 3.2972, 0.0, 1.0],
  [50.0, 2.5, 0.0, 50.0, 1.8634, 0.5757, 1.0],
  [50.0, 2.5, 0.0, 50.0, 3.2592, 0.335, 1.0],
  [60.2574, -34.0099, 36.2677, 60.4626, -34.1751, 39.4387, 1.2644],
  [63.0109, -31.0961, -5.8663, 62.8187, -29.7946, -4.0864, 1.263],
  [61.2901, 3.7196, -5.3901, 61.4292, 2.248, -4.962, 1.8731],
  [35.0831, -44.1164, 3.7933, 35.0232, -40.0716, 1.5901, 1.8645],
  [22.7233, 20.0904, -46.694, 23.0331, 14.973, -42.5619, 2.0373],
  [36.4612, 47.858, 18.3852, 36.2715, 50.5065, 21.2231, 1.4146],
  [90.8027, -2.0831, 1.441, 91.1528, -1.6435, 0.0447, 1.4441],
  [90.9257, -0.5406, -0.9208, 88.6381, -0.8985, -0.7239, 1.5381],
  [6.7747, -0.2908, -2.4247, 5.8714, -0.0985, -2.2286, 0.6377],
  [2.0776, 0.0795, -1.135, 0.9033, -0.0636, -0.5514, 0.9082],
];

test('CIEDE2000 matches the 34 Sharma-Wu-Dalal (2005) reference pairs to 4 decimals', () => {
  SHARMA.forEach(([L1, a1, b1, L2, a2, b2, expected], i) => {
    const got = deltaE2000({ L: L1, a: a1, b: b1 }, { L: L2, a: a2, b: b2 });
    assert.ok(Math.abs(got - expected) < 1e-4, `pair ${i + 1}: expected ${expected}, got ${got.toFixed(6)}`);
  });
});

test('CIEDE2000 is symmetric and zero for identical colours', () => {
  const p = { L: 60.2574, a: -34.0099, b: 36.2677 };
  const q = { L: 60.4626, a: -34.1751, b: 39.4387 };
  assert.equal(deltaE2000(p, p), 0);
  assert.ok(Math.abs(deltaE2000(p, q) - deltaE2000(q, p)) < 1e-12);
});

test('sRGB -> CIELAB (D65) on known anchors', () => {
  const near = (got, want, tol, label) => assert.ok(Math.abs(got - want) <= tol, `${label}: want ${want}, got ${got}`);
  const white = srgbToLab({ r: 255, g: 255, b: 255 });
  near(white.L, 100, 0.01, 'white L');
  near(white.a, 0, 0.01, 'white a');
  near(white.b, 0, 0.01, 'white b');
  const black = srgbToLab({ r: 0, g: 0, b: 0 });
  near(black.L, 0, 1e-9, 'black L');
  // Pure sRGB red, D65 reference white: L* 53.24, a* 80.09, b* 67.20 (rounded, widely published).
  const red = srgbToLab({ r: 255, g: 0, b: 0 });
  near(red.L, 53.24, 0.05, 'red L');
  near(red.a, 80.09, 0.1, 'red a');
  near(red.b, 67.2, 0.1, 'red b');
});

test('parseColor reads hex, rgb()/rgba() in comma and space syntax, and transparent', () => {
  assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor('#0F172A'), { r: 15, g: 23, b: 42, a: 1 });
  assert.deepEqual(parseColor('#00000080'), { r: 0, g: 0, b: 0, a: 128 / 255 });
  assert.deepEqual(parseColor('rgb(220, 38, 38)'), { r: 220, g: 38, b: 38, a: 1 });
  assert.deepEqual(parseColor('rgba(0, 0, 0, 0.5)'), { r: 0, g: 0, b: 0, a: 0.5 });
  assert.deepEqual(parseColor('rgb(255 0 0 / 50%)'), { r: 255, g: 0, b: 0, a: 0.5 });
  assert.deepEqual(parseColor('transparent'), { r: 0, g: 0, b: 0, a: 0 });
  assert.equal(parseColor('not-a-colour'), null);
});

test('deltaE2000Css compares CSS strings and composites alpha over the background', () => {
  assert.equal(deltaE2000Css('#0f172a', 'rgb(15, 23, 42)'), 0);
  assert.ok(deltaE2000Css('#0f172a', '#334155') > 2, 'two slate inks are perceptibly different');
  assert.ok(deltaE2000Css('#f8fafc', '#f7f9fb') < 1, 'one step on each channel is below 1');
  // Fully transparent over white equals white.
  assert.equal(deltaE2000Css('transparent', '#ffffff'), 0);
  assert.throws(() => deltaE2000Css('bogus', '#fff'), /colour/i);
  assert.equal(toHex({ r: 220, g: 38, b: 38, a: 1 }), '#dc2626');
});
