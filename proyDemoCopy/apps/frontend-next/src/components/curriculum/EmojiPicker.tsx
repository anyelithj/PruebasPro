"use client"; // [Next.js]: Client Component → modal interactivo con búsqueda
import { useDeferredValue, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// [EmojiPicker]: ventana modal con TODOS los emojis Unicode (3.979 incluidos los tonos de piel), agrupados por categoría y con búsqueda en español
// [Tecnologías]: emojibase-data (nombres y etiquetas en español) cargado con `import()` dinámico solo al abrir · Radix Dialog (foco atrapado, Escape) · `useDeferredValue` (React 18) para buscar sin bloquear la escritura
// [Patrón]: Controlled Component + Lazy Loading | [Principio]: SRP | [Rendimiento]: `content-visibility: auto` → el navegador solo pinta los grupos visibles

interface EmojiEntry {
  unicode: string;
  label: string;
  tags?: string[];
  group?: number;
  skins?: EmojiEntry[];
}
interface EmojiGroup {
  key: string;
  title: string;
  emojis: EmojiEntry[];
}

// [norm]: minúsculas y sin tildes para buscar | `normalize("NFD")` + `\p{M}` (Unicode)
const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// [loadGroups]: datos en español + nombres de grupo; los tonos de piel van justo después de su emoji base | `Promise.all` (ES2015)
let cache: Promise<EmojiGroup[]> | null = null; // Una sola descarga por sesión
function loadGroups(): Promise<EmojiGroup[]> {
  cache ??= Promise.all([import("emojibase-data/es/compact.json"), import("emojibase-data/es/messages.json")]).then(([data, messages]) => {
    const list = (data.default ?? data) as unknown as EmojiEntry[];
    const groups = ((messages.default ?? messages) as { groups: { key: string; message: string; order: number }[] }).groups;
    const byOrder = new Map<number, EmojiGroup>(groups.map((g) => [g.order, { key: g.key, title: g.message.charAt(0).toUpperCase() + g.message.slice(1), emojis: [] }]));
    const other: EmojiGroup = { key: "other", title: "Otros", emojis: [] };
    for (const e of list) {
      const target = (e.group !== undefined && byOrder.get(e.group)) || other;
      target.emojis.push(e, ...(e.skins ?? [])); // Spread (ES2015): base + variantes de tono
    }
    return [...byOrder.values(), other].filter((g) => g.emojis.length);
  });
  return cache;
}

export interface EmojiPickerProps {
  value?: string;
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ value, onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<EmojiGroup[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query); // La lista se filtra con prioridad baja → el input no se traba

  const openPicker = () => {
    setOpen(true);
    if (!groups)
      loadGroups()
        .then(setGroups)
        .catch(() => setError(true));
  };

  // [Filtro]: por nombre o etiqueta en español (sin tildes) | `useMemo`: solo al cambiar la búsqueda
  const visible = useMemo(() => {
    if (!groups) return [];
    const q = norm(deferred.trim());
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, emojis: g.emojis.filter((e) => norm(e.label).includes(q) || e.tags?.some((t) => norm(t).includes(q))) }))
      .filter((g) => g.emojis.length);
  }, [groups, deferred]);
  const total = groups?.reduce((n, g) => n + g.emojis.length, 0) ?? 0;

  const choose = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  return (
    <>
      <button type="button" onClick={openPicker} className="btn btn-outline btn-sm" aria-haspopup="dialog">
        <span aria-hidden>{value || "😀"}</span> Elegir emoji
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Elegir emoji</DialogTitle>
            <DialogDescription>{groups ? `${total.toLocaleString("es-CO")} emojis · busca por nombre en español (p. ej. «manzana», «perro», «reloj»).` : "Cargando emojis…"}</DialogDescription>
          </DialogHeader>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar emoji…" aria-label="Buscar emoji" className="control w-full" autoFocus />
          {/* [Índice de grupos]: salta a la categoría (enlaces a anclas) */}
          {groups && !query && (
            <nav aria-label="Categorías de emojis" className="flex flex-wrap gap-1">
              {groups.map((g) => (
                <a key={g.key} href={`#emoji-${g.key}`} className="chip text-xs" title={g.title}>
                  {g.emojis[0]?.unicode} <span className="hidden sm:inline">{g.title}</span>
                </a>
              ))}
            </nav>
          )}
          <div className="min-h-40 flex-1 overflow-y-auto pr-1">
            {error && <p role="alert" className="text-sm text-tone-danger">No se pudieron cargar los emojis.</p>}
            {groups && visible.length === 0 && <p className="text-sm text-muted-foreground">Sin resultados para «{query}».</p>}
            {visible.map((g) => (
              <section key={g.key} id={`emoji-${g.key}`} aria-label={g.title} className="mb-3 scroll-mt-2" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 400px" }}>
                <h3 className="sticky top-0 z-10 bg-background py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {g.title} <span className="font-normal">({g.emojis.length})</span>
                </h3>
                {/* [Grid de emojis]: cada uno es un botón con nombre accesible */}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-0.5">
                  {g.emojis.map((e) => (
                    <button
                      key={e.unicode}
                      type="button"
                      onClick={() => choose(e.unicode)}
                      title={e.label}
                      aria-label={e.label}
                      aria-pressed={value === e.unicode}
                      className="grid size-10 place-items-center rounded-lg text-2xl hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-tone-brand-soft"
                    >
                      {e.unicode}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
