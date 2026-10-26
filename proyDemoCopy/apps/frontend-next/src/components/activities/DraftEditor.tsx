"use client"; // [Next.js]: Client Component → edición en línea de las filas del borrador
import { Trash2 } from "lucide-react";
import type { Entry, KindStrategy } from "@/lib/activity-kinds";
import { FieldInput } from "./FieldInput";
// [DraftEditor · 2026-10-24]: lista editable de filas (ítems, turnos, ejemplos, conceptos) — los campos los declara la estrategia del tipo
// SIN ventanas modales: cada fila es una tarjeta en la página (como los elementos de «Crear recurso») | [Patrón]: Composite + Controlled Component
// [Principio]: OCP (el editor no conoce los tipos) + DRY | [A11y]: <ol> con aria-label, cada fila con título y botón «Quitar» con nombre accesible

export const UID = "_uid"; // Clave técnica de cada fila → `key` estable de React (se ignora al guardar: las estrategias leen solo sus campos)

interface DraftEditorProps {
  strategy: KindStrategy;
  entries: Entry[];
  onChange: (entries: Entry[]) => void;
  invalid?: boolean;
}

export function DraftEditor({ strategy, entries, onChange, invalid = false }: DraftEditorProps) {
  // [Inmutabilidad]: copia nueva del array y de la fila → React detecta el cambio | [Paradigma]: Funcional
  const update = (i: number, key: string, value: string) => onChange(entries.map((e, j) => (j === i ? { ...e, [key]: value } : e)));
  const remove = (i: number) => onChange(entries.filter((_, j) => j !== i));
  const many = strategy.entry.length > 3; // Muchos campos (poliglota) → rejilla de 4 columnas en pantallas grandes

  if (!entries.length) return <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Aún no hay {strategy.entryLabel.toLowerCase()}s. Añádelos a mano, con IA o importando.</p>;

  return (
    <ol aria-label={strategy.entriesTitle} className="space-y-3">
      {entries.map((e, i) => (
        <li key={e[UID] ?? i} aria-invalid={invalid || undefined} className="rounded-xl border border-border bg-card p-4">
          <header className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold">
              {strategy.entryLabel} {i + 1}
            </h3>
            <button type="button" onClick={() => remove(i)} aria-label={`Quitar ${strategy.entryLabel.toLowerCase()} ${i + 1}`} className="btn btn-ghost btn-sm text-tone-danger">
              <Trash2 aria-hidden className="size-4" /> Quitar
            </button>
          </header>
          <div className={many ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" : "grid gap-3 sm:grid-cols-2"}>
            {strategy.entry.map((f) => (
              <FieldInput key={f.key} id={`entry-${e[UID] ?? i}-${f.key}`} field={f} value={e[f.key] ?? ""} onChange={(v) => update(i, f.key, v)} />
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
