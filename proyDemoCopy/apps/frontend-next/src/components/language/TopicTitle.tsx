"use client"; // [Next.js]: Client Component → pide el título traducido al BFF al montarse
import { useEffect, useState } from "react";
import { SpeakButton } from "@/components/curriculum/SpeakButton";
// [TopicTitle · 2026-10-19]: el tema de un vocabulario (guardado en español) en el IDIOMA ESTUDIADO con su IPA, su audio y la traducción al español
// → «🔤 The family /ðə ˈfæm.ɪ.li/ 🔊 · La familia» | [Patrón]: Presentational + Fetch-on-mount (BFF /api/vocabulary/lookup/topic → NestJS → FastAPI) | [Principio]: SRP + Progressive Enhancement (sin servicio, no se pinta nada) | [Paradigma]: Declarativo
// [A11y]: el título lleva `lang`, el IPA `lang="xx-fonipa"` (no se lee como texto) y el botón de audio un nombre con el título

interface Title {
  text: string;
  ipa: string;
  ipaUs: string | null;
  translationEs: string;
}

export function TopicTitle({ topic, language, className = "" }: { topic: string; language: string; className?: string }) {
  const [title, setTitle] = useState<Title | null>(null);

  useEffect(() => {
    if (!topic.trim() || topic.trim().length < 2 || !language) return;
    const controller = new AbortController(); // Cancela si cambia el tema o el idioma
    fetch("/api/vocabulary/lookup/topic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topic.trim(), language }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? (r.json() as Promise<Title>) : null))
      .then((t) => setTitle(t))
      .catch(() => undefined); // Servicio de idiomas apagado → el tema se sigue viendo en español
    return () => controller.abort();
  }, [topic, language]);

  if (!title) return null;
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${className}`}>
      <span className="font-bold text-tone-brand" lang={language}>
        {title.text}
      </span>
      {title.ipa && (
        <span className="eeg-mono text-xs text-muted-foreground" lang={`${language}-fonipa`}>
          {title.ipa.startsWith("/") ? title.ipa : `/${title.ipa}/`}
        </span>
      )}
      <SpeakButton text={title.text} lang={language} label={`Escuchar «${title.text}»`} />
      {language !== "es" && <span className="text-muted-foreground">· {title.translationEs}</span>}
    </p>
  );
}
