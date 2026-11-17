import { curatedTopicsAllLevels, syllabusLevel, textLevel, topicLevel } from "@/config/curriculum-topics";
test("nivel según el tema", () => {
  expect(topicLevel("El presente perfecto", "en")).toBe("B1");
  expect(topicLevel("los colores", "en")).toBe("A1");
  expect(topicLevel("tema inventado", "en")).toBeNull();
  expect(curatedTopicsAllLevels("grammar_rule", "en", "B1")[0].label).toBe("B1 · 📐 Gramática");
  expect(syllabusLevel(["El pasado simple", "El presente continuo", "El verbo to be"], "en")).toEqual({ level: "A2", matched: 2 });
});
test("nivel según un tema contenido en el título", () => {
  expect(textLevel("Examen de presente perfecto", "en")).toBe("B1");
  expect(textLevel("Quiz: los colores y las frutas", "en")).toBe("A1");
  expect(textLevel("Repaso general", "en")).toBeNull();
});
