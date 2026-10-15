// Voxel (`3d`; plik 01 sekcja 9 i plik 02: kontrolki docs; geometria i domyślne wartości: proj). Izometryczne sześciany
// (rzut 30°, bez perspektywy) na siatce heksagonalnej; trzy widoczne ściany: góra, jasna i ciemna, z osobnymi odcieniami.
// Sześcian o krawędzi s ma w rzucie sylwetkę sześciokąta (wierzchołek u góry) o promieniu s; środki: co √3·s w poziomie,
// co 1,5·s w pionie, co drugi rząd przesunięty o pół, więc przy odstępie 0 sześciany przylegają bez szczelin.
import type { EffectDef } from '../core/types.ts';
import { common, range, select, toggle } from '../core/params.ts';
import { backdrop } from '../core/compose.ts';
import { blur, clamp, lerp } from '../core/util.ts';
import { newImg } from '../core/types.ts';
import { BLENDS, blendCh } from './grid.ts';

const PX = { unit: 'px', px: true } as const;
const S3 = Math.sqrt(3);
const voxel: EffectDef = {
  id: '3d', name: 'Voxel', category: 'Pixels & Blocks', engine: '3D', phase: 2,
  description: 'Isometric cubes on a hexagonal grid; top, light and dark faces shaded separately.',
  params: [range('cubeSize', 'Cube size', 22, 4, 80, PX), range('spacing', 'Spacing', 0, 0, 20, PX), range('outline', 'Outline', 0.5, 0, 4, { ...PX, step: 0.5 }),
    range('topShade', 'Top shade', 100, 0, 150, { unit: '%' }), range('lightShade', 'Light shade', 78, 0, 150, { unit: '%' }), range('darkShade', 'Dark shade', 52, 0, 150, { unit: '%' }),
    toggle('lightFlip', 'Light from the right', false), select('blendMode', 'Blend mode', 'normal', BLENDS),
    ...common('bgMode', 'bgOpacity', 'bgBlur', 'bgColor', 'brightness', 'contrast').map((p) => (p.id === 'bgMode' ? { ...p, default: 'solid' } : p))],
  // Ściany: góra, gdy y < −|x|/√3 (romb nad środkiem); niżej lewa (x < 0) i prawa. Kolor sześcianu: obraz rozmyty o 0,5·s w środku.
  // Obrys: odległość od krawędzi sylwetki i od szwów między ścianami < outline/2, kolor 25% koloru ściany. Kolejność: rzędy od góry.
  render(ctx) {
    const s0 = ctx.prep; const { w, h } = s0; const s = Math.max(2, ctx.p.cubeSize * ctx.scale); const gap = ctx.p.spacing * ctx.scale; const ow = ctx.p.outline * ctx.scale;
    const sm = blur(s0, Math.max(1, Math.round(s * 0.5))).data; const dx = S3 * s + gap, dy = 1.5 * s + gap * (S3 / 2);
    const shade = [ctx.p.topShade / 100, ctx.p.lightShade / 100, ctx.p.darkShade / 100]; const flip = ctx.p.lightFlip;
    const layer = newImg(w, h, [0, 0, 0, 0]); const L = layer.data; let cubes = 0; const hx = (S3 / 2) * s;
    for (let j = -1; j * dy <= h + s; j++) for (let i = -1; i * dx <= w + hx; i++) {
      const cx = i * dx + (j & 1 ? dx / 2 : 0), cy = j * dy; if (cx < -hx || cy < -s || cx > w + hx || cy > h + s) continue; cubes++;
      const sx = clamp(Math.floor(cx), 0, w - 1), sy = clamp(Math.floor(cy), 0, h - 1), q = (sy * w + sx) * 4; const base = [sm[q], sm[q + 1], sm[q + 2]];
      const x0 = Math.max(0, Math.floor(cx - hx - 1)), x1 = Math.min(w - 1, Math.ceil(cx + hx + 1)), y0 = Math.max(0, Math.floor(cy - s - 1)), y1 = Math.min(h - 1, Math.ceil(cy + s + 1));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - cx, py = y + 0.5 - cy, ax = Math.abs(px);
        const dHex = Math.min(hx - ax, (s - ax / S3 - Math.abs(py)) * (S3 / 2)); const cov = clamp(0.5 + dHex, 0, 1); if (!cov) continue;   // odległość do sylwetki (dodatnia w środku)
        const top = py < -ax / S3; const face = top ? 0 : (px < 0) !== flip ? 1 : 2; const k = shade[face];
        let c = [base[0] * k, base[1] * k, base[2] * k];
        if (ow > 0) { const seam = top ? Math.abs(py * (S3 / 2) + ax / 2) : Math.min(Math.abs(py * (S3 / 2) + ax / 2), py > 0 ? ax : Infinity); const e = clamp(0.5 - (Math.min(dHex, seam) - ow / 2), 0, 1); if (e) c = c.map((v) => lerp(v, v * 0.25, e)); }
        const i4 = (y * w + x) * 4; const a0 = L[i4 + 3] / 255; const a = cov + a0 * (1 - cov);
        for (let ch = 0; ch < 3; ch++) L[i4 + ch] = (Math.min(255, c[ch]) * cov + L[i4 + ch] * a0 * (1 - cov)) / (a || 1); L[i4 + 3] = a * 255;
      }
    }
    ctx.info.cubes = cubes;
    const out = backdrop(ctx); const d = out.data; const m = ctx.p.blendMode;
    for (let i = 0; i < d.length; i += 4) { const a = L[i + 3] / 255; if (!a) continue; for (let ch = 0; ch < 3; ch++) d[i + ch] = lerp(d[i + ch], blendCh(m, d[i + ch], L[i + ch]), a); d[i + 3] = Math.max(d[i + 3], L[i + 3]); }
    return out;
  },
};
export const VOXEL_EFFECTS: EffectDef[] = [voxel];
