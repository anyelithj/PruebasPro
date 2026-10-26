"use client"; // [Next.js]: Client Component → campo controlado (estado en el formulario padre)
import type { FieldDef } from "@/lib/activity-kinds";
import { cn } from "@/lib/utils";
// [FieldInput · 2026-10-24]: pinta UN campo declarado en la estrategia del tipo (texto, área, select, enlace o casilla) → el formulario de «Crear actividad» no conoce los tipos
// [Patrón]: Presentational + Factory por `field.type` | [Principio]: OCP (tipo nuevo de campo = una rama) + DRY | [A11y]: <label> asociado por `id`, `aria-describedby` para la ayuda, `*` visual de obligatorio

interface FieldInputProps {
  id: string;
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}

export function FieldInput({ id, field, value, onChange, invalid = false }: FieldInputProps) {
  const hintId = field.hint ? `${id}-hint` : undefined;
  // `aria-invalid`: `.control` pinta el borde rojo y el lector de pantalla anuncia el error
  const common = { id, required: field.required, "aria-invalid": invalid || undefined, "aria-describedby": hintId, className: "control w-full" };

  if (field.type === "checkbox") {
    // [Casilla]: valor "true" | "" (todo el borrador es texto → un solo tipo de estado)
    return (
      <div className={cn(field.wide && "sm:col-span-2")}>
        <label htmlFor={id} className="flex cursor-pointer items-start gap-2 text-sm">
          <input id={id} type="checkbox" checked={value === "true"} onChange={(e) => onChange(e.target.checked ? "true" : "")} aria-invalid={invalid || undefined} className="mt-0.5 size-4 accent-primary" />
          <span>
            {field.label} {field.required && <span className="req" aria-hidden>*</span>}
          </span>
        </label>
      </div>
    );
  }

  return (
    <div className={cn(field.wide && "sm:col-span-2")}>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-muted-foreground">
        {field.label} {field.required && <span className="req" aria-hidden>*</span>}
      </label>
      {field.type === "select" ? (
        <select {...common} value={value} onChange={(e) => onChange(e.target.value)}>
          {!field.required && <option value="">—</option>}
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        // `field-sizing` no es universal → filas fijas y redimensionable en vertical
        <textarea {...common} rows={3} maxLength={field.max} placeholder={field.placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="control w-full resize-y" />
      ) : (
        // `type="url"` + `inputMode`: teclado de enlaces en móvil y validación nativa
        <input {...common} type={field.type === "url" ? "url" : "text"} inputMode={field.type === "url" ? "url" : undefined} maxLength={field.max} placeholder={field.placeholder} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
      )}
      {field.hint && (
        <p id={hintId} className="mt-1 text-[11px] text-muted-foreground">
          {field.hint}
        </p>
      )}
    </div>
  );
}
