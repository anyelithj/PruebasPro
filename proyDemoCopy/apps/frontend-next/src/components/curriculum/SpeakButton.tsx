"use client"; // [Next.js]: Client Component → usa la Web Speech API del navegador
import { Turtle, Volume2 } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { useSyncExternalStore } from "react";
import { hasNaturalVoice, playServerAudio, speak } from "@/lib/speech";
// [SpeakButton]: botón 🔊 que pronuncia un texto: primero el audio cacheado del servidor (Sprint 4.7) y, si falla, la voz del navegador | [Patrón]: Presentational + Progressive Enhancement + Fallback | [Principio]: SRP + DRY | [Paradigma]: Declarativo
// Se puede usar dentro de Server Components (fichas de /resources): solo este botón se hidrata

const noop = () => () => {};

export interface SpeakButtonProps {
  text: string; // Qué se pronuncia
  lang: string; // Código ISO 639-1 ("en", "fr"…)
  label: string; // Texto accesible (aria-label), p. ej. "Escuchar «apple»"
  slow?: boolean; // Velocidad 0.7 para practicar
  size?: "sm" | "md";
  variant?: string; // Variante regional de la IPA (en-GB, pt-BR…) → misma variante en el audio
}

export function SpeakButton({ text, lang, label, slow = false, size = "sm", variant }: SpeakButtonProps) {
  // `useSyncExternalStore` (React 18): sin desajuste de hidratación (servidor → false, cliente → true); el audio del servidor funciona en cualquier navegador
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  if (!hydrated) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault(); // Dentro de una tarjeta-enlace no navega
        e.stopPropagation();
        const rate = slow ? 0.7 : 1;
        // `void` (JS): la promesa se atiende dentro; sin audio del servidor → voz del navegador
        // [2026-10-20]: voz natural del sistema primero (suena humana); el audio de espeak-ng del servidor queda de respaldo
        if (hasNaturalVoice(variant ?? lang) && speak(text, variant ?? lang, rate)) return;
        void playServerAudio(text, lang, rate, variant).then((ok) => ok || speak(text, lang, rate));
      }}
      aria-label={label}
      title={label}
      className={`inline-grid shrink-0 place-items-center rounded-full border border-tone-brand-line bg-tone-brand-soft text-tone-brand transition-colors hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${size === "md" ? "size-8 text-sm" : "size-6 text-[11px]"}`}
    >
      {slow ? <Turtle aria-hidden className="size-3.5" /> : <Volume2 aria-hidden className="size-3.5" />}
    </button>
  );
}
