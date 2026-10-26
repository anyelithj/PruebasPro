// [youtubeEmbed · 2026-10-25]: enlace de YouTube (watch, youtu.be, shorts, embed) → URL de inserción privada (youtube-nocookie) | null si no es YouTube
// Así los videos de un curso se ven DENTRO de la aplicación (antes solo había un botón «Abrir enlace») | Función pura
export function youtubeEmbed(url: string | null | undefined): string | null {
  const m = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i.exec((url ?? "").trim());
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}
