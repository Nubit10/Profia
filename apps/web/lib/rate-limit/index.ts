// Límite de intentos por clave (RN-09). En Foundation vive en memoria de una sola instancia;
// cuando exista Redis (Fase 5) se agrega otra implementación de RateLimiter sin tocar a quien lo usa.

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterMs: number };

export interface RateLimiter {
  consume(key: string): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

type Window = { count: number; resetAt: number };

export class MemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  async consume(key: string): Promise<RateLimitResult> {
    const now = this.now();
    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, window);
    }
    window.count += 1;
    this.sweep(now);
    const allowed = window.count <= this.limit;
    return {
      allowed,
      remaining: Math.max(0, this.limit - window.count),
      retryAfterMs: allowed ? 0 : window.resetAt - now,
    };
  }

  async reset(key: string): Promise<void> {
    this.windows.delete(key);
  }

  private sweep(now: number) {
    if (this.windows.size < 10_000) return;
    for (const [key, window] of this.windows) if (window.resetAt <= now) this.windows.delete(key);
  }
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const globalForLimiters = globalThis as unknown as {
  authLimiters?: {
    loginAttempt: RateLimiter;
    loginIp: RateLimiter;
    loginEmail: RateLimiter;
    register: RateLimiter;
  };
};

/** Limitadores compartidos del proceso para login y registro. */
export const authLimiters = (globalForLimiters.authLimiters ??= {
  loginAttempt: new MemoryRateLimiter(5, FIFTEEN_MINUTES), // por IP + correo
  loginIp: new MemoryRateLimiter(50, FIFTEEN_MINUTES), // por IP, cualquier correo
  // Por correo sin importar la IP: x-forwarded-for lo controla el cliente y podría rotarse.
  loginEmail: new MemoryRateLimiter(20, FIFTEEN_MINUTES),
  register: new MemoryRateLimiter(10, FIFTEEN_MINUTES), // por IP
});

const globalForNamed = globalThis as unknown as { namedLimiters?: Map<string, RateLimiter> };
const namedLimiters = (globalForNamed.namedLimiters ??= new Map());

/** Limitador con nombre, compartido en el proceso. El primer llamado fija límite y ventana. */
export function getLimiter(name: string, limit: number, windowMs: number): RateLimiter {
  let limiter = namedLimiters.get(name);
  if (!limiter) {
    limiter = new MemoryRateLimiter(limit, windowMs);
    namedLimiters.set(name, limiter);
  }
  return limiter;
}
