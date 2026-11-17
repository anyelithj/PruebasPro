import { mapLimit } from "@/lib/map-limit";
// [Suite mapLimit · 2026-10-27]: paralelismo acotado con orden estable (guardado de recursos y conceptos) | [Herramienta]: Jest

describe("mapLimit", () => {
  it("conserva el orden y no supera el límite", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([20, 1, 10, 5], 2, async (ms, i) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, ms));
      running--;
      return `r${i}`;
    });
    expect(out).toEqual(["r0", "r1", "r2", "r3"]);
    expect(peak).toBe(2);
  });

  it("lista vacía → [] sin llamar a la función", async () => {
    const fn = jest.fn(async () => 1);
    expect(await mapLimit([], 3, fn)).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});
