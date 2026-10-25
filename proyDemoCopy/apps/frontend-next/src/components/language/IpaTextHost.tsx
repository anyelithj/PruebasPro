"use client"; // [Next.js]: Client Component → comprueba en el navegador si el Custom Element ya está registrado
import { useEffect, useState } from "react";
// [IpaTextHost · Sprint 8.4]: monta <aula-ipa-text> (Angular Element del módulo Vocabulary) con respaldo de texto plano si el remoto no responde | [Patrón]: Adapter (React ↔ Web Component) + Graceful Degradation | [Principio]: bajo acoplamiento (Next solo pasa atributos) + DRY (misma consulta cacheada que el traductor) | [Paradigma]: Declarativo
// [Uso]: fichas de vocabulario sin IPA guardado → IPA automático UK/US (espeak-ng vía NestJS/FastAPI); el IPA que escribió el docente sigue mandando (extiende, no migra)
// [Rendimiento]: el bundle Angular lo carga <AngularElements /> una vez en el layout del portal; aquí solo se espera su registro

const WAIT_MS = 4000; // Si en 4 s no se registró la etiqueta, se queda el texto plano

// [useCustomElement · Sprints 8.4/10.4]: ¿el remoto Angular ya registró la etiqueta? → null = aún no se sabe · false = no llegó en 4 s (respaldo de texto plano) | [Patrón]: Custom Hook | [Principio]: DRY (lo usan IpaTextHost y WordLookupHost)
export function useCustomElement(tag: string): boolean | null {
  // `useState` (React): null en el primer render → igual en servidor y cliente (sin errores de hidratación)
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    // `customElements.whenDefined` (DOM): promesa que se cumple al registrarse la etiqueta | carrera con un temporizador de respaldo
    let alive = true;
    const timer = setTimeout(() => alive && setReady(false), WAIT_MS);
    void customElements.whenDefined(tag).then(() => {
      clearTimeout(timer);
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [tag]);

  return ready;
}

// `ipaOnly` (2026-10-23): solo IPA (+ traducción si `withTranslation`) bajo una frase que ya se muestra → ejemplos y frases con pronunciación escrita
// `withSwitch` (2026-10-23): fuerza el interruptor UK/US también en modo ipa-only (fichas de vocabulario y pronunciación en inglés)
export function IpaTextHost({ text, language, withTranslation = false, ipaOnly = false, withSwitch = !ipaOnly, fallback = null }: { text: string; language: string; withTranslation?: boolean; ipaOnly?: boolean; withSwitch?: boolean; fallback?: React.ReactNode }) {
  const ready = useCustomElement("aula-ipa-text");

  if (!text.trim()) return null;
  // [Respaldo]: sin remoto → solo el texto (nunca un hueco ni un error en la ficha)
  if (ready !== true) return ipaOnly ? (ready === false ? fallback : null) : <span lang={language}>{ready === false ? text : null}</span>; // ipa-only sin remoto: la frase ya está escrita arriba → `fallback` (p. ej. el IPA guardado)
  return <aula-ipa-text text={text} language={language} with-translation={withTranslation ? "true" : "false"} with-switch={language === "en" && withSwitch ? "true" : "false"} ipa-only={ipaOnly ? "true" : "false"} />;
}
