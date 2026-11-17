"use client"; // [Next.js]: Client Component → escucha clics y selección en el documento
import { useEffect, useState } from "react";
import { createPortal } from "react-dom"; // `createPortal` (React DOM): en <body> → un ancestro con `transform` no desplaza la tarjeta `fixed`
import { WordCard } from "@/components/reading/WordCard";
import { termKey, useMarkedWords } from "@/hooks/useVocabulary";
import { detectLanguage } from "@/lib/lang-detect";
// [WordDictionary · 2026-10-30]: el pequeño diccionario de docs/imagen.jpeg en TODO el portal → pulsar o seleccionar UNA palabra en otro idioma abre 🔊 + IPA + traducción + Aprender/Aprendido
// El idioma sale del atributo HTML `lang` más cercano: basta con marcar el contenido con `lang` para que funcione | [Patrón]: Event Delegation (un listener para toda la página) + Reuse (WordCard)
// [Principio]: DRY + OCP (pantalla nueva sin código extra) | [Paradigma]: Reactivo | [A11y]: los diálogos y el foco los gestiona WordCard

const MAX_WORD = 60; // = @MaxLength de LookupWordDto
// [Excluidos]: campos de edición y zonas que ya tienen su propio diccionario (lector de PDF, <aula-word-lookup>) o son acciones
const IGNORE = "input, textarea, select, [contenteditable], [data-word-card], [data-wi], aula-word-lookup, [aulaWordText], a, button, rt, [lang|=\"und\"], [data-ipa]";
// [2026-11-06 · Sin diccionario sobre el IPA]: símbolos fonéticos o texto entre barras («/ˈhʊnt/») no son palabras del idioma
const IPA = /[ˈˌːəɐɛɪʊʌɔæɑɒʃʒθðŋɹɾʁχçʏøœɲʎʔ]|^\/.*\/$/u;

interface Hit {
  word: string;
  lang: string;
  sentence: string;
  rect: DOMRect;
  el: HTMLElement | null;
}

// [languageOf]: idioma del ancestro con `lang`, salvo <html> (idioma de la interfaz) y el español (no hay nada que traducir) | Función pura sobre el DOM
const languageOf = (el: Element | null | undefined): string | null => {
  const host = el?.closest<HTMLElement>("[lang]");
  if (!host || host === document.documentElement) return null;
  const lang = host.lang.toLowerCase().split("-")[0]!;
  return lang && lang !== "es" ? lang : null;
};
// [contentLanguage · 2026-10-30]: palabra seleccionada dentro de un contenido de curso (Markdown `data-dict-lang`) aunque su frase esté en español → se busca, salvo que la palabra sea claramente española
const contentLanguage = (el: Element | null | undefined, word: string): string | null => {
  const lang = el?.closest<HTMLElement>("[data-dict-lang]")?.dataset.dictLang;
  return lang && detectLanguage(word, [lang, "es"]) !== "es" ? lang : null;
};
// [cleanWord]: sin signos en los bordes («farm,» → «farm») | `\p{L}` (Unicode): cualquier alfabeto
const cleanWord = (s: string) => s.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").slice(0, MAX_WORD);
const sentenceOf = (el: Element | null | undefined) => (el?.closest("li, p, td, h1, h2, h3, h4")?.textContent ?? "").trim().slice(0, 400);

export function WordDictionary() {
  const [hit, setHit] = useState<Hit | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element;
      const selection = window.getSelection();
      const selected = selection?.toString().trim() ?? "";
      if (selected && selection?.rangeCount) {
        // Selección: solo una palabra (varias = el usuario está copiando o leyendo)
        const host = selection.getRangeAt(0).startContainer.parentElement;
        const word = cleanWord(selected);
        const lang = languageOf(host) ?? contentLanguage(host, word);
        if (/\s/.test(selected) || !lang || host?.closest(IGNORE) || IPA.test(selected) || /^[/[].*[/\]]$/.test(host?.textContent?.trim() ?? "")) return;
        if (word) setHit({ word, lang, sentence: sentenceOf(host), rect: selection.getRangeAt(0).getBoundingClientRect(), el: null });
        return;
      }
      // Palabra pulsable del temario (Markdown con `lang`)
      const el = target.closest?.<HTMLElement>("[data-dict-word]");
      const lang = languageOf(el);
      const word = cleanWord(el?.textContent ?? "");
      if (el && lang && word) setHit({ word, lang, sentence: sentenceOf(el), rect: el.getBoundingClientRect(), el });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick); // Cleanup de `useEffect`
  }, []);

  return hit && <OpenCard key={`${hit.lang}:${hit.word}:${hit.rect.top}`} hit={hit} onClose={() => setHit(null)} />;
}

// [OpenCard]: montada solo con una palabra abierta → el banco de vocabulario no se pide en cada página
function OpenCard({ hit, onClose }: { hit: Hit; onClose: () => void }) {
  const vocab = useMarkedWords(hit.lang);
  return createPortal(
    <div data-word-card>
      <WordCard
        word={hit.word}
        sentence={hit.sentence}
        lang={hit.lang}
        anchor={hit.rect}
        returnFocus={hit.el}
        marked={vocab.words.get(termKey(hit.word))}
        busy={vocab.busy}
        saveError={vocab.error}
        onStatus={(status, translation) => void vocab.setStatus(hit.word, status, { translation, sentence: hit.sentence })}
        onClose={onClose}
      />
    </div>,
    document.body,
  );
}
