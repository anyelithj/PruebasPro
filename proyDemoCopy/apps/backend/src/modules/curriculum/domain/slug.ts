// [Slug determinista]: convierte un nombre en clave URL-friendly sin IA (misma entrada → misma salida) | [Patrón]: Pure Function | [Paradigma]: Funcional
// [Tecnología]: TypeScript puro + String.prototype.normalize (Unicode NFD) — espejo exacto de apps/frontend-next/src/lib/slug.ts

// [Transliteración cirílica]: tabla fija para que los temas en ruso generen slug latino | `Readonly<Record<...>>` (TS)
const CYRILLIC: Readonly<Record<string, string>> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

// [Letras especiales]: no se descomponen con NFD
const SPECIAL: Readonly<Record<string, string>> = {
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  đ: 'd',
  ł: 'l',
};

export function slugify(input: string): string {
  return input
    .toLowerCase() // 1. minúsculas
    .replace(/[Ѐ-ӿ]/g, (c) => CYRILLIC[c] ?? '') // 2. cirílico → latino
    .replace(/[ßæœøđł]/g, (c) => SPECIAL[c] ?? '') // 3. letras especiales
    .normalize('NFD') // 4. separa letra base y acento (é → e + ́)
    .replace(/[̀-ͯ]/g, '') // 5. elimina los acentos
    .replace(/[^a-z0-9]+/g, '-') // 6. espacios y caracteres inválidos → guion
    .replace(/-+/g, '-') // 7. colapsa guiones múltiples
    .replace(/^-|-$/g, ''); // 8. quita guiones al inicio y final
}
