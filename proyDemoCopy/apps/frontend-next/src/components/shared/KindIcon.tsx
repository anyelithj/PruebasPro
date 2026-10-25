import { ArrowLeftRight, BookOpen, ClipboardList, Languages, LayoutGrid, PencilLine, Quote, TriangleAlert, Volume2, type LucideIcon, type LucideProps } from "lucide-react";
import type { CurriculumItemKind } from "@/types/curriculum";
// [KindIcon · 2026-10-23]: icono SVG (lucide) de cada tipo de recurso → reemplaza los emojis de chips, tablas, portadas y tarjetas (antes mezcla de emojis e iconos)
// [Patrón]: Lookup Table + Atomic Design (átomo) | [Principio]: SSOT (un icono por tipo en todo el portal) + consistencia visual | [Tecnología]: lucide-react (mismo set que el menú lateral)
// [A11y]: decorativo por defecto (`aria-hidden`); el nombre del tipo siempre va escrito al lado

export const KIND_ICON: Readonly<Record<CurriculumItemKind, LucideIcon>> = {
  vocabulary: Languages,
  grammar_rule: BookOpen,
  example: Quote,
  translation: ArrowLeftRight,
  pronunciation: Volume2,
  common_error: TriangleAlert,
  exercise: PencilLine,
  rubric: ClipboardList,
};

// `kind` opcional → «Todos» (cuadrícula) | `LucideProps`: tamaño y clases como cualquier icono lucide
export function KindIcon({ kind, className = "size-4", ...rest }: { kind?: CurriculumItemKind } & LucideProps) {
  const Icon = kind ? (KIND_ICON[kind] ?? LayoutGrid) : LayoutGrid;
  return <Icon aria-hidden className={className} {...rest} />;
}
