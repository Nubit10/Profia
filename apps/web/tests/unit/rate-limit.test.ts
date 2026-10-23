import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "@/lib/rate-limit";

describe("MemoryRateLimiter", () => {
  it("RN-09: permite hasta el límite y bloquea el siguiente intento", async () => {
    const limiter = new MemoryRateLimiter(3, 60_000, () => 0);
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await limiter.consume("k"));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3]?.retryAfterMs).toBe(60_000);
  });

  it("reinicia la ventana cuando vence", async () => {
    let now = 0;
    const limiter = new MemoryRateLimiter(1, 1_000, () => now);
    expect((await limiter.consume("k")).allowed).toBe(true);
    expect((await limiter.consume("k")).allowed).toBe(false);
    now = 1_000;
    expect((await limiter.consume("k")).allowed).toBe(true);
  });

  it("las claves son independientes y reset() libera una clave", async () => {
    const limiter = new MemoryRateLimiter(1, 60_000, () => 0);
    await limiter.consume("a");
    expect((await limiter.consume("b")).allowed).toBe(true);
    expect((await limiter.consume("a")).allowed).toBe(false);
    await limiter.reset("a");
    expect((await limiter.consume("a")).allowed).toBe(true);
  });
});
