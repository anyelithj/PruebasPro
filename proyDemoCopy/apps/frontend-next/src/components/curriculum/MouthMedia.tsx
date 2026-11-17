import { youtubeEmbed } from "@/lib/youtube";
// [MouthMedia · 2026-11-14]: imagen o video de la BOCA en «Cómo se pronuncia» (fichas de pronunciación)
// Valor = clave subida («video-mp4-<uuid>», se sirve por el BFF con Range/206) o URL https (imagen externa, .mp4/.webm o YouTube → iframe youtube-nocookie)
// [Patrón]: Presentational (sin "use client": sirve en Server y Client Components) | [A11y]: texto alternativo / título; video con controles, sin sonido
// automático, en bucle y `playsInline` (iOS no lo abre a pantalla completa) | [Rendimiento]: `loading="lazy"` y `preload="metadata"`

export const mouthMediaUrl = (key: string): string => (key.startsWith("https://") ? key : `/api/pronunciation-media/${encodeURIComponent(key)}`);

// [mouthMediaKind]: cómo pintar el valor | función pura exportada para pruebas
export function mouthMediaKind(value: string): "youtube" | "video" | "image" {
  if (youtubeEmbed(value)) return "youtube";
  if (value.startsWith("video-") || /^https:\/\/\S+\.(mp4|webm)(\?|#|$)/i.test(value)) return "video";
  return "image";
}

export function MouthMedia({ mediaKey, label = "Posición de la boca", className = "" }: { mediaKey: string; label?: string; className?: string }) {
  const box = `w-full max-w-sm rounded-xl border border-border bg-black/5 object-contain ${className}`;
  const kind = mouthMediaKind(mediaKey);
  if (kind === "youtube")
    return (
      <iframe
        src={youtubeEmbed(mediaKey) ?? undefined}
        title={label}
        loading="lazy"
        allow="encrypted-media; picture-in-picture"
        allowFullScreen
        className={`aspect-video ${box}`}
      />
    );
  const src = mouthMediaUrl(mediaKey);
  return kind === "video" ? (
    <video src={src} controls muted loop playsInline preload="metadata" aria-label={label} className={box} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- archivo privado del BFF o URL externa del docente (next/image exigiría dominios fijos)
    <img src={src} alt={label} loading="lazy" referrerPolicy="no-referrer" className={box} />
  );
}
