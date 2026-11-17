"use client"; // [Next.js]: Client Component → espera en el navegador el registro del Custom Element
import { useCustomElement } from "@/components/language/IpaTextHost";
// [WordLookupHost · Sprint 10.4 · RF-136]: envuelve un texto con <aula-word-lookup> (Angular Element de shared/ui) → cada palabra se pulsa y abre el diccionario con pronunciación, traducción, sonido, ejemplos y «Aprender»; si el remoto no responde queda el texto plano | [Patrón]: Adapter (React ↔ Web Component) + Graceful Degradation | [Principio]: bajo acoplamiento (Next solo pasa atributos) + DRY (useCustomElement) | [Paradigma]: Declarativo
// [Uso]: recursos, lecciones y lecturas de Next.js (extiende, no migra: el contenido no cambia)

// `ruleWords` (2026-11-14): palabras que ilustran la regla (fichas de pronunciación) → se resaltan solo esas y no las marcas «aprender» del usuario
// [Fix 2026-11-16]: lista vacía → «,» (modo regla sin resaltados) · un atributo vacío podía perderse y volvían las marcas del usuario («I», «some»)
export function WordLookupHost({ text, language, className, ruleWords }: { text: string; language?: string; className?: string; ruleWords?: string[] }) {
  const ready = useCustomElement("aula-word-lookup");
  // [Respaldo]: sin idioma o sin remoto → texto plano (nunca un hueco); mientras se decide también se muestra el texto (sin salto de diseño)
  if (!language || ready !== true) return <span lang={language} className={className}>{text}</span>;
  return <aula-word-lookup text={text} language={language} className={className} rule-words={ruleWords && (ruleWords.join(",") || ",")} />;
}
