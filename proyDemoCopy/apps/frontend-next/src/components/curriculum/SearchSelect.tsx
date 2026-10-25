"use client";
import { Search } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useDebounce } from "@/hooks/useDebounce";
// [SearchSelect]: selector con búsqueda (combobox ARIA) para temas y fuentes | debounce 250 ms, cancelación de peticiones y caché por consulta

export interface SearchOption {
  id: string;
  label: string;
  hint?: string; // Texto secundario (p. ej. slug o licencia)
}

export interface SearchSelectProps<T extends SearchOption> {
  id: string;
  label: string;
  placeholder: string;
  value: T | null;
  onSelect: (option: T | null) => void;
  // [Carga]: recibe el texto y una señal de cancelación; solo se invoca con el desplegable abierto
  fetchOptions: (query: string, signal: AbortSignal) => Promise<T[]>;
  // [Clave de contexto]: al cambiar (idioma/nivel/competencia/tipo) se invalida la caché
  contextKey: string;
  disabled?: boolean;
  disabledHint?: string;
  footer?: ReactNode; // Acción extra (p. ej. "+ Crear nuevo tema")
}

export function SearchSelect<T extends SearchOption>({
  id,
  label,
  placeholder,
  value,
  onSelect,
  fetchOptions,
  contextKey,
  disabled,
  disabledHint,
  footer,
}: SearchSelectProps<T>) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(-1); // Opción resaltada con el teclado
  const debounced = useDebounce(query, 250);
  const cache = useRef(new Map<string, T[]>()); // Evita repetir la misma consulta
  const rootRef = useRef<HTMLDivElement>(null);

  // [Invalidación]: nuevo contexto → caché vacía
  useEffect(() => {
    cache.current.clear();
  }, [contextKey]);

  // [Búsqueda]: solo con el desplegable abierto y el control habilitado
  useEffect(() => {
    if (!open || disabled) return;
    const cacheKey = `${contextKey}|${debounced.trim().toLowerCase()}`;
    const cached = cache.current.get(cacheKey);
    if (cached) {
      setOptions(cached);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchOptions(debounced.trim(), controller.signal)
      .then((res) => {
        cache.current.set(cacheKey, res);
        setOptions(res);
        setActive(-1);
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setError("No se pudieron cargar las opciones");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort(); // Cancela la petición anterior si el texto cambia
  }, [open, disabled, debounced, contextKey, fetchOptions]);

  // [Cierre al hacer clic fuera]
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (opt: T) => {
    onSelect(opt);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && open && active >= 0 && options[active]) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative space-y-1.5" ref={rootRef}>
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {label}
      </label>
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Search aria-hidden className="mx-auto size-10 text-tone-brand" />
        </span>
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-describedby={disabled && disabledHint ? `${id}-hint` : undefined}
          disabled={disabled}
          value={open ? query : (value?.label ?? "")}
          placeholder={disabled ? (disabledHint ?? placeholder) : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          className="control w-full pl-9 pr-8"
        />
        {value && !disabled && (
          <button
            type="button"
            aria-label={`Quitar ${label.toLowerCase()}`}
            onClick={() => onSelect(null)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        )}
      </div>
      {disabled && disabledHint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {disabledHint}
        </p>
      )}

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-lg">
          <ul id={listId} role="listbox" aria-label={label} className="max-h-60 overflow-auto py-1 text-sm">
            {loading && <li className="px-3 py-2 text-muted-foreground">Buscando…</li>}
            {error && <li className="px-3 py-2 text-destructive">{error}</li>}
            {!loading && !error && options.length === 0 && (
              <li className="px-3 py-2 text-muted-foreground">Sin resultados.</li>
            )}
            {!loading &&
              options.map((opt, i) => (
                <li
                  key={opt.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={value?.id === opt.id}
                  onMouseDown={(e) => e.preventDefault()} // Evita perder el foco antes del clic
                  onClick={() => choose(opt)}
                  className={`cursor-pointer px-3 py-2 ${i === active ? "bg-muted" : ""} ${value?.id === opt.id ? "font-semibold" : ""}`}
                >
                  {opt.label}
                  {opt.hint && <span className="ml-2 text-xs text-muted-foreground">{opt.hint}</span>}
                </li>
              ))}
          </ul>
          {footer && <div className="border-t px-3 py-2">{footer}</div>}
        </div>
      )}
    </div>
  );
}
