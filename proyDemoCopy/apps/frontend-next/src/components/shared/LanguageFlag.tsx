// [LanguageFlag · 2026-11-06]: bandera SVG por idioma de curso (EN, FR, DE, ES, PT, ZH, RU) — SVG y no emoji: Windows no dibuja las banderas emoji (salen letras)
// ES = Colombia y EN = Reino Unido, iguales que el selector de idioma del portal | decorativa (`aria-hidden`): el nombre del idioma va en texto
import type { ReactElement } from "react";

const FLAGS: Record<string, ReactElement> = {
  EN: (
    <>
      <rect width="18" height="12" fill="#012169" />
      <path d="M0 0l18 12M18 0L0 12" stroke="#fff" strokeWidth="2.4" />
      <path d="M0 0l18 12M18 0L0 12" stroke="#C8102E" strokeWidth="1.2" />
      <path d="M9 0v12M0 6h18" stroke="#fff" strokeWidth="4" />
      <path d="M9 0v12M0 6h18" stroke="#C8102E" strokeWidth="2.4" />
    </>
  ),
  FR: (
    <>
      <rect width="6" height="12" fill="#0055A4" />
      <rect x="6" width="6" height="12" fill="#fff" />
      <rect x="12" width="6" height="12" fill="#EF4135" />
    </>
  ),
  DE: (
    <>
      <rect width="18" height="4" fill="#000" />
      <rect y="4" width="18" height="4" fill="#DD0000" />
      <rect y="8" width="18" height="4" fill="#FFCE00" />
    </>
  ),
  ES: (
    <>
      <rect width="18" height="6" fill="#FCD116" />
      <rect y="6" width="18" height="3" fill="#003087" />
      <rect y="9" width="18" height="3" fill="#CE1126" />
    </>
  ),
  PT: (
    <>
      <rect width="7" height="12" fill="#006600" />
      <rect x="7" width="11" height="12" fill="#FF0000" />
      <circle cx="7" cy="6" r="2.4" fill="#FFCC00" />
    </>
  ),
  ZH: (
    <>
      <rect width="18" height="12" fill="#DE2910" />
      <path d="M3.5 1.6l.7 2.1h2.2l-1.8 1.3.7 2.1-1.8-1.3-1.8 1.3.7-2.1-1.8-1.3h2.2z" fill="#FFDE00" />
      {[
        [7, 1.2],
        [8.2, 2.6],
        [8.2, 4.4],
        [7, 5.8],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.55" fill="#FFDE00" />
      ))}
    </>
  ),
  RU: (
    <>
      <rect width="18" height="4" fill="#fff" />
      <rect y="4" width="18" height="4" fill="#0039A6" />
      <rect y="8" width="18" height="4" fill="#D52B1E" />
    </>
  ),
};

export function LanguageFlag({ code, size = 28 }: { code: string; size?: number }) {
  const flag = FLAGS[code.toUpperCase()];
  if (!flag) return null;
  return (
    <svg width={size} height={Math.round((size * 2) / 3)} viewBox="0 0 18 12" className="block shrink-0 rounded-[3px] shadow-sm ring-1 ring-black/10" aria-hidden>
      {flag}
    </svg>
  );
}
