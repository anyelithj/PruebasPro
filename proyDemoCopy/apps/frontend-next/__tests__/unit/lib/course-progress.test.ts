// [Test course-progress + lang-detect · 2026-10-28]: % real del curso (espejo de NestJS recompute) y trozos por idioma de la lectura en voz alta
// [Patrón]: Unit Test de funciones puras | [Principio]: SSOT → si cambia la fórmula, este test avisa antes que las barras
import { courseProgress, pctOf } from "@/lib/course-progress";
import { splitByLanguage } from "@/lib/lang-detect";

describe("courseProgress", () => {
  it("suma recursos + subtemas + ruta e ignora ids/títulos que ya no existen", () => {
    const p = courseProgress({
      materialIds: ["m1", "m2"],
      doneMaterials: ["m1", "borrado"],
      topicTitles: ["Intro", "Verbo to be"],
      doneTopics: new Set(["Intro", "Viejo"]),
      lessons: { done: 1, total: 4 },
    });
    expect(p).toMatchObject({ done: 3, total: 8, pct: 38, materials: { done: 1, total: 2 }, topics: { done: 1, total: 2 } });
  });
  it("0 % sin contenido y acotado a 100", () => {
    expect(courseProgress({ materialIds: [], doneMaterials: [], topicTitles: [], doneTopics: [] }).pct).toBe(0);
    expect(pctOf(9, 4)).toBe(100);
  });
});

describe("splitByLanguage", () => {
  const said = (s: string, lang = "en") => splitByLanguage(s, lang).filter((c) => c.speak).map((c) => s.slice(c.start, c.end).replace(/[\s–:(]+$/u, "").trim());
  it("solo pronuncia el idioma del curso", () => {
    expect(said("farm – granja")).toEqual(["farm"]);
    expect(said("Ejemplo: I am a student.")).toEqual(["I am a student."]);
    expect(said("El verbo to be se usa para describir estados.")).toEqual([]);
    expect(said("Good morning!")).toEqual(["Good morning!"]);
    expect(said("你好 (hola)", "zh")).toEqual(["你好"]);
  });
});
