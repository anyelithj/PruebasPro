// [@aula/ui-tokens · cefr-colors · Sprint 7.8]: color de cada banda MCER (A1–C2) — diploma de certificados, Tutor IA y Corrector de redacciones | [Patrón]: Lookup Table + SSOT | [Principio]: DRY (un mapa para Next.js y Angular; NestJS lo espeja en shared/domain/cefr-level.vo.ts para el PDF) | [Paradigma]: Declarativo
// [Progresión]: verde (A1) → turquesa → azul → morado de marca → magenta → oro (C2) · `color` = acento (bordes, chips, sello) · `deep` = fondo oscuro con texto blanco (cabecera del diploma, burbujas)
// [A11y]: el nivel siempre se muestra también en texto (el color nunca es el único portador del significado)
import type { CefrLevel } from "../shared-schemas"; // `import type` (TS): se borra al compilar → sin dependencia de runtime

export interface CefrColor {
  readonly color: string;
  readonly deep: string;
}

export const CEFR_COLORS: Readonly<Record<CefrLevel, CefrColor>> = Object.freeze({
  A1: { color: "#22C55E", deep: "#166534" },
  A2: { color: "#14B8A6", deep: "#0F5560" },
  B1: { color: "#1B7EC8", deep: "#12507F" },
  B2: { color: "#8B5CF6", deep: "#2A0D7A" },
  C1: { color: "#EC4899", deep: "#831843" },
  C2: { color: "#D4A017", deep: "#8B6914" },
});

export const NEUTRAL_LEVEL_COLOR: CefrColor = { color: "#6D28D9", deep: "#2A0D7A" }; // Cursos sin banda MCER → morado de marca

// [cefrColor]: nivel desconocido o null → color de marca | `Object.hasOwn` (ES2022) evita claves heredadas del prototipo
export const cefrColor = (level: string | null | undefined): CefrColor =>
  level && Object.hasOwn(CEFR_COLORS, level) ? CEFR_COLORS[level as CefrLevel] : NEUTRAL_LEVEL_COLOR;
