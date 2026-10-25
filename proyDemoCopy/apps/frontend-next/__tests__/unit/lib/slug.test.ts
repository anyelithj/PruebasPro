// [Test slug.ts]: mismos casos que el backend (curriculum-catalog.spec.ts) → vista previa y clave final coinciden
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it.each([
    ["Present Simple", "present-simple"],
    ["Present Perfect", "present-perfect"],
    ["Présent composé", "present-compose"],
    ["  There is / There are  ", "there-is-there-are"],
    ["Can / Can't", "can-can-t"],
    ["Straße--Übung", "strasse-ubung"],
    ["Падежи", "padezhi"],
    ["你好", ""],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
