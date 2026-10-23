import "server-only";

// Semáforo en memoria para las generaciones de recursos (ADR-0008 §4): como máximo N a la vez por
// proceso, para no chocar con el límite de tokens por minuto del proveedor gratuito.

const MAX_CONCURRENT = 2;

class Semaphore {
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly max: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.max) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.running += 1;
    try {
      return await task();
    } finally {
      this.running -= 1;
      this.waiting.shift()?.();
    }
  }
}

const globalForQueue = globalThis as unknown as { resourceQueue?: Semaphore };

/** Compartido por el proceso (sobrevive a la recarga en caliente de desarrollo). */
export const generationQueue = (globalForQueue.resourceQueue ??= new Semaphore(MAX_CONCURRENT));
