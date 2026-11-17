import { stripPageFurniture } from "@/lib/pdf-text";
// [2026-11-16]: pies y encabezados de página fuera del lector en voz alta; el texto del cuerpo se queda

describe("stripPageFurniture", () => {
  const page = (n: number, body: string) => `Curso de inglés A1\n${body}\nAula de Idiomas · www.aula.dev · página ${n} de 3\n${n}`;
  const raw = [page(1, "Hello, my name is Ana."), page(2, "I live in Bogotá."), page(3, "I like books.")].join("\n\n");

  it("quita encabezado y pie repetidos y los números de página", () => {
    const out = stripPageFurniture(raw);
    expect(out).toBe("Hello, my name is Ana.\n\nI live in Bogotá.\n\nI like books.");
  });

  it("no toca un PDF de una sola página salvo el número suelto", () => {
    expect(stripPageFurniture("Título\nCuerpo del texto.\n7")).toBe("Título\nCuerpo del texto.");
  });

  it("quita el membrete de una ficha (PDFTests.com) y deja el título y los ejercicios", () => {
    const raw = [
      "PDFTests.com Ficha de ejercicios 39 ejercicios · 25 min A1",
      "F I C H A D E E J E R C I C I O S",
      "Adverbios de frecuencia – Ficha 1",
      "Haz esta ficha en línea y comprueba tus",
      "Nombre: Clase: Fecha: Puntuación: / 39",
      "respuestas al instante",
      "1. I always get up early.",
      "2. She never eats meat.",
    ].join("\n");
    expect(stripPageFurniture(raw)).toBe("Adverbios de frecuencia – Ficha 1\n1. I always get up early.\n2. She never eats meat.");
  });
});
