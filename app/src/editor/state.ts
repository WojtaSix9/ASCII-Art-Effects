// Stan edytora i historia (cofnij/ponów). Stan to czyste dane (JSON), więc migawki są proste i porównywalne.
import type { Light, RenderState } from '../../../engine/src/index.ts';
import type { Values } from '../ui/param-panel.ts';

export type EditorState = {
  style: string;
  /** Wartości parametrów osobno dla każdego stylu: po powrocie do stylu wracają jego ustawienia. */
  params: Record<string, Values>;
  color: Values;
  /** Włączone post FX z parametrami; brak klucza = wyłączony. */
  postFx: Record<string, Values>;
  /** Lights (docs/07): włączone, lista świateł (najwyżej 4), Ambient 0–100. */
  lights: { enabled: boolean; items: Light[]; ambient: number };
};

export const initialState = (style: string): EditorState => ({ style, params: {}, color: {}, postFx: {}, lights: { enabled: false, items: [], ambient: 100 } });

export const toRenderState = (s: EditorState): RenderState => ({
  style: { id: s.style, params: s.params[s.style] ?? {} },
  postFx: Object.keys(s.postFx).length ? s.postFx : undefined,
  color: Object.keys(s.color).length ? s.color : undefined,
  lights: s.lights.enabled ? { lights: s.lights.items, ambient: s.lights.ambient } : undefined,
});

/** Historia migawek: commit() zapisuje stan (pomija powtórzenia), undo()/redo() zwracają stan do przywrócenia. */
export class History {
  private stack: string[] = []; private at = -1; private limit: number;
  constructor(limit = 100) { this.limit = limit; }
  commit(s: EditorState) {
    const snap = JSON.stringify(s); if (this.stack[this.at] === snap) return false;
    this.stack = this.stack.slice(0, this.at + 1); this.stack.push(snap);
    if (this.stack.length > this.limit) this.stack.shift(); this.at = this.stack.length - 1; return true;
  }
  get canUndo() { return this.at > 0; }
  get canRedo() { return this.at < this.stack.length - 1; }
  undo(): EditorState | null { return this.canUndo ? JSON.parse(this.stack[--this.at]) : null; }
  redo(): EditorState | null { return this.canRedo ? JSON.parse(this.stack[++this.at]) : null; }
}
