// [youtubeEmbed · 2026-10-25]: enlace de YouTube (watch, youtu.be, shorts, embed) → URL de inserción privada (youtube-nocookie) | null si no es YouTube
// Así los videos de un curso se ven DENTRO de la aplicación (antes solo había un botón «Abrir enlace») | Función pura
export function youtubeEmbed(url: string | null | undefined): string | null {
  const m = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i.exec((url ?? "").trim());
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

// [youtubeEmbeddable · 2026-11-05]: oEmbed responde 401/403 si el dueño desactivó la reproducción incrustada → el iframe solo mostraría «Video no disponible»
// Fail-open: sin red o con otro error se intenta el iframe igualmente | `next.revalidate` (Next.js): una consulta por video al día
export async function youtubeEmbeddable(url: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { next: { revalidate: 86_400 } });
    return res.status !== 401 && res.status !== 403;
  } catch {
    return true;
  }
}
