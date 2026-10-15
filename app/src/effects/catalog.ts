// Katalog 91 efektów z rejestru silnika (engine/src/data/effects.json): kategorie, wyszukiwanie, filtr.
// Czyste funkcje (bez DOM), używane przez stronę główną, /effects i testy.
import effects from '../../../engine/src/data/effects.json' with { type: 'json' };

export type Effect = { id: string; name: string; category: string; categoryIndex: number; description: string; phase: number; status: 'ready' | 'soon' };
export const ALL = effects as Effect[];

/** 10 kategorii w kolejności z pliku 01 (categoryIndex). */
export const CATEGORIES = [...new Map(ALL.map((e) => [e.categoryIndex, e.category])).entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c);
export const slug = (c: string) => c.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
/** Czy efekt pasuje do zapytania (nazwa, id, kategoria, opis; bez wielkości liter i polskich znaków) i kategorii (slug lub ''). */
export function matches(e: Effect, q: string, cat: string) {
  if (cat && slug(e.category) !== cat) return false;
  const words = norm(q).split(/\s+/).filter(Boolean); if (!words.length) return true;
  const hay = norm(`${e.name} ${e.id} ${e.category} ${e.description}`);
  return words.every((w) => hay.includes(w));
}

/** Efekty pogrupowane w kategorie (puste grupy pominięte). */
export const grouped = (list: Effect[]) => CATEGORIES.map((c) => ({ category: c, items: list.filter((e) => e.category === c) })).filter((g) => g.items.length);

/** Opis do wyświetlenia: bez znaczników kodu z katalogu. Docelowe krótkie opisy: pytanie 7 z pliku 05. */
export const displayDescription = (e: Effect) => e.description.replace(/`/g, '');
