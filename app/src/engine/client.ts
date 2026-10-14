// Klient silnika po stronie strony. render() działa w trybie "najnowszy wygrywa": gdy Worker jest zajęty,
// czeka co najwyżej jedno zlecenie (ostatnie); wcześniejsze oczekujące kończą się wynikiem null.
// Dzięki temu suwak nie tworzy kolejki renderów.
import type { RenderState } from '../../../engine/src/index.ts';
import type { Req, Reply, InitRes, RenderRes } from './protocol.ts';

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void };
export type RenderOut = { image: ImageData; info: RenderRes['info']; workerMs: number };

export class EngineClient {
  private worker: Worker;
  private nextId = 1;
  private calls = new Map<number, Pending>();
  private busy = false;
  private queued: { state: RenderState; scale: number; p: Pending } | null = null;
  /** Liczba renderów faktycznie wykonanych przez Worker (do testów trybu "najnowszy wygrywa"). */
  rendersExecuted = 0;

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<Reply>) => {
      const c = this.calls.get(e.data.id); if (!c) return; this.calls.delete(e.data.id);
      if (e.data.ok) c.resolve(e.data.data); else c.reject(new Error(e.data.error));
    };
    this.worker.onerror = (e) => { for (const c of this.calls.values()) c.reject(new Error(e.message || 'worker error')); this.calls.clear(); };
  }

  call<T>(req: Req, transfer: Transferable[] = []): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => { this.calls.set(id, { resolve, reject }); this.worker.postMessage({ id, ...req }, transfer); });
  }

  init() { return this.call<InitRes>({ type: 'init' }); }

  /** Ustawia obraz źródłowy (bufor jest przekazywany Workerowi, więc ImageData po wywołaniu jest puste). */
  setSource(img: ImageData) {
    const buffer = img.data.buffer as ArrayBuffer;
    return this.call({ type: 'setSource', img: { w: img.width, h: img.height, buffer } }, [buffer]);
  }

  render(state: RenderState, scale = 1): Promise<RenderOut | null> {
    return new Promise((resolve, reject) => {
      if (this.queued) this.queued.p.resolve(null);
      this.queued = { state, scale, p: { resolve, reject } };
      this.pump();
    });
  }

  private async pump() {
    if (this.busy || !this.queued) return;
    const job = this.queued; this.queued = null; this.busy = true; this.rendersExecuted++;
    try {
      const r = await this.call<RenderRes>({ type: 'render', state: job.state, scale: job.scale });
      const image = new ImageData(new Uint8ClampedArray(r.img.buffer), r.img.w, r.img.h);
      job.p.resolve({ image, info: r.info, workerMs: r.ms });
    } catch (e) { job.p.reject(e as Error); }
    finally { this.busy = false; this.pump(); }
  }

  terminate() { this.worker.terminate(); }
}
