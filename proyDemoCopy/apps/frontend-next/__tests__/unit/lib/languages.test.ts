// [Test languages.ts]: SSOT de idiomas objetivo alineado con Language VO del backend
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  LANGUAGE_VALUES,
  isLanguage,
  languageLabel,
} from "@/lib/languages";
import { DIFFICULTY_LABEL_ES, DIFFICULTY_OPTIONS } from "@/lib/constants";

describe("LANGUAGES", () => {
  it("contiene exactamente los 7 idiomas de la plataforma", () => {
    expect([...LANGUAGE_VALUES].sort()).toEqual(["de", "en", "es", "fr", "pt", "ru", "zh"]);
  });

  it("cada idioma tiene etiqueta en español", () => {
    for (const l of LANGUAGES) expect(l.label).toBeTruthy();
    expect(languageLabel("zh")).toBe("Chino mandarín");
  });

  it("el idioma por defecto es soportado", () => {
    expect(isLanguage(DEFAULT_LANGUAGE)).toBe(true);
  });

  it("rechaza códigos no soportados o no string", () => {
    expect(isLanguage("it")).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
    expect(isLanguage(42)).toBe(false);
  });
});

describe("Dificultad ↔ banda MCER", () => {
  it("cada dificultad muestra su banda MCER", () => {
    expect(DIFFICULTY_LABEL_ES.easy).toContain("A1–A2");
    expect(DIFFICULTY_LABEL_ES.medium).toContain("B1–B2");
    expect(DIFFICULTY_LABEL_ES.hard).toContain("C1–C2");
  });

  it("las opciones de formulario derivan del SSOT", () => {
    expect(DIFFICULTY_OPTIONS.map((o) => o.value)).toEqual(["easy", "medium", "hard"]);
  });
});
