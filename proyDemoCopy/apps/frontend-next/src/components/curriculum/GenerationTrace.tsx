import { PenLine } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import type { CurriculumGeneration } from "@/types/curriculum";
// [GenerationTrace]: muestra la traza de una generación con IA (modelo, cuantización, tokens, latencia, memoria, banderas) | [Patrón]: Presentational | [Principio]: SRP + Honestidad de datos (un dato no informado se muestra "—", nunca se estima)
// [Tecnología]: componente sin estado → sirve en Server Components (detalle) y en Client Components (formulario)

// [Formateadores]: `Intl.NumberFormat` (ECMA-402) para miles; bytes → GB con 1 decimal | [Paradigma]: Funcional (puras)
const num = (v: number | null) => (v === null ? "—" : new Intl.NumberFormat("es-CO").format(v));
const gb = (v: number | null) => (v === null ? "—" : `${(v / 1024 ** 3).toFixed(1)} GB`);
const ms = (v: number | null) => (v === null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`);

// [Bandera]: pastilla con el nombre de la especificación (REQUIERE_REVISION, LLM_REQUIRED…) | significado también en texto (WCAG 1.4.1)
function Flag({ on, label, tone }: { on: boolean; label: string; tone: "warning" | "brand" | "info" }) {
  const cls = { warning: "bg-tone-warning-soft text-tone-warning", brand: "bg-tone-brand-soft text-tone-brand", info: "bg-tone-info-soft text-tone-info" }[tone];
  return <span className={`badge font-mono ${on ? cls : "bg-muted text-muted-foreground line-through"}`}>{label} = {String(on)}</span>;
}

export function GenerationTrace({ trace, humanEdited }: { trace: CurriculumGeneration; humanEdited?: boolean }) {
  const f = trace.flags;
  // `ReadonlyArray<[string, string]>` (TS): pares etiqueta/valor para una <dl> accesible
  const rows: ReadonlyArray<[string, string]> = [
    ["Modelo", `${trace.model}${trace.parameterSize ? ` · ${trace.parameterSize}` : ""}`],
    ["Cuantización", trace.quantization ?? "—"],
    ["Versión (digest)", trace.modelDigest ? trace.modelDigest.slice(0, 12) : "—"],
    ["Tokens entrada / salida", `${num(trace.promptTokens)} / ${num(trace.outputTokens)}`],
    ["Latencia (carga)", `${ms(trace.latencyMs)} (${ms(trace.loadMs)})`],
    ["RAM / VRAM del modelo", `${gb(trace.ramBytes)} / ${gb(trace.vramBytes)}`],
    ["Versión del prompt", trace.promptVersion],
    ["Generado", new Date(trace.createdAt).toLocaleString("es")],
  ];
  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap gap-1.5">
        <Flag on={f.requiresReview} label="REQUIERE_REVISION" tone="warning" />
        <Flag on={f.llmRequired} label="LLM_REQUIRED" tone="info" />
        <Flag on={f.reusable} label="REUTILIZABLE" tone="brand" />
        {/* [Contradicciones]: 'not_checked' se dice tal cual — no se afirma una verificación que no ocurrió */}
        <span className="badge bg-muted font-mono text-muted-foreground">
          CONTRADICCION_DETECTADA = {f.contradiction === "detected" ? "true" : f.contradiction === "none" ? "false" : "no comprobada (una sola fuente)"}
        </span>
        {humanEdited !== undefined && <span className={`badge ${humanEdited ? "bg-tone-brand-soft text-tone-brand" : "bg-muted text-muted-foreground"}`}>{humanEdited ? <><PenLine aria-hidden className="inline size-4 align-[-0.125em]" /> Editado por una persona</> : "Sin cambios humanos"}</span>}
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-tone-warning">
        {f.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="eeg-mono">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
