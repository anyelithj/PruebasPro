import { cn } from "@/lib/utils";
import { PROVENANCE_LABEL, STATUS_LABEL, type Provenance, type ReviewStatus } from "@/types/curriculum";
// [Átomos de estado]: insignias de estado editorial y procedencia | [Patrón]: Atomic Design (Atom) + Presentational Component | [Principio]: SRP + DRY | [Paradigma]: Funcional + Declarativo (JSX)
// [Tecnología]: React Server Component compatible (sin estado ni efectos) + Tailwind CSS
// [Accesibilidad]: el significado va en el TEXTO, no solo en el color (WCAG 1.4.1)

// `Readonly<Record<...>>` (TS): clases Tailwind por estado — tonos de la marca, sin verdes
const STATUS_CLASS: Readonly<Record<ReviewStatus, string>> = {
  draft: "bg-muted text-muted-foreground",
  generated: "bg-tone-info-soft text-tone-info", // IA sin revisar: se distingue siempre
  review_required: "bg-tone-warning-soft text-tone-warning",
  reviewed: "bg-tone-warning-soft text-tone-warning",
  approved: "bg-tone-brand-soft text-tone-brand",
  archived: "bg-muted text-muted-foreground",
};

const PROVENANCE_CLASS: Readonly<Record<Provenance, string>> = {
  manual: "bg-tone-brand-soft text-tone-brand",
  imported: "bg-tone-info-soft text-tone-info",
  generated: "bg-tone-brand-soft text-tone-brand", // Visible: nunca se oculta que es IA
  expert_validated: "bg-tone-brand-soft text-tone-brand",
};

// Clases base compartidas | [Principio]: DRY
const BASE = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap";

// `export function` (React): componente funcional; props tipadas con un objeto literal (TS)
export function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={cn(BASE, STATUS_CLASS[status])}>{STATUS_LABEL[status]}</span>; // `cn` combina clases condicionalmente
}

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  return <span className={cn(BASE, PROVENANCE_CLASS[provenance])}>{PROVENANCE_LABEL[provenance]}</span>;
}
