// [Test cn()]: merge de clases Tailwind | [Patrón]: Unit Test puro | [Principio]: KISS
import { cn } from "@/lib/utils";

describe("cn (class merge utility)", () => {
  // [clsx]: ignora valores falsy y concatena strings
  it("concatena clases truthy e ignora falsy", () => {
    expect(cn("a", "b")).toBe("a b");
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });

  // [tailwind-merge]: la última utilidad en conflicto gana
  it("resuelve conflictos Tailwind con la última clase", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  // [condicional objeto]: API clsx con objeto
  it("acepta sintaxis de objeto condicional", () => {
    expect(cn({ active: true, hidden: false })).toBe("active");
  });

  // [vacío]: sin args devuelve string vacío
  it("devuelve string vacío sin argumentos", () => {
    expect(cn()).toBe("");
  });
});
