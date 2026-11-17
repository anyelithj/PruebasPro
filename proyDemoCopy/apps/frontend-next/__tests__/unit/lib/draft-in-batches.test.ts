import { draftInBatches } from "@/lib/activity-kinds";
// [draftInBatches · 2026-10-30]: la cantidad pedida a la IA por tandas (Práctica daba 504 con 10 de golpe; el mazo devolvía 14 de 16)

const key = (s: string) => s;

describe("draftInBatches", () => {
  it("pide lo que falta hasta completar, sin repetidos y sin pasarse", async () => {
    const asked: number[] = [];
    const batches = [["a", "b", "c"], ["c", "d", "e"], ["f", "g", "h"]];
    const out = await draftInBatches(7, 3, key, async (n) => (asked.push(n), batches.shift() ?? []));
    expect(out).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    expect(asked).toEqual([3, 3, 2]);
  });

  it("se rinde tras 2 tandas sin nada nuevo y conserva lo generado", async () => {
    const fetch = jest.fn().mockResolvedValue(["a"]);
    await expect(draftInBatches(5, 3, key, fetch)).resolves.toEqual(["a"]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("un fallo sin resultados propaga el error real; con resultados, conserva lo generado", async () => {
    await expect(draftInBatches(3, 3, key, () => Promise.reject(new Error("504")))).rejects.toThrow("504");
    let call = 0;
    await expect(draftInBatches(3, 2, key, async () => { if (call++ === 0) return ["a", "b"]; throw new Error("504"); })).resolves.toEqual(["a", "b"]);
  });
});
