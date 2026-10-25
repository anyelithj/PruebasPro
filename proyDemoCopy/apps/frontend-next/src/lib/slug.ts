// [Slug determinista]: espejo exacto de apps/backend/src/modules/curriculum/domain/slug.ts (vista previa en UI; el backend es la autoridad) | [Paradigma]: Funcional

const CYRILLIC: Readonly<Record<string, string>> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const SPECIAL: Readonly<Record<string, string>> = { ß: "ss", æ: "ae", œ: "oe", ø: "o", đ: "d", ł: "l" };

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[Ѐ-ӿ]/g, (c) => CYRILLIC[c] ?? "")
    .replace(/[ßæœøđł]/g, (c) => SPECIAL[c] ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
