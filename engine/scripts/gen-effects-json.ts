// Generuje src/data/effects.json (91 efektow) z ../docs/02-katalog-efektow.md + faz z sekcji 12 + statusu implementacji (src/registry.ts).
// Uruchomienie: node scripts/gen-effects-json.ts   Raport: reports/effects-json.txt
import { readFileSync, writeFileSync } from 'node:fs';
import { EFFECTS } from '../src/index.ts';

const md = readFileSync('../docs/02-katalog-efektow.md', 'utf8');
const CATS = ['ASCII & Text', 'Pixels & Blocks', 'Print & Paper', 'Geometric', 'Distort', 'Blur & Focus', 'Glitch & Signal', 'Light & Colour', 'Glass', 'Material & Texture'];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
// Fazy z sekcji 12 pliku 02. Nazwy w katalogu bywaja inne niz w liscie faz (CRT = CRT Screen, Aberration = Aberration, Block = Block).
const sec12 = md.slice(md.indexOf('## 12.'), md.indexOf('## 13.'));
const phaseText = (n: number) => { const m = new RegExp(`\\*\\*Faza ${n}[^\\n]*\\n([\\s\\S]*?)(?=\\n\\*\\*Faza|\\nEfekty typu|$)`).exec(sec12); return m ? m[1] : ''; };
const names = (t: string) => t.replace(/\.\s*Do tego[\s\S]*$/, '').replace(/Do tego[\s\S]*$/, '').split(/,|\n/).map((x) => x.replace(/\.$/, '').trim()).filter(Boolean);
const P: Record<number, string[]> = { 1: names(phaseText(1)), 2: names(phaseText(2)), 3: names(phaseText(3)) };
const phaseOfName = (name: string, cat: number): { phase: 1 | 2 | 3; assigned: boolean } => {
  const n = norm(name);
  for (const ph of [1, 2, 3] as const) if (P[ph].some((x) => { const nx = norm(x); return nx === n || (nx === 'crt' && n === 'crtscreen'); })) return { phase: ph, assigned: true };
  if (cat === 5 || cat === 6) return { phase: 2, assigned: true };      // "wszystkie zniekształcenia i rozmycia" (faza 2)
  if (cat === 9) return { phase: 3, assigned: true };                    // "całe Szkło" (faza 3)
  return { phase: 3, assigned: false };                                   // nieprzypisane w pliku 02: domyslnie faza 3
};
const out: any[] = []; const sections = md.slice(0, md.indexOf('## 11.')).split(/\n## /).slice(1).filter((s) => /^\d+\./.test(s));
for (const sec of sections) {
  const cat = parseInt(sec); const lines = sec.split('\n'); let cur: any = null;
  for (const l of lines.slice(1)) {
    const m = /^- \*\*(.+?)\*\*(?: `([^`]+)`)? · (\w+) · ([SML]) · ([a-z/?]+)/.exec(l);
    if (m) { if (cur) out.push(cur); cur = { name: m[1], id: m[2] ?? null, engine: m[3], complexity: m[4], source: m[5], rest: [l.slice(m[0].length)], cat }; } else if (cur && l.trim() && !l.startsWith('#') && !l.startsWith('  `') && !/^Wszystkie to|^Zniekształcają|^W dokumentacji/.test(l)) cur.rest.push(l.trim());
  }
  if (cur) out.push(cur);
}
const IDFIX: Record<string, string> = { ZigZag: 'zigzag', Ripple: 'ripple' };   // plik 02: nazywamy po zachowaniu (klucze oryginalu sa zamienione)
const impl = new Map(EFFECTS.map((e) => [e.id, e]));
const list = out.map((e) => {
  const id = e.id ?? IDFIX[e.name]; const desc = e.rest.join(' ').replace(/Opcje:.*$/, '').replace(/^\s*[·\-]?\s*/, '').replace(/\s+/g, ' ').trim(); const ph = phaseOfName(e.name, e.cat); const im = impl.get(id);
  return { id, name: e.name, category: CATS[e.cat - 1], categoryIndex: e.cat, engine: e.engine, complexity: e.complexity, source: e.source, description: desc, phase: ph.phase, phaseAssigned: ph.assigned, status: im ? 'ready' : 'soon',
    animated: !!im?.motions?.length, motions: (im?.motions ?? []).map((m) => ({ id: m.id, name: m.name })) };   // etap 2: z rejestru (jedno źródło prawdy)
});
writeFileSync('src/data/effects.json', JSON.stringify(list, null, 2) + '\n');
const byCat = CATS.map((c, i) => `${c}: ${list.filter((x) => x.categoryIndex === i + 1).length}`).join(', ');
const un = list.filter((x) => !x.phaseAssigned).map((x) => x.name);
const rep = [`${list.length} efektow, ${new Set(list.map((x) => x.id)).size} unikalnych id`, byCat, `faza 1: ${list.filter((x) => x.phase === 1).length}, faza 2: ${list.filter((x) => x.phase === 2).length}, faza 3: ${list.filter((x) => x.phase === 3).length}`, `status ready: ${list.filter((x) => x.status === 'ready').length}`, `animowane: ${list.filter((x) => x.animated).map((x) => x.id).join(', ') || 'brak'}`, `bez przypisanej fazy w pliku 02 (domyslnie 3): ${un.length}: ${un.join(', ')}`, `zrodlo opisu: ${['docs', 'docs/proj', 'proj', 'proj?'].map((s) => `${s}=${list.filter((x) => x.source === s).length}`).join(', ')}`];
writeFileSync('reports/effects-json.txt', rep.join('\n') + '\n'); console.log(rep.join('\n'));
