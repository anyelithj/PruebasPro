import { onlyLanguage } from "@/lib/resource-import";

describe("onlyLanguage", () => {
  it("keeps the chosen language and Spanish, drops other target languages", () => {
    const text = ["I am a student and you are a teacher.", "Je suis un étudiant et tu es le professeur.", "Ich bin ein Student und du bist der Lehrer.", "Ejemplo: esta es la frase en español.", "apple - manzana"].join("\n");
    const { ex, dropped } = onlyLanguage({ rows: [], text }, "en");
    expect(ex.text).toContain("I am a student");
    expect(ex.text).toContain("Ejemplo");
    expect(ex.text).toContain("apple - manzana");
    expect(ex.text).not.toContain("Je suis");
    expect(ex.text).not.toContain("Ich bin");
    expect(dropped).toBe(2);
  });
});
