// [Test 2026-11-03 · «26 … 30»]: página de soluciones a dos columnas → se lee la izquierda entera y luego la derecha; las tablas no se parten
import { pdfItemsToText, type PdfTextItem } from "@/lib/pdf-text";

const it_ = (str: string, x: number, y: number, width = str.length * 5): PdfTextItem => ({ str, transform: [10, 0, 0, 10, x, y], width, height: 10 });

describe("pdfItemsToText · dos columnas numeradas", () => {
  it("26, 27 (izquierda) antes que 30, 31 (derecha); el título que cruza queda arriba", () => {
    const text = pdfItemsToText([
      it_("Ejercicio 4: Corrige los errores — título que cruza la página entera", 40, 700, 520),
      it_("26. We often play games after school.", 40, 680, 240),
      it_("30. Is he always late?", 320, 680, 150),
      it_("Often va delante del verbo principal play.", 40, 665, 250),
      it_("En las preguntas con be, el adverbio va detrás.", 320, 665, 250),
      it_("27. My brother usually gets up at seven.", 40, 650, 250),
      it_("31. Do you ever play the guitar?", 320, 650, 200),
    ]);
    const order = [...text.matchAll(/(\d+)\./g)].map((m) => Number(m[1]));
    expect(text.split("\n")[0]).toMatch(/^Ejercicio 4/);
    expect(order).toEqual([26, 27, 30, 31]);
    expect(text).toContain("26. We often play games after school.\nOften va delante");
  });

  it("tabla «palabra → traducción» sigue en una fila con tabulador", () => {
    const text = pdfItemsToText([it_("apple", 40, 700), it_("manzana", 300, 700), it_("house", 40, 685), it_("casa", 300, 685)]);
    expect(text).toBe("apple\tmanzana\nhouse\tcasa");
  });
});
