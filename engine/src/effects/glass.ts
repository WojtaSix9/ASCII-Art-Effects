// Szkło, Faza 3 (plik 02, sekcja Glass; wszystko proj, Vitrine proj?): Frosted Glass, Tinted Glass (witraż), Shatter, Vitrine,
// Glass Orb, Fluted Glass, Liquid Glass (10 tekstur). Długości w px × skala; losowość z seeda w px źródła (x / skala) albo w ułamkach
// obrazu; komórki Voronoi o boku ∝ wymiarom obrazu, więc eksport @2x ma ten sam układ.
import type { EffectDef, Img } from '../core/types.ts';
import { color, common, range, seedParam, select } from '../core/params.ts';
import { blur, clamp, hash01, lerp, lum, parseColor } from '../core/util.ts';
import { bil, valueNoise, voronoi } from '../core/screen.ts';

const px1 = () => [...common('brightness', 'contrast')];
const PX = { unit: 'px', px: true } as const;
const PCT = { unit: '%' } as const;
const DEG = Math.PI / 180;
const fr = (v: number) => v - Math.floor(v);
const out0 = (s: Img) => ({ w: s.w, h: s.h, data: new Uint8ClampedArray(s.data.length) });

// ---------- Frosted Glass ----------
const frostedglass: EffectDef = {
  id: 'frostedglass', name: 'Frosted Glass', category: 'Glass', engine: 'SHADER', phase: 3,
  description: 'Frosted glass: a soft blur scattered by fine grain, with a cool tint.',
  params: [range('blur', 'Blur', 6, 0, 40, PX), range('frostGrain', 'Frost grain', 60, 0, 100, PCT), color('tint', 'Tint', '#e4eef2'), range('opacity', 'Opacity', 100, 0, 100, PCT), seedParam(), ...px1()],
  // rozmyty obraz próbkowany z losowym przesunięciem (ziarno szronu; los w px źródła, amplituda ∝ blur i frostGrain), lekkie
  // rozjaśnienie, mnożenie przez tint; opacity = ile szkła nad ostrym obrazem
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sc = ctx.scale; const r = ctx.p.blur * sc; const b = r >= 0.5 ? blur(s, Math.max(1, Math.round(r))).data : s.data; const g = ctx.p.frostGrain / 100;
    const amp = (0.6 * r + 1.5 * sc) * g; const tn = parseColor(ctx.p.tint); const op = ctx.p.opacity / 100; const out = out0(s); const sd = ctx.p.seed * 101;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const hx = Math.floor(x / sc), hy = Math.floor(y / sc); const ox = (hash01(hx, hy, sd) - 0.5) * 2 * amp, oy = (hash01(hx, hy, sd + 1) - 0.5) * 2 * amp;
      for (let q = 0; q < 3; q++) { const v = bil(b, w, h, x + 0.5 + ox, y + 0.5 + oy, q); const f = lerp(v, 255, 0.06 * g) * (tn[q] / 255); out.data[i + q] = lerp(s.data[i + q], f, op); }
      out.data[i + 3] = s.data[i + 3];
    }
    return out;
  },
};

// ---------- Tinted Glass (witraż) ----------
const stainedglass: EffectDef = {
  id: 'stainedglass', name: 'Tinted Glass', category: 'Glass', engine: 'GEOM', phase: 3,
  description: 'Stained glass: flat-coloured Voronoi panes in lead came, lit from behind.',
  params: [range('cellCount', 'Cells', 300, 20, 3000), range('leadThickness', 'Lead thickness', 3, 0, 16, { ...PX, step: 0.5 }), color('leadColor', 'Lead colour', '#1c1a18'),
    range('jitter', 'Jitter', 85, 0, 100, PCT), range('backlight', 'Backlight', 50, 0, 100, PCT), seedParam(), ...px1()],
  // szyby = komórki Voronoi (bok ∝ √(pole / cellCount)); kolor = średnia komórki, nasycenie × 1,4; podświetlenie: jaśniej w środku szyby
  // i w środku obrazu, plus delikatna faktura szkła (szum w ułamkach obrazu); ołów = pas o grubości leadThickness wzdłuż granic
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const cs = Math.sqrt((w * h) / ctx.p.cellCount); const V = voronoi(w, h, cs, ctx.p.jitter / 100, ctx.p.seed * 13 + 1);
    const sum = new Float64Array(V.n * 4); for (let p = 0, i = 0; p < w * h; p++, i += 4) { const k = V.id[p] * 4; sum[k] += s.data[i]; sum[k + 1] += s.data[i + 1]; sum[k + 2] += s.data[i + 2]; sum[k + 3]++; }
    const lc = parseColor(ctx.p.leadColor); const t = ctx.p.leadThickness * ctx.scale; const bl = ctx.p.backlight / 100; const out = out0(s); const m = Math.max(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4, k = V.id[p] * 4; const n = sum[k + 3]; const c = [sum[k] / n, sum[k + 1] / n, sum[k + 2] / n]; const L = lum(c[0], c[1], c[2]) * 255;
      const pane = clamp(1 - V.f1[p] / (cs * 0.9), 0, 1), rad = Math.hypot(x / m - w / (2 * m), y / m - h / (2 * m)) * 2; const tex = (valueNoise((x / m) * 40, (y / m) * 40, ctx.p.seed) - 0.5) * 0.08;
      const light = lerp(1, 0.6 + 0.6 * pane - 0.25 * rad + tex, bl);
      const lead = t > 0 ? clamp(0.5 - (V.edge[p] - t / 2), 0, 1) * Math.min(1, t) : 0;
      for (let q = 0; q < 3; q++) out.data[i + q] = lerp((L + (c[q] - L) * 1.4) * light, lc[q], lead);
      out.data[i + 3] = s.data[i + 3];
    }
    return out;
  },
};

// ---------- Shatter ----------
const shatter: EffectDef = {
  id: 'shatter', name: 'Shatter', category: 'Glass', engine: 'GEOM', phase: 3,
  description: 'Shattered glass: Voronoi shards pushed away from the impact point and turned, with radial cracks.',
  params: [range('fragmentCount', 'Fragments', 80, 5, 600), range('displacement', 'Displacement', 3, 0, 15, { ...PCT, step: 0.5 }), range('rotation', 'Rotation', 4, 0, 30, { unit: '°' }),
    range('crackLines', 'Crack lines', 12, 0, 40), range('centerX', 'Impact X', 45, 0, 100, PCT), range('centerY', 'Impact Y', 40, 0, 100, PCT), seedParam(), ...px1()],
  // odłamek k: przesunięcie od punktu uderzenia o displacement% krótszego boku × (0,3–1 z seeda) i obrót ±rotation wokół swojego punktu;
  // piksel bierze źródło z odwrotnej transformacji; granice odłamków: ciemna szczelina z jasną krawędzią; pęknięcia promieniste
  // (kąt z seeda, poszarpane szumem) i 3 przerywane pierścienie wokół punktu uderzenia; jasność odłamka ±8% z seeda
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sc = ctx.scale; const mn = Math.min(w, h); const cs = Math.sqrt((w * h) / ctx.p.fragmentCount); const sd = ctx.p.seed * 7 + 3; const V = voronoi(w, h, cs, 1, sd);
    const ix = (ctx.p.centerX / 100) * w, iy = (ctx.p.centerY / 100) * h; const D = (ctx.p.displacement / 100) * mn; const rotMax = ctx.p.rotation * DEG; const out = out0(s);
    const tf = new Map<number, number[]>(); const T = (k: number) => { let v = tf.get(k); if (!v) { const [sx, sy] = V.site(k); const dx = sx - ix, dy = sy - iy, dl = Math.hypot(dx, dy) || 1; const a = D * (0.3 + 0.7 * hash01(k, 1, sd)); const r = (hash01(k, 2, sd) - 0.5) * 2 * rotMax; v = [sx, sy, (dx / dl) * a, (dy / dl) * a, Math.cos(r), Math.sin(r)]; tf.set(k, v); } return v; };
    const nC = Math.round(ctx.p.crackLines); const ang = Array.from({ length: nC }, (_, i) => ((i + hash01(i, 5, sd) * 0.8) / Math.max(1, nC)) * 2 * Math.PI); const rings = nC ? [0.07, 0.16, 0.3] : [];
    const gap = D > 0 ? Math.max(0.6 * sc, Math.min(1.6 * sc, D * 0.08)) : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4; const [sx, sy, ox, oy, c, sn] = T(V.id[p]); const rx = x + 0.5 - sx - ox, ry = y + 0.5 - sy - oy; const ux = sx + rx * c + ry * sn, uy = sy - rx * sn + ry * c;
      const lit = D > 0 ? 1 + (hash01(V.id[p], 3, sd) - 0.5) * 0.16 : 1; let col = [0, 1, 2].map((q) => bil(s.data, w, h, ux, uy, q) * lit);   /* każdy odłamek odbija światło trochę inaczej */
      const e = V.edge[p]; if (gap) { const kd = clamp(0.5 - (e - gap / 2), 0, 1), kl = clamp(0.5 - Math.abs(e - gap / 2 - 0.6 * sc), 0, 1) * 0.5; col = col.map((v) => lerp(lerp(v, 255, kl), 12, kd)); }
      if (nC) {
        const dx = x + 0.5 - ix, dy = y + 0.5 - iy, r = Math.hypot(dx, dy), phi = Math.atan2(dy, dx); const rn = r / mn; let k = 0; const wid = sc * (1.4 - 0.8 * clamp(rn, 0, 1));
        for (let j = 0; j < nC; j++) { const th = ang[j] + (valueNoise(rn * 12, j * 3.1, sd) - 0.5) * 0.35; let da = Math.abs(phi - th) % (2 * Math.PI); if (da > Math.PI) da = 2 * Math.PI - da; k = Math.max(k, clamp(0.5 - (da * r - wid / 2), 0, 1)); }
        for (const R0 of rings) { const rr = R0 * mn * (1 + (valueNoise(phi * 3 + 10, R0 * 20, sd) - 0.5) * 0.15); const on = valueNoise(phi * 2.5 + 3, R0 * 40, sd + 4) > 0.45 ? 1 : 0; k = Math.max(k, clamp(0.5 - (Math.abs(r - rr) - wid / 2), 0, 1) * 0.8 * on);   /* pierścienie przerywane */ }
        if (k) col = col.map((v) => lerp(v, 245, k * 0.85));
      }
      for (let q = 0; q < 3; q++) out.data[i + q] = col[q]; out.data[i + 3] = s.data[i + 3];
    }
    ctx.info.fragments = ctx.p.fragmentCount; return out;
  },
};

// ---------- Vitrine ----------
const vitrine: EffectDef = {
  id: 'vitrine', name: 'Vitrine', category: 'Glass', engine: 'SHADER', phase: 3,
  description: 'The image behind a pane of glass in a frame: faint mirrored reflection, glare bands and a tint.',
  params: [range('reflection', 'Reflection', 45, 0, 100, PCT), range('glareAngle', 'Glare angle', 35, -90, 90, { unit: '°' }), range('frame', 'Frame', 24, 0, 120, PX),
    color('frameColor', 'Frame colour', '#3a3430'), color('tint', 'Tint', '#eef6f2'), ...px1()],
  // interpretacja (proj?): szyba = mnożenie przez tint + odbicie (obraz odwrócony w poziomie, rozmyty, screen z kryciem 0,5 × reflection)
  // + dwa pasy odblasku pod kątem glareAngle; rama o szerokości frame z fazą (góra/lewo jaśniej, dół/prawo ciemniej) i cieniem na szybie
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sc = ctx.scale; const rf = ctx.p.reflection / 100; const rb = blur(s, Math.max(1, Math.round(8 * sc))).data; const tn = parseColor(ctx.p.tint); const fc = parseColor(ctx.p.frameColor);
    const F = ctx.p.frame * sc; const a = ctx.p.glareAngle * DEG, ca = Math.cos(a), sa = Math.sin(a); const diag = Math.hypot(w, h); const out = out0(s);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const X = x + 0.5, Y = y + 0.5; const dEdge = Math.min(X, Y, w - X, h - Y); let c: number[];
      if (F > 0 && dEdge < F) {   // rama: faza wg strony, z której jest najbliższa krawędź
        const side = dEdge === X || dEdge === Y ? 1.25 : 0.7; const bevel = 1 - 0.25 * Math.abs(dEdge / F - 0.5) * 2; c = fc.map((v) => v * side * bevel);
        const k = clamp(dEdge - F + 1, 0, 1); if (k > 0) c = c.map((v, q) => lerp(v, s.data[i + q], k));
      } else {
        const u = ((X - w / 2) * ca + (Y - h / 2) * sa) / diag; const glare = 0.55 * Math.exp(-(((u + 0.12) / 0.09) ** 2)) + 0.35 * Math.exp(-(((u - 0.05) / 0.025) ** 2));
        const j = (y * w + (w - 1 - x)) * 4; const shadow = F > 0 ? 1 - 0.35 * clamp(1 - (dEdge - F) / (F * 0.6 + 1e-9), 0, 1) : 1;
        c = [0, 1, 2].map((q) => { let v = s.data[i + q] * (tn[q] / 255) * shadow; v = 255 - ((255 - v) * (255 - rb[j + q] * 0.5 * rf)) / 255; return v + (255 - v) * glare * rf; });
      }
      for (let q = 0; q < 3; q++) out.data[i + q] = c[q]; out.data[i + 3] = s.data[i + 3];
    }
    return out;
  },
};

// ---------- Glass Orb ----------
const glassorb: EffectDef = {
  id: 'glassorb', name: 'Glass Orb', category: 'Glass', engine: 'SHADER', phase: 3,
  description: 'The image seen through a glass ball: refracted and flipped inside, blurred behind.',
  params: [range('radius', 'Radius', 35, 5, 100, PCT), range('ior', 'Refraction (IOR)', 1.5, 1, 2.5, { step: 0.05 }), range('centerX', 'Position X', 50, 0, 100, PCT), range('centerY', 'Position Y', 50, 0, 100, PCT),
    range('highlight', 'Highlight', 70, 0, 100, PCT), range('backgroundBlur', 'Background blur', 6, 0, 40, PX), ...px1()],
  // R = radius% krótszego boku; w kuli punkt bierze źródło z c + d·f, f = 1 − 4(ior − 1)(0,6 + 0,4r²): przy ior 1 brak zniekształcenia,
  // przy 1,5 obraz odwrócony i powiększony w środku (przybliżenie soczewki kulistej, nie śledzenie promieni); brzeg ciemniejszy,
  // obwódka Fresnela, odblask w lewym górnym rogu; tło rozmyte o backgroundBlur
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const sc = ctx.scale; const R = (ctx.p.radius / 100) * Math.min(w, h); const cx = (ctx.p.centerX / 100) * w, cy = (ctx.p.centerY / 100) * h; const k4 = 4 * (ctx.p.ior - 1); const hl = ctx.p.highlight / 100;
    const bb = ctx.p.backgroundBlur * sc; const bg = bb >= 0.5 ? blur(s, Math.max(1, Math.round(bb))).data : s.data; const out = out0(s);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy); const a = clamp(R - d + 0.5, 0, 1);
      for (let q = 0; q < 3; q++) out.data[i + q] = bg[i + q]; out.data[i + 3] = s.data[i + 3]; if (!a) continue;
      const r = Math.min(1, d / R), z = Math.sqrt(1 - r * r); const f = 1 - k4 * (0.6 + 0.4 * r * r); const spec = hl * (Math.exp(-(((dx / R + 0.38) ** 2 + (dy / R + 0.42) ** 2) / 0.018)) + 0.25 * Math.exp(-(((dx / R - 0.45) ** 2 + (dy / R - 0.5) ** 2) / 0.01)));
      for (let q = 0; q < 3; q++) { let v = bil(s.data, w, h, cx + dx * f, cy + dy * f, q) * (0.72 + 0.28 * z); v += (255 - v) * (0.3 * (1 - z) ** 3 + spec); out.data[i + q] = lerp(bg[i + q], v, a); }
    }
    return out;
  },
};

// ---------- Fluted Glass ----------
const flutedglass: EffectDef = {
  id: 'flutedglass', name: 'Fluted Glass', category: 'Glass', engine: 'SHADER', phase: 3,
  description: 'Reeded glass: a row of cylindrical lenses that slice and shift the image.',
  params: [range('fluteWidth', 'Flute width', 24, 4, 120, PX), range('refractionStrength', 'Refraction', 60, 0, 150, PCT), select('direction', 'Direction', 'vertical', [['vertical', 'Vertical'], ['horizontal', 'Horizontal']]),
    range('shading', 'Shading', 40, 0, 100, PCT), ...px1()],
  // w każdym żłobku u ∈ [−1, 1] (od krawędzi do krawędzi); próbka przesunięta o −u · refraction · szerokość/2 (soczewka ściska obraz
  // do środka żłobka, powyżej 100% odwraca); cień ku krawędziom (1 − 0,25·shading·u²) i wąski odblask przy u = −0,45
  // etap 2, ruch „slide” (plik 09: przesuwanie wzoru żłobków; proj): żłobki przesuwają się o speed szerokości na pętlę
  motions: [{ id: 'slide', name: 'Slide', params: [range('speed', 'Speed (cycles per loop)', 1, 1, 8)] }],
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const fw = ctx.p.fluteWidth * ctx.scale; const st = ctx.p.refractionStrength / 100; const sh = ctx.p.shading / 100; const vert = ctx.p.direction !== 'horizontal'; const out = out0(s); const sl = ctx.motion ? ctx.motion.p.speed * ctx.motion.phase : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const a = vert ? x + 0.5 : y + 0.5; const u = 2 * fr(a / fw + sl) - 1; const off = -u * st * fw * 0.5; const m = 1 - 0.25 * sh * u * u, g = sh * 0.35 * Math.exp(-(((u + 0.45) / 0.12) ** 2));
      for (let q = 0; q < 3; q++) { const v = (vert ? bil(s.data, w, h, x + 0.5 + off, y + 0.5, q) : bil(s.data, w, h, x + 0.5, y + 0.5 + off, q)) * m; out.data[i + q] = v + (255 - v) * g; }
      out.data[i + 3] = s.data[i + 3];
    }
    return out;
  },
};

// ---------- Liquid Glass ----------
// Wysokość h(u, v) ∈ [0, 1] w jednostkach kafla (u, v liczone od środka obrazu); normalna z gradientu; refrakcja = przesunięcie próbki
// o −∇h · kafel · refraction px; odblask Blinna-Phonga (światło z lewej góry) i lekkie cieniowanie rozproszone.
const cellPts = (u: number, v: number, sd: number, fnc: (dx: number, dy: number, gi: number, gj: number) => void) => { const gi = Math.floor(u), gj = Math.floor(v); for (let j = gj - 1; j <= gj + 1; j++) for (let i = gi - 1; i <= gi + 1; i++) fnc(i + hash01(i, j, sd) - u, j + hash01(i, j, sd + 1) - v, i, j); };
const TEX: Record<string, (u: number, v: number, sd: number) => number> = {
  cross: (u, v) => (Math.cos(2 * Math.PI * u) + Math.cos(2 * Math.PI * v)) * 0.25 + 0.5,
  hammered: (u, v, sd) => { let m = 9; cellPts(u, v, sd, (dx, dy) => { m = Math.min(m, dx * dx + dy * dy); }); return clamp(m * 1.6, 0, 1); },
  diamond: (u, v) => 1 - (Math.abs(fr(u + v) - 0.5) + Math.abs(fr(u - v) - 0.5)),
  hexagon: (u, v) => { const q = (2 / 3) * u, r = (-1 / 3) * u + (Math.sqrt(3) / 3) * v; let rx = Math.round(q), rz = Math.round(r), ry = Math.round(-q - r); const xd = Math.abs(rx - q), zd = Math.abs(rz - r), yd = Math.abs(ry + q + r); if (xd > yd && xd > zd) rx = -ry - rz; else if (yd <= zd) rz = -rx - ry; const cx = 1.5 * rx, cy = Math.sqrt(3) * (rz + rx / 2); const dx = Math.abs(u - cx), dy = Math.abs(v - cy); return clamp(1 - Math.max(dx * 0.5 + dy * 0.866, dx) / 0.9, 0, 1); },
  ripple: (u, v) => 0.5 + 0.5 * Math.sin(2 * Math.PI * Math.hypot(u, v)),
  crackle: (u, v, sd) => { let a = 9, ax = 0, ay = 0; cellPts(u, v, sd, (dx, dy) => { const d = dx * dx + dy * dy; if (d < a) { a = d; ax = dx; ay = dy; } }); let e = 9; cellPts(u, v, sd, (dx, dy) => { const bx = dx - ax, by = dy - ay, L = Math.hypot(bx, by); if (L > 1e-6) e = Math.min(e, ((ax + bx / 2) * bx + (ay + by / 2) * by) / L); }); return clamp(e / 0.12, 0, 1); },
  chevron: (u, v) => Math.abs(fr(v + 2 * Math.abs(fr(u) - 0.5)) - 0.5) * 2,
  seedy: (u, v, sd) => { let m = 0; cellPts(u, v, sd, (dx, dy, i, j) => { if (hash01(i, j, sd + 2) < 0.55) { const r = 0.1 + 0.18 * hash01(i, j, sd + 3); const d = Math.hypot(dx, dy) / r; if (d < 1) m = Math.max(m, Math.sqrt(1 - d * d)); } }); return m; },
  pixel: (u, v) => (1 - Math.abs(2 * fr(u) - 1) ** 6) * (1 - Math.abs(2 * fr(v) - 1) ** 6),
  jello: (u, v, sd) => 0.65 * valueNoise(u * 0.5, v * 0.5, sd) + 0.35 * valueNoise(u * 1.1 + 7, v * 1.1 + 3, sd + 9),
};
const LG = (() => { const l = [-0.45, -0.55, 0.7], n = Math.hypot(...l); const L = l.map((v) => v / n); const H = [L[0], L[1], L[2] + 1]; const m = Math.hypot(...H); return { L, H: H.map((v) => v / m) }; })();
const liquidglass: EffectDef = {
  id: 'liquidglass', name: 'Liquid Glass', category: 'Glass', engine: 'SHADER', phase: 3,
  description: 'Textured glass in 10 patterns (reeded cross, hammered, diamond, hexagon, ripple, crackle, chevron, seedy, pixel, jello).',
  params: [select('texture', 'Texture', 'hammered', [['cross', 'Cross reeded'], ['hammered', 'Hammered'], ['diamond', 'Diamond'], ['hexagon', 'Hexagon'], ['ripple', 'Ripple'], ['crackle', 'Crackle ice'], ['chevron', 'Chevron'], ['seedy', 'Seedy'], ['pixel', 'Pixel'], ['jello', 'Jello']]),
    range('tileSize', 'Tile size', 32, 6, 200, PX), range('refraction', 'Refraction', 8, 0, 40, PX), range('highlight', 'Highlight', 50, 0, 100, PCT), seedParam(), ...px1()],
  render(ctx) {
    const s = ctx.prep; const { w, h } = s; const T = ctx.p.tileSize * ctx.scale; const fn = TEX[ctx.p.texture] ?? TEX.hammered; const sd = ctx.p.seed * 29 + 1; const H = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = fn((x + 0.5 - w / 2) / T, (y + 0.5 - h / 2) / T, sd);
    const rf = ctx.p.refraction * ctx.scale; const hl = ctx.p.highlight / 100; const out = out0(s); const at = (x: number, y: number) => H[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const gx = ((at(x + 1, y) - at(x - 1, y)) / 2) * T, gy = ((at(x, y + 1) - at(x, y - 1)) / 2) * T; const nl = Math.hypot(gx * 0.6, gy * 0.6, 1);
      const nx = (-gx * 0.6) / nl, ny = (-gy * 0.6) / nl, nz = 1 / nl; const dif = 1 + 0.12 * ((nx * LG.L[0] + ny * LG.L[1] + nz * LG.L[2]) - LG.L[2]) / (1 - LG.L[2]);
      const sp = hl * Math.pow(Math.max(0, nx * LG.H[0] + ny * LG.H[1] + nz * LG.H[2]), 60) * 0.9;
      for (let q = 0; q < 3; q++) { const v = bil(s.data, w, h, x + 0.5 - gx * rf, y + 0.5 - gy * rf, q) * dif; out.data[i + q] = v + (255 - v) * sp; }
      out.data[i + 3] = s.data[i + 3];
    }
    return out;
  },
};

export const GLASS_EFFECTS: EffectDef[] = [frostedglass, stainedglass, shatter, vitrine, glassorb, flutedglass, liquidglass];
