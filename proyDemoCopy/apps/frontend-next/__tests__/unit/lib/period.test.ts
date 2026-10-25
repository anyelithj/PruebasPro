// [Test period.ts]: helpers de filtro por periodo y sección | [Corrección]: filtros por periodo (2/3/6/12 meses)
import { parsePeriod, parseSection, monthsToSince } from "@/lib/period";

describe("parsePeriod", () => {
  it("acepta periodos soportados (2/3/6/12)", () => {
    expect(parsePeriod("2")).toBe(2);
    expect(parsePeriod("3")).toBe(3);
    expect(parsePeriod("6")).toBe(6);
    expect(parsePeriod("12")).toBe(12);
  });

  it("rechaza no soportados → undefined", () => {
    expect(parsePeriod("5")).toBeUndefined();
    expect(parsePeriod("0")).toBeUndefined();
    expect(parsePeriod("abc")).toBeUndefined();
    expect(parsePeriod(undefined)).toBeUndefined();
  });

  it("toma el primer valor si es array (query param repetido)", () => {
    expect(parsePeriod(["6", "3"])).toBe(6);
  });
});

describe("parseSection", () => {
  it("devuelve la sección recortada", () => {
    expect(parseSection("11-1")).toBe("11-1");
    expect(parseSection("  A  ")).toBe("A");
  });

  it("vacío o solo espacios → undefined", () => {
    expect(parseSection("")).toBeUndefined();
    expect(parseSection("   ")).toBeUndefined();
    expect(parseSection(undefined)).toBeUndefined();
  });
});

describe("monthsToSince", () => {
  it("undefined / 0 → sin corte", () => {
    expect(monthsToSince(undefined)).toBeUndefined();
    expect(monthsToSince(0)).toBeUndefined();
  });

  it("N meses → fecha dentro de la ventana esperada", () => {
    const since = monthsToSince(3);
    expect(since).toBeInstanceOf(Date);
    const diffDays = (Date.now() - (since as Date).getTime()) / 86_400_000;
    expect(diffDays).toBeGreaterThan(55);
    expect(diffDays).toBeLessThan(130);
  });
});
