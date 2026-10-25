// [Test categories.ts]: SSOT de competencias lingüísticas + etiquetas legacy de solo lectura
import {
  CATEGORIES,
  CATEGORY_VALUES,
  categoryLabel,
  categoryEmoji,
} from "@/lib/categories";

describe("CATEGORIES (SSOT competencias)", () => {
  it("incluye las competencias MCER", () => {
    expect(CATEGORY_VALUES).toEqual(
      expect.arrayContaining([
        "grammar",
        "vocabulary",
        "reading",
        "listening",
        "writing",
        "speaking",
        "pronunciation",
      ]),
    );
  });

  it("NO ofrece materias escolares legacy", () => {
    expect(CATEGORY_VALUES).not.toContain("math");
    expect(CATEGORY_VALUES).not.toContain("biology");
    expect(CATEGORY_VALUES).not.toContain("english");
  });

  it("cada categoría tiene value, label y emoji", () => {
    for (const c of CATEGORIES) {
      expect(c.value).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(c.emoji).toBeTruthy();
    }
  });
});

describe("categoryLabel", () => {
  it("devuelve la etiqueta legible", () => {
    expect(categoryLabel("grammar")).toBe("Gramática");
    expect(categoryLabel("listening")).toBe("Comprensión auditiva");
  });

  it("mantiene etiquetas legacy para quizzes antiguos", () => {
    expect(categoryLabel("math")).toBe("Matemáticas");
  });

  it("fallback al slug si no se reconoce, '—' si vacío", () => {
    expect(categoryLabel("desconocida")).toBe("desconocida");
    expect(categoryLabel(undefined)).toBe("—");
  });
});

describe("categoryEmoji", () => {
  it("devuelve emoji conocido", () => {
    expect(categoryEmoji("pronunciation")).toBe("🔊");
  });

  it("fallback genérico si no se reconoce", () => {
    expect(categoryEmoji("desconocida")).toBe("❓");
    expect(categoryEmoji(undefined)).toBe("❓");
  });
});
