"use client"; // [Next.js]: Client Component → edición en línea del título, el juego, el nivel y las palabras
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { updateDeckAction } from "@/app/(portal)/admin/activities/actions";
import { ACTIVITY_KINDS, DECK_GAMES, validateDraft, type ActivityDraft, type Entry } from "@/lib/activity-kinds";
import { LEVEL_OPTIONS } from "@/lib/languages";
import { DraftEditor, UID } from "./DraftEditor";
import { ResultDialog, useResultDialog } from "@/components/shared/ResultDialog"; // [2026-10-28]: MISMO modal de resultado que Recursos (antes volvía a la tabla sin ningún aviso)
// [DeckEditForm · 2026-10-27]: «Editar» de un juego con material propio (Gestión → Actividades → Juegos) — antes la fila no tenía edición y había que borrarlo y crearlo de nuevo
// [Patrón]: Controlled Form + Reuse (DraftEditor y la estrategia «games» de «Crear actividad») + Server Action | [Principio]: DRY (mismas reglas: validateDraft) + Fail Fast en el cliente (NestJS vuelve a validar)
// [A11y]: <label> asociados, errores en role="alert", botón con aria-busy | El idioma no se cambia (las palabras están en ese idioma): se muestra como texto

export interface DeckEditable {
  id: string;
  title: string;
  gameType: string;
  language: string;
  level: string | null;
  items: Array<{ term: string; translation?: string; emoji?: string; image?: string; category?: string; words?: string; question?: string; answer?: string }>;
}

const strategy = ACTIVITY_KINDS.games;
let seq = 0; // Contador de filas → `key` estable de React (UID)
const withUid = (e: Entry): Entry => ({ ...e, [UID]: e[UID] ?? `d${++seq}` });

export function DeckEditForm({ deck, languageName, backHref }: { deck: DeckEditable; languageName: string; backHref: string }) {
  const { show, dialog } = useResultDialog(); // [Modal]: éxito → Continuar → vuelve a Gestión · error → se corrige aquí
  const [title, setTitle] = useState(deck.title);
  const [gameType, setGameType] = useState(deck.gameType);
  const [level, setLevel] = useState(deck.level ?? "A2");
  // `useState(() => …)` (React): inicializador perezoso → las filas se convierten una sola vez
  const [entries, setEntries] = useState<Entry[]>(() =>
    deck.items.map((i) => withUid({ term: i.term, translation: i.translation ?? "", emoji: i.emoji ?? "", image: i.image ?? "", category: i.category ?? "", words: i.words ?? "", question: i.question ?? "", answer: i.answer ?? "" })),
  );
  const [error, setError] = useState<string | null>(null);
  // `useTransition` (React 18+): la Server Action corre sin bloquear la UI · `pending` = guardando
  const [pending, startTransition] = useTransition();

  const draft: ActivityDraft = { title, meta: { gameType }, entries };
  const ctx = { language: deck.language, level };
  const problems = validateDraft("games", draft, ctx);

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await updateDeckAction(deck.id, ctx, draft);
      if (!res.ok) {
        show({ ok: false, message: `No se pudo guardar el juego: ${res.message}` }); // [Error]: modal + aviso en línea
        return setError(res.message);
      }
      show({ ok: true, message: `«${title.trim()}» se actualizó con éxito.` }, backHref); // [Post/Redirect/Get]: Continuar → la tabla (ya revalidada por la acción)
    });

  return (
    <div className="space-y-5">
      <ResultDialog {...dialog} /> {/* [Modal de resultado]: controlado por useResultDialog */}
      <section className="surface grid gap-4 p-5 sm:grid-cols-2" aria-label="Datos del juego">
        <div className="sm:col-span-2">
          <label htmlFor="deck-title" className="mb-1 block text-xs font-semibold text-muted-foreground">
            Título <span className="req" aria-hidden>*</span>
          </label>
          <input id="deck-title" required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} className="control w-full" />
        </div>
        <div>
          <label htmlFor="deck-game" className="mb-1 block text-xs font-semibold text-muted-foreground">
            ¿Qué juego?
          </label>
          <select id="deck-game" value={gameType} onChange={(e) => setGameType(e.target.value)} className="control w-full">
            {DECK_GAMES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="deck-level" className="mb-1 block text-xs font-semibold text-muted-foreground">
            Nivel
          </label>
          <select id="deck-level" value={level} onChange={(e) => setLevel(e.target.value)} className="control w-full">
            {LEVEL_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <p className="type-meta text-muted-foreground sm:col-span-2">
          Idioma: <b>{languageName}</b> (no se cambia: las palabras están en este idioma).
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="deck-words">
        <h2 id="deck-words" className="title-section">
          {strategy.entriesTitle} <span className="text-sm font-normal text-muted-foreground">({entries.length})</span>
        </h2>
        <DraftEditor strategy={strategy} meta={{ gameType }} entries={entries} onChange={setEntries} />
        <button type="button" className="btn btn-outline" onClick={() => setEntries((xs) => [...xs, withUid(strategy.emptyEntry())])}>
          <Plus aria-hidden className="size-4" /> Añadir {strategy.entryLabel.toLowerCase()}
        </button>
      </section>

      {(error || problems.length > 0) && (
        <div role="alert" className="rounded-lg border border-tone-danger-line bg-tone-danger-soft p-3 text-sm text-tone-danger">
          {error && <p>{error}</p>}
          {problems.length > 0 && (
            <ul className="list-inside list-disc type-meta">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <a href={backHref} className="btn btn-ghost">
          Cancelar
        </a>
        <button type="button" className="btn btn-primary" disabled={pending || problems.length > 0} aria-busy={pending} onClick={save}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
