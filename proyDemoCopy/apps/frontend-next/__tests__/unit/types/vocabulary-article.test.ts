import { vocabularyArticleProblem, withArticle } from "@/types/curriculum";

// [2026-11-02]: espejo de la regla de NestJS (artículo obligatorio en sustantivos de/fr/pt/es, opcional en en, «No aplica» en ru/zh)
describe("artículo de las fichas de vocabulario", () => {
  const noun = (lemma: string, article?: string) => ({ lemma, article, partOfSpeech: "sustantivo" });

  it("bloquea el sustantivo sin artículo en de/fr/pt/es y lo acepta con el suyo", () => {
    for (const lang of ["de", "fr", "pt", "es"]) expect(vocabularyArticleProblem(lang, noun("x"))).not.toBeNull();
    expect(vocabularyArticleProblem("de", noun("Obst", "das"))).toBeNull();
    expect(vocabularyArticleProblem("de", noun("das Obst"))).toBeNull(); // Ya escrito en la palabra
    expect(vocabularyArticleProblem("es", noun("mesa", "der"))).toMatch(/no válido/);
  });

  it("inglés opcional · ruso y chino no aplica", () => {
    expect(vocabularyArticleProblem("en", noun("apple"))).toBeNull();
    expect(vocabularyArticleProblem("ru", noun("вода"))).toBeNull();
    expect(vocabularyArticleProblem("zh", noun("水", "the"))).toMatch(/no aplica/);
  });

  it("muestra el artículo junto al sustantivo sin duplicarlo", () => {
    expect(withArticle("de", "Obst", "das")).toBe("das Obst");
    expect(withArticle("fr", "eau", "l’")).toBe("l'eau");
    expect(withArticle("de", "das Obst", "das")).toBe("das Obst");
    expect(withArticle("ru", "вода", undefined)).toBe("вода");
  });
});
