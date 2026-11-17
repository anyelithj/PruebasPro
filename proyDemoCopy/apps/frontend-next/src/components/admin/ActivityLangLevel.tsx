"use client"; // [Next.js]: Client Component → reacciona al cambio de los <select> sin recargar la página
import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, X } from "lucide-react"; // Iconos (además del texto: no solo color)
import { LANGUAGES, LEVEL_OPTIONS as LEVELS } from "@/lib/languages"; // [DRY]: mismos idiomas y niveles con nombre que «Crear recurso»
// [ActivityLangLevel · 2026-10-24]: paso «¿Para qué idioma y nivel?» de Gestión → Crear actividad
// El valor vive en la URL (?idioma=&nivel=) → el Server Component vuelve a pintar las tarjetas con esos parámetros y los editores Angular los reciben ya elegidos
// [Patrón]: URL State + Controlled Component | [Principio]: SSOT (la URL) + DRY | [A11y]: <label> visible por <select>, sin depender de color

const MIN_LANGUAGES = 2; // Poliglota compara al menos dos idiomas

// [LanguageChecks · 2026-11-11 → 2026-11-14]: multiselect DESPLEGABLE de idiomas de Poliglota (crear y editar), al estilo «Multiselect dropdown» de Mendix:
// campo con las etiquetas elegidas (× para quitar) → lista con casillas, buscador y «Seleccionar todos» | mínimo 2: no se puede quitar el penúltimo
// [Patrón]: Controlled Component (el padre guarda `value`) + Combobox/Listbox de WAI-ARIA | [Principio]: SRP + DRY (un componente para crear y editar)
// [A11y]: role="combobox" + aria-expanded · listbox con aria-multiselectable · opciones con aria-selected · teclado (↑ ↓ Enter/Espacio Esc) · texto además del color
// [Tecnología]: React 19 (useState, useRef, useEffect, useId) + Tailwind + lucide-react | sin dependencias nuevas
export function LanguageChecks({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false); // `useState` (React): ¿lista abierta?
  const [query, setQuery] = useState(""); // Texto del buscador
  const [active, setActive] = useState(0); // Opción resaltada con el teclado
  const box = useRef<HTMLDivElement>(null); // `useRef` (React): contenedor para detectar clics fuera
  const id = useId(); // `useId` (React): ids estables entre servidor y cliente para aria-*
  const listId = `${id}-list`;

  // [Clic fuera → cerrar]: `mousedown` (DOM) en el documento mientras la lista está abierta | limpieza al cerrar (sin fugas)
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // [Funciones puras]: filtro por nombre o código (sin tildes) y orden canónico de LANGUAGES al guardar
  const plain = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const shown = LANGUAGES.filter((l) => plain(`${l.label} ${l.value}`).includes(plain(query)));
  const sorted = (codes: string[]) => LANGUAGES.filter((l) => codes.includes(l.value)).map((l) => l.value);
  const locked = (code: string) => value.includes(code) && value.length <= MIN_LANGUAGES; // Quitarlo dejaría menos de 2
  const toggle = (code: string) => {
    if (locked(code)) return;
    onChange(sorted(value.includes(code) ? value.filter((x) => x !== code) : [...value, code]));
  };
  const allOn = value.length === LANGUAGES.length;

  // [Teclado del combobox]: ↓/↑ mueven el resaltado · Enter/Espacio marcan · Esc cierra (WAI-ARIA Authoring Practices)
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (shown.length ? (i + (e.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length : 0)); // `%`: da la vuelta
    } else if ((e.key === "Enter" || (e.key === " " && !query)) && open && shown[active]) {
      e.preventDefault();
      toggle(shown[active].value);
    }
  };

  return (
    <div ref={box} className="relative">
      <span id={`${id}-label`} className="mb-1 block text-xs font-semibold text-muted-foreground">
        Idiomas <span className="req" aria-hidden>*</span> <span className="font-normal">(mínimo {MIN_LANGUAGES})</span>
      </span>
      {/* [Campo]: etiquetas elegidas + buscador; clic en cualquier parte abre la lista */}
      <div className="control flex min-h-10 w-full flex-wrap items-center gap-1.5 py-1.5" onClick={() => setOpen(true)}>
        {sorted(value).map((code) => {
          const name = LANGUAGES.find((l) => l.value === code)?.label ?? code;
          return (
            <span key={code} className="inline-flex items-center gap-1 rounded-full bg-tone-brand-soft py-0.5 pl-2 pr-1 text-xs font-semibold text-tone-brand">
              <span className="font-mono">{code.toUpperCase()}</span> {name}
              <button
                type="button"
                aria-label={`Quitar ${name}`}
                title={locked(code) ? `Deben quedar al menos ${MIN_LANGUAGES} idiomas` : `Quitar ${name}`}
                disabled={locked(code)}
                onClick={(e) => (e.stopPropagation(), toggle(code))}
                className="rounded-full p-0.5 hover:bg-tone-brand-line disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X aria-hidden className="size-3" />
              </button>
            </span>
          );
        })}
        <input
          role="combobox"
          aria-labelledby={`${id}-label`}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${id}-${shown[active].value}` : undefined}
          value={query}
          placeholder={value.length ? "Buscar…" : "Elige los idiomas…"}
          onChange={(e) => (setQuery(e.target.value), setActive(0), setOpen(true))}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none"
        />
        <ChevronDown aria-hidden className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {/* [Seleccionar todos / dejar el mínimo]: atajo de Mendix | al desmarcar todos quedan los 2 primeros (regla del mínimo) */}
          <button
            type="button"
            onClick={() => onChange(allOn ? sorted(value).slice(0, MIN_LANGUAGES) : LANGUAGES.map((l) => l.value))}
            className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm font-semibold hover:bg-muted"
          >
            <span aria-hidden className={`grid size-4 place-items-center rounded border ${allOn ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
              {allOn && <Check className="size-3" />}
            </span>
            {allOn ? `Dejar solo ${MIN_LANGUAGES}` : "Seleccionar todos"}
          </button>
          <ul id={listId} role="listbox" aria-multiselectable="true" aria-labelledby={`${id}-label`} className="max-h-60 overflow-y-auto py-1">
            {shown.map((l, i) => {
              const on = value.includes(l.value);
              return (
                <li
                  key={l.value}
                  id={`${id}-${l.value}`}
                  role="option"
                  aria-selected={on}
                  aria-disabled={locked(l.value) || undefined}
                  onMouseDown={(e) => e.preventDefault()} // No roba el foco del buscador
                  onClick={() => toggle(l.value)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${i === active ? "bg-muted" : ""} ${locked(l.value) ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <span aria-hidden className={`grid size-4 place-items-center rounded border ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                    {on && <Check className="size-3" />}
                  </span>
                  <span className="w-7 font-mono text-xs text-muted-foreground">{l.value.toUpperCase()}</span>
                  {l.label}
                </li>
              );
            })}
            {!shown.length && <li className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// [2026-11-11 · Poliglota]: `languages` presente → multiselect de idiomas (?idiomas=en,fr…) en lugar del <select> de un idioma
export function ActivityLangLevel({ language, level, languages }: { language: string; level: string; languages?: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  // [2026-11-16 · RF-148]: al CREAR el nivel no se elige: lo asigna el tema o se estima del texto · solo con tema libre (?libre=1) se habilita
  const locked = params.get("libre") !== "1";

  // [set]: cambia un parámetro y reemplaza la URL (sin nueva entrada en el historial ni salto de scroll) | `URLSearchParams` (Web API)
  const set = (key: "idioma" | "nivel" | "idiomas", value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`?${next}`, { scroll: false });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {languages ? (
        <LanguageChecks value={languages} onChange={(v) => set("idiomas", v.join(","))} />
      ) : (
      <div>
        <label htmlFor="act-language" className="mb-1 block text-xs font-semibold text-muted-foreground">
          Idioma <span className="req" aria-hidden>*</span>
        </label>
        <select id="act-language" required value={language} onChange={(e) => set("idioma", e.target.value)} className="control w-full">
          <option value="">Elige idioma…</option>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      )}
      <div>
        <label htmlFor="act-level" className="mb-1 block text-xs font-semibold text-muted-foreground">
          Nivel del estudiante <span className="req" aria-hidden>*</span>
        </label>
        <select id="act-level" required={!locked} disabled={locked} value={level} onChange={(e) => set("nivel", e.target.value)} className="control w-full disabled:cursor-not-allowed disabled:opacity-70" aria-describedby="act-level-hint">
          <option value="">{locked ? "Se asigna solo" : "Elige nivel…"}</option>
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <p id="act-level-hint" className="mt-1 type-meta text-muted-foreground">
          {locked
            ? "Lo fija el tema del catálogo; en lecturas, canciones y diálogos se estima del texto al guardar. Podrás cambiarlo al editar."
            : "Tema libre: elige el nivel."}
        </p>
      </div>
    </div>
  );
}
