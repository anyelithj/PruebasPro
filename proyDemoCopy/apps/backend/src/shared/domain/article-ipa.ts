// [article-ipa · 2026-11-06 · «der Hund /ˈhʊnt/ — le falta el artículo a la pronunciación»]: antepone el IPA del artículo cuando la palabra se muestra CON artículo
// y su IPA es solo del sustantivo | determinista (tabla fija, sin IA) → vale igual para lo generado con IA, lo importado y lo manual | [Paradigma]: Funcional (puro)
// ponytail: forma de cita del artículo (sin enlace ni elisión fonética); si un hablante nativo lo corrige a mano, no se toca (ya trae el artículo)

const ARTICLE_IPA: Record<string, Record<string, string>> = {
  de: { der: 'deːɐ̯', die: 'diː', das: 'das', den: 'deːn', dem: 'deːm', des: 'dɛs', ein: 'aɪ̯n', eine: 'ˈaɪ̯nə' },
  fr: { le: 'lə', la: 'la', les: 'le', "l'": 'l', un: 'œ̃', une: 'yn', des: 'de' },
  es: { el: 'el', la: 'la', los: 'los', las: 'las', un: 'un', una: 'ˈuna' },
  pt: { o: 'u', a: 'ɐ', os: 'uʃ', as: 'ɐʃ', um: 'ũ', uma: 'ˈumɐ' },
  en: { the: 'ðə', a: 'ə', an: 'ən' },
};

// [leadingArticle]: artículo con el que empieza lo mostrado («der Hund» → der · «l'eau» → l') | null si no hay
export function leadingArticle(language: string, shown: string): string | null {
  const table = ARTICLE_IPA[language];
  if (!table) return null;
  const s = shown.trim().toLowerCase();
  if (language === 'fr' && /^l['’]/.test(s)) return "l'";
  const first = s.split(/\s+/)[0] ?? '';
  return s.includes(' ') && first in table ? first : null;
}

// [withArticleIpa]: «der Hund» + «/ˈhʊnt/» → «/deːɐ̯ ˈhʊnt/» · IPA vacío, sin artículo o que ya lo trae → igual
export function withArticleIpa(language: string, shown: string | null | undefined, ipa: string | null | undefined): string | null | undefined {
  if (!ipa?.trim() || !shown) return ipa;
  const article = leadingArticle(language, shown);
  if (!article) return ipa;
  const art = ARTICLE_IPA[language]![article]!;
  const m = /^\s*([/[])?\s*(.*?)\s*([/\]])?\s*$/s.exec(ipa)!;
  const body = m[2]!;
  // Ya incluye el artículo: empieza por su IPA o tiene tantas palabras como lo mostrado («l'eau» es una sola palabra → solo cuenta el prefijo)
  if (body.startsWith(art)) return ipa;
  if (article !== "l'" && body.split(/\s+/).length >= shown.trim().split(/\s+/).length) return ipa;
  const joined = article === "l'" ? `${art}${body.replace(/^ˈ/, '')}` : `${art} ${body}`;
  return `${m[1] ?? ''}${joined}${m[3] ?? ''}`;
}

// [contentIpa]: ficha de vocabulario del currículo (lemma «der Hund» o lemma + article, ipa { value }) → IPA con el artículo | muta y devuelve la ficha
export function contentIpa(language: string, content: Record<string, unknown> | null | undefined): Record<string, unknown> | null | undefined {
  const ipa = content?.ipa as { value?: unknown } | undefined;
  const lemma = typeof content?.lemma === 'string' ? content.lemma.trim() : '';
  if (!content || !ipa || typeof ipa.value !== 'string' || !lemma) return content;
  const article = typeof content.article === 'string' ? content.article.trim() : '';
  const shown = !article || leadingArticle(language, lemma) ? lemma : article.endsWith("'") ? `${article}${lemma}` : `${article} ${lemma}`;
  ipa.value = withArticleIpa(language, shown, ipa.value) ?? ipa.value;
  return content;
}
