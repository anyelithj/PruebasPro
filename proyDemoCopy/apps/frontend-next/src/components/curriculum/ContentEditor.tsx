"use client"; // [Next.js]: Client Component → campos controlados e interacción (añadir/quitar filas)
import { Image, Plus, TriangleAlert, Volume2 } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { useId, useState } from "react"; // [React 18+]: ids únicos y estables (SSR-safe) para enlazar <label> ↔ campo
import {
  EXERCISE_TYPE_LABEL,
  type ContentByKind,
  type CurriculumItemKind,
  type ExampleValue,
  type PronunciationWord,
  type ExerciseContent,
  type ExerciseType,
  type IpaValue,
  type RubricCriterion,
  type VocabularyContent,
} from "@/types/curriculum";
import type { Language } from "@/types/quiz";
import { EmojiPicker } from "@/components/curriculum/EmojiPicker"; // [Modal]: todos los emojis Unicode con búsqueda
import { ResourceVocabularyField } from "@/components/language/ResourceVocabularyField"; // [Sprint 8.4]: traducción e IPA UK/US automáticos al agregar un término
// [ContentEditor]: edita el contenido de un recurso con CAMPOS según su tipo (antes era un JSON escrito a mano) | [Patrón]: Strategy + Registry (un editor por tipo) + Controlled Components | [Principio]: OCP + SRP + DRY | [Paradigma]: Funcional + Declarativo
// [UX]: etiquetas en lenguaje natural, ejemplos como placeholder, filas dinámicas; el backend sigue siendo quien valida la estructura final

// ───────────── Átomos de campo ─────────────

interface TextFieldProps {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  multiline?: boolean; // true → <textarea>
  rows?: number;
  mono?: boolean; // Tipografía monoespaciada (IPA, fórmulas)
  list?: string; // id de <datalist> con sugerencias
  className?: string;
}

// [TextField]: label + input/textarea + pista | [Patrón]: Composite (molecule) | `useId` enlaza label, campo y pista (a11y)
function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  multiline,
  rows = 3,
  mono,
  list,
  className,
}: TextFieldProps) {
  const id = useId();
  const common = {
    id,
    value: value ?? "", // `??` (ES2020): undefined → "" (el campo siempre es controlado)
    placeholder,
    required,
    "aria-describedby": hint ? `${id}-hint` : undefined,
    className: `control w-full ${mono ? "font-mono" : ""}`,
  };
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-semibold text-muted-foreground"
      >
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      {multiline ? (
        <textarea
          {...common}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          {...common}
          list={list}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[11px] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

// [RemoveButton]: botón accesible de quitar fila (nombre accesible explícito)
// [Altura · 2026-10-24]: `btn` (40 px) = misma altura que `.control` → alineado con los campos de la fila (antes `btn-sm`, 32 px)
function RemoveButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="btn btn-ghost shrink-0 px-2.5! text-tone-danger"
    >
      ✕
    </button>
  );
}

// [Helpers inmutables de arrays]: `with` sería ES2023; `map` con índice es compatible | [Paradigma]: Funcional (sin mutar)
const replaceAt = <T,>(arr: T[], i: number, value: T): T[] =>
  arr.map((x, j) => (j === i ? value : x));
const removeAt = <T,>(arr: T[], i: number): T[] =>
  arr.filter((_, j) => j !== i);

// [ExamplesEditor]: filas frase + traducción (+ romanización opcional) | reutilizado por vocabulario y reglas | [Principio]: DRY
function ExamplesEditor({
  value,
  onChange,
  language,
}: {
  value: ExampleValue[] | undefined;
  onChange: (v: ExampleValue[]) => void;
  language: Language | "";
}) {
  const items = value ?? [];
  const s = sample(language);
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-semibold text-muted-foreground">
        Ejemplos de uso (opcional) — frases que muestran cómo se usa
      </legend>
      {items.map((ex, i) => (
        <div
          key={i}
          className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_1fr_auto]"
        >
          <TextField
            label={`Frase ${i + 1}`}
            value={ex.text}
            onChange={(text) => onChange(replaceAt(items, i, { ...ex, text }))}
            placeholder={s.sentence}
          />
          <TextField
            label="Traducción"
            value={ex.translationEs}
            onChange={(translationEs) =>
              onChange(replaceAt(items, i, { ...ex, translationEs }))
            }
            placeholder={s.sentenceEs}
          />
          <div className="flex items-end">
            <RemoveButton
              onClick={() => onChange(removeAt(items, i))}
              label={`Quitar ejemplo ${i + 1}`}
            />
          </div>
        </div>
      ))}
      {items.length < 10 && (
        <button
          type="button"
          onClick={() => onChange([...items, { text: "", translationEs: "" }])}
          className="btn btn-outline"
        >
          + Añadir ejemplo
        </button>
      )}
    </fieldset>
  );
}

// [WordsEditor · 2026-10-24]: palabras de ejemplo de un fonema (palabra + IPA opcional + traducción) | mismo patrón que ExamplesEditor | [Principio]: DRY (TextField, RemoveButton, replaceAt/removeAt)
const MAX_WORDS = 20; // = words.max(20) del esquema del backend
function WordsEditor({ value, onChange, language }: { value: PronunciationWord[] | undefined; onChange: (v: PronunciationWord[]) => void; language: Language | "" }) {
  const items = value ?? []; // `??` (ES2020): contenido antiguo sin palabras
  const s = sample(language);
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-semibold text-muted-foreground">Palabras con este sonido (opcional) — se escuchan una a una en la ficha</legend>
      {items.map((w, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <TextField label={`Palabra ${i + 1}`} value={w.text} onChange={(text) => onChange(replaceAt(items, i, { ...w, text }))} placeholder={s.word} />
          <TextField label="IPA (opcional)" hint="Si la dejas vacía se calcula sola." value={w.ipa} onChange={(ipa) => onChange(replaceAt(items, i, { ...w, ipa }))} placeholder="/hɒt/" mono />
          <TextField label="Traducción" value={w.translationEs} onChange={(translationEs) => onChange(replaceAt(items, i, { ...w, translationEs }))} />
          <div className="flex items-end">
            <RemoveButton onClick={() => onChange(removeAt(items, i))} label={`Quitar palabra ${i + 1}`} />
          </div>
        </div>
      ))}
      {items.length < MAX_WORDS && (
        <button type="button" onClick={() => onChange([...items, { text: "", ipa: "", translationEs: "" }])} className="btn btn-outline">
          + Añadir palabra
        </button>
      )}
    </fieldset>
  );
}

// [Variantes regionales comunes]: sugerencias (BCP-47) → el autor no tiene que saber el código de memoria
const IPA_VARIANTS = [
  "en-GB",
  "en-US",
  "fr-FR",
  "fr-CA",
  "de-DE",
  "de-AT",
  "es-ES",
  "es-CO",
  "es-MX",
  "pt-BR",
  "pt-PT",
  "zh-CN",
  "ru-RU",
] as const;

// [Ejemplos de relleno POR IDIOMA]: el placeholder muestra una palabra del idioma elegido (antes siempre en inglés → se colaba "water" en recursos de francés)
// `Record<Language, …>` (TS): exhaustivo → cada idioma nuevo exige su ejemplo | [Patrón]: Lookup Table
interface Sample {
  word: string;
  translation: string;
  sentence: string;
  sentenceEs: string;
  ipa: string;
  variant: string;
  romanization?: string;
}
const SAMPLES: Readonly<Record<Language, Sample>> = {
  en: {
    word: "water",
    translation: "agua",
    sentence: "A glass of water, please.",
    sentenceEs: "Un vaso de agua, por favor.",
    ipa: "/ˈwɔːtə/",
    variant: "en-GB",
  },
  fr: {
    word: "l'eau",
    translation: "el agua",
    sentence: "Un verre d'eau, s'il vous plaît.",
    sentenceEs: "Un vaso de agua, por favor.",
    ipa: "/o/",
    variant: "fr-FR",
  },
  de: {
    word: "das Wasser",
    translation: "el agua",
    sentence: "Ein Glas Wasser, bitte.",
    sentenceEs: "Un vaso de agua, por favor.",
    ipa: "/ˈvasɐ/",
    variant: "de-DE",
  },
  es: {
    word: "el agua",
    translation: "agua",
    sentence: "Un vaso de agua, por favor.",
    sentenceEs: "Un vaso de agua, por favor.",
    ipa: "/ˈaɣwa/",
    variant: "es-ES",
  },
  pt: {
    word: "a água",
    translation: "el agua",
    sentence: "Um copo de água, por favor.",
    sentenceEs: "Un vaso de agua, por favor.",
    ipa: "/ˈaɡwɐ/",
    variant: "pt-BR",
  },
  zh: {
    word: "水",
    translation: "agua",
    sentence: "请给我一杯水。",
    sentenceEs: "Un vaso de agua, por favor.",
    ipa: "/ʂweɪ˨˩˦/",
    variant: "zh-CN",
    romanization: "shuǐ",
  },
  ru: {
    word: "вода",
    translation: "agua",
    sentence: "Стакан воды, пожалуйста.",
    sentenceEs: "Un vaso de agua, por favor.",
    ipa: "/vɐˈda/",
    variant: "ru-RU",
    romanization: "voda",
  },
};
// [sample]: idioma aún no elegido → inglés como referencia
const sample = (language: Language | ""): Sample => SAMPLES[language || "en"];

// [IpaFields]: transcripción + variante + fuente | `required`: en "Pronunciación" es obligatoria
// [Acentos de referencia]: código BCP-47 → nombre legible (el autor elige "Francés de Francia", no "fr-FR") | [Patrón]: Lookup Table
const ACCENT_LABEL: Readonly<Record<(typeof IPA_VARIANTS)[number], string>> = {
  "en-GB": "Inglés británico",
  "en-US": "Inglés estadounidense",
  "fr-FR": "Francés de Francia",
  "fr-CA": "Francés de Canadá",
  "de-DE": "Alemán de Alemania",
  "de-AT": "Alemán de Austria",
  "es-ES": "Español de España",
  "es-CO": "Español de Colombia",
  "es-MX": "Español de México",
  "pt-BR": "Portugués de Brasil",
  "pt-PT": "Portugués de Portugal",
  "zh-CN": "Mandarín (China continental)",
  "ru-RU": "Ruso de Rusia",
};

// [IpaFields]: "¿Cómo se pronuncia?" en lenguaje llano | `required`: obligatoria en el tipo Pronunciación, opcional en Vocabulario
function IpaFields({
  value,
  onChange,
  required,
  language,
}: {
  value: IpaValue | undefined;
  onChange: (v: IpaValue) => void;
  required?: boolean;
  language: Language | "";
}) {
  const accentId = useId();
  const s = sample(language);
  // [Acentos del idioma elegido]: solo los que empiezan por su código (fr → fr-FR, fr-CA)
  const variants = IPA_VARIANTS.filter(
    (v) => !language || v.startsWith(language),
  );
  const ipa = value ?? { value: "", variant: "" };
  const needsAccent = required || Boolean(ipa.value.trim()); // Con transcripción, el acento pasa a ser obligatorio (regla del backend)
  return (
    <fieldset className="space-y-2 rounded-lg border border-border p-3">
      <legend className="px-1 text-xs font-semibold text-muted-foreground">
        <Volume2 aria-hidden className="inline size-4 align-[-0.125em]" /> ¿Cómo se pronuncia?{required ? " *" : " (opcional)"}
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        <TextField
          label="Pronunciación escrita"
          value={ipa.value}
          onChange={(v) =>
            onChange({
              ...ipa,
              value: v,
              variant: ipa.variant || (variants[0] ?? ""),
            })
          } // Al escribir, se preselecciona el acento del idioma
          placeholder={s.ipa}
          mono
          required={required}
          hint="Símbolos fonéticos (IPA) entre barras. Cópialos de un diccionario."
        />
        <div>
          <label
            htmlFor={accentId}
            className="mb-1 block text-xs font-semibold text-muted-foreground"
          >
            Acento{needsAccent ? " *" : ""}
          </label>
          {/* [Select en vez de código libre]: imposible escribir un acento de otro idioma */}
          <select
            id={accentId}
            value={ipa.variant}
            onChange={(e) => onChange({ ...ipa, variant: e.target.value })}
            className="control w-full"
            aria-describedby={`${accentId}-hint`}
          >
            <option value="">Elige acento…</option>
            {variants.map((v) => (
              <option key={v} value={v}>
                {ACCENT_LABEL[v]}
              </option>
            ))}
          </select>
          <p
            id={`${accentId}-hint`}
            className="mt-1 text-[11px] text-muted-foreground"
          >
            La misma palabra suena distinto según el país.
          </p>
        </div>
        <TextField
          label="Diccionario consultado"
          value={ipa.source}
          onChange={(source) => onChange({ ...ipa, source })}
          placeholder="Cambridge, Larousse, Duden…"
          hint="Para poder verificarla."
        />
      </div>
    </fieldset>
  );
}

// [Campos que dependen del idioma]: evitan mostrar lo que no aplica | `ReadonlySet` (ES2015): búsqueda O(1)
const HAS_GENDER: ReadonlySet<string> = new Set(["de", "fr", "es", "pt", "ru"]); // Idiomas con género gramatical
const HAS_ROMANIZATION: ReadonlySet<string> = new Set(["zh", "ru"]); // Escrituras no latinas

// [GENDER_HINT]: ejemplo de artículos/género por idioma
const GENDER_HINT: Readonly<Record<string, string>> = {
  de: "der (masculino) · die (femenino) · das (neutro)",
  fr: "le (masculino) · la (femenino)",
  es: "el (masculino) · la (femenino)",
  pt: "o (masculino) · a (femenino)",
  ru: "masculino · femenino · neutro",
};

// [MoreDetails]: pliega los campos opcionales → el autor ve primero solo lo obligatorio | `<details>` (HTML): accesible por teclado y sin JS extra
// `open`: se abre solo si ya hay datos opcionales (p. ej. tras generar con IA) | [Principio]: KISS (progressive disclosure)
function MoreDetails({
  open,
  children,
}: {
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={open}
      className="rounded-lg border border-border p-3 sm:col-span-2"
    >
      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
        <Plus aria-hidden className="inline size-4 align-[-0.125em]" /> Más detalles (opcional)
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </details>
  );
}

// [filled]: ¿algún opcional tiene valor? | [Paradigma]: Funcional (pura)
const filled = (...values: unknown[]) =>
  values.some((v) =>
    Array.isArray(v)
      ? v.length > 0
      : typeof v === "string"
        ? v.trim() !== ""
        : Boolean(v),
  );

// ───────────── Editores por tipo (Strategy) ─────────────

// `type EditorProps<K>` (TS Generics): cada editor recibe y devuelve SU forma de contenido
type EditorProps<K extends CurriculumItemKind> = {
  value: ContentByKind[K];
  onChange: (v: ContentByKind[K]) => void;
  language: Language | "";
};

const PARTS_OF_SPEECH = [
  "sustantivo",
  "verbo",
  "adjetivo",
  "adverbio",
  "pronombre",
  "preposición",
  "conjunción",
  "expresión",
] as const;

// ───── Apoyo visual del vocabulario ─────
const THUMB_PX = 256; // Lado máximo de la imagen guardada (suficiente para una ficha; datos mínimos)
const MAX_IMAGE_CHARS = 150_000; // Mismo límite que el esquema del backend (~110 KB)

// [toThumbnail]: reduce la imagen en el navegador y la convierte a WebP (data URL) | Canvas API + createImageBitmap (Web APIs) | [Software verde]: sin subir el original al servidor
async function toThumbnail(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file); // Decodifica sin insertar <img> en el DOM
  const scale = Math.min(1, THUMB_PX / Math.max(bitmap.width, bitmap.height)); // Nunca agranda
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); // `!` (TS): el contexto 2D siempre existe en un canvas nuevo
  bitmap.close(); // Libera memoria del bitmap
  return canvas.toDataURL("image/webp", 0.8); // Safari antiguo devuelve PNG (también aceptado por el backend)
}

// [VisualAid]: emoji o imagen de la ficha | [Patrón]: Controlled Component | [Principio]: SRP
function VisualAid({
  value: c,
  onChange,
}: {
  value: VocabularyContent;
  onChange: (v: VocabularyContent) => void;
}) {
  const fileId = useId();
  const [error, setError] = useState<string | null>(null);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type))
      return setError("Usa una imagen PNG, JPG, WebP o GIF.");
    try {
      const image = await toThumbnail(file);
      if (image.length > MAX_IMAGE_CHARS)
        return setError(
          "La imagen es demasiado compleja; prueba con otra más simple.",
        );
      onChange({ ...c, image });
    } catch {
      setError("No se pudo leer la imagen.");
    }
  };
  return (
    <fieldset className="grid gap-2 rounded-lg border border-dashed border-border p-3 sm:col-span-2">
      <legend className="px-1 text-xs font-semibold text-muted-foreground">
        Imagen o emoji (opcional)
      </legend>
      <div className="flex flex-wrap items-start gap-3">
        {/* [Vista previa]: la imagen tiene prioridad sobre el emoji en la ficha */}
        <span
          aria-hidden
          className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-4xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL local (vista previa) */}
          {c.image ? (
            <img src={c.image} alt="" className="size-full object-cover" />
          ) : (
            (c.emoji ?? "🖼️")
          )}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-32 flex-1">
              <TextField
                label="Emoji"
                value={c.emoji}
                onChange={(emoji) =>
                  onChange({ ...c, emoji: emoji.slice(0, 16) })
                }
                placeholder="🍎"
                hint="Pégalo o elígelo de la lista completa."
              />
            </div>
            <EmojiPicker
              value={c.emoji}
              onSelect={(emoji) => onChange({ ...c, emoji })}
            />
            {c.emoji && (
              <button
                type="button"
                onClick={() => onChange({ ...c, emoji: undefined })}
                className="btn btn-ghost text-tone-danger"
              >
                ✕ Quitar emoji
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* [Input de archivo accesible]: <label> estilizado + input sr-only con foco visible */}
            <label
              htmlFor={fileId}
              className="btn btn-outline cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <Image aria-hidden className="inline size-4 align-[-0.125em]" /> {c.image ? "Cambiar imagen" : "Adjuntar imagen"}
            </label>
            <input
              id={fileId}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = ""; // Permite volver a elegir el mismo archivo
              }}
            />
            {c.image && (
              <button
                type="button"
                onClick={() => onChange({ ...c, image: undefined })}
                className="btn btn-ghost text-tone-danger"
              >
                ✕ Quitar imagen
              </button>
            )}
            <span className="text-[11px] text-muted-foreground">
              Se reduce a {THUMB_PX} px en tu navegador.
            </span>
          </div>
          {error && (
            <p role="alert" className="text-xs text-tone-danger">
              {error}
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
}

function VocabularyEditor({
  value: c,
  onChange,
  language,
}: EditorProps<"vocabulary">) {
  const posId = useId();
  const s = sample(language);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        label="Palabra o expresión"
        value={c.lemma}
        onChange={(lemma) => onChange({ ...c, lemma })}
        placeholder={s.word}
        required
        hint="Tal como aparece en el diccionario (con su artículo si lo lleva)."
      />
      <TextField
        label="Qué significa en español"
        value={c.translationEs}
        onChange={(translationEs) => onChange({ ...c, translationEs })}
        placeholder={s.translation}
        required
      />
      {/* [Aviso de calidad]: la traducción repite la palabra (p. ej. hoodie → hoodie) → suele ser un error de la IA; no bloquea (hay préstamos válidos como "hotel") */}
      {c.lemma?.trim() &&
        c.translationEs?.trim() &&
        c.lemma.trim().toLowerCase() ===
          c.translationEs.trim().toLowerCase() && (
          <p
            role="status"
            className="rounded-lg border border-tone-warning-line bg-tone-warning-soft px-3 py-2 text-xs text-tone-warning sm:col-span-2"
          >
            <TriangleAlert aria-hidden className="inline size-4 align-[-0.125em]" /> La traducción es igual a la palabra. Si no es un préstamo que se
            usa igual en español, escribe la traducción correcta.
          </p>
        )}
      {/* [Sprint 8.4]: sugiere traducción e IPA (espeak-ng) para el término; el docente decide qué usar y puede editarlo (extiende el editor, no migra datos) */}
      <ResourceVocabularyField
        term={c.lemma ?? ""}
        language={language}
        onTranslation={(translationEs) => onChange({ ...c, translationEs })}
        onIpa={(ipa) => onChange({ ...c, ipa })}
      />
      <VisualAid value={c} onChange={onChange} />
      <MoreDetails
        open={filled(
          c.partOfSpeech,
          c.gender,
          c.ipa?.value,
          c.romanization,
          c.examples,
        )}
      >
        <div>
          <label
            htmlFor={posId}
            className="mb-1 block text-xs font-semibold text-muted-foreground"
          >
            Tipo de palabra
          </label>
          {/* [Select]: lista cerrada en vez de texto libre (antes "Categoría gramatical") */}
          <select
            id={posId}
            value={c.partOfSpeech ?? ""}
            onChange={(e) => onChange({ ...c, partOfSpeech: e.target.value })}
            className="control w-full"
          >
            <option value="">Sin especificar</option>
            {PARTS_OF_SPEECH.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </div>
        {/* [Condicional por idioma]: el género solo aparece donde existe (no en inglés ni chino) */}
        {HAS_GENDER.has(language) && (
          <TextField
            label="Género"
            value={c.gender}
            onChange={(gender) => onChange({ ...c, gender })}
            placeholder="femenino"
            hint={GENDER_HINT[language]}
          />
        )}
        <div className="sm:col-span-2">
          <IpaFields
            value={c.ipa}
            onChange={(ipa) => onChange({ ...c, ipa })}
            language={language}
          />
        </div>
        {HAS_ROMANIZATION.has(language) && (
          <TextField
            className="sm:col-span-2"
            label="Escritura en letras latinas"
            value={c.romanization}
            onChange={(romanization) => onChange({ ...c, romanization })}
            placeholder={s.romanization}
            hint={
              language === "zh"
                ? "Pinyin con tonos (p. ej. shuǐ)."
                : "Transliteración (p. ej. voda)."
            }
          />
        )}
        <div className="sm:col-span-2">
          <ExamplesEditor
            value={c.examples}
            onChange={(examples) => onChange({ ...c, examples })}
            language={language}
          />
        </div>
      </MoreDetails>
    </div>
  );
}

function GrammarRuleEditor({
  value: c,
  onChange,
  language,
}: EditorProps<"grammar_rule">) {
  return (
    <div className="grid gap-3">
      <TextField
        label="Nombre de la regla"
        hint="Cómo la verá el estudiante en el temario."
        value={c.title}
        onChange={(title) => onChange({ ...c, title })}
        placeholder="Present perfect"
        required
      />
      <TextField
        label="Explicación (en español)"
        value={c.explanationEs}
        onChange={(explanationEs) => onChange({ ...c, explanationEs })}
        placeholder="Se usa para acciones pasadas con relevancia en el presente."
        multiline
        rows={4}
        required
      />
      <MoreDetails open={filled(c.structure, c.examples)}>
        <TextField
          className="sm:col-span-2"
          label="Fórmula"
          hint="Esquema corto para memorizarla."
          value={c.structure}
          onChange={(structure) => onChange({ ...c, structure })}
          placeholder="have/has + participio"
          mono
        />
        <div className="sm:col-span-2">
          <ExamplesEditor
            value={c.examples}
            onChange={(examples) => onChange({ ...c, examples })}
            language={language}
          />
        </div>
      </MoreDetails>
    </div>
  );
}

function ExampleEditor({
  value: c,
  onChange,
  language,
}: EditorProps<"example">) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        label="Frase en el idioma"
        hint="Una frase natural, de uso real."
        value={c.text}
        onChange={(text) => onChange({ ...c, text })}
        placeholder={sample(language).sentence}
        required
      />
      <TextField
        label="Traducción al español"
        value={c.translationEs}
        onChange={(translationEs) => onChange({ ...c, translationEs })}
        placeholder={sample(language).sentenceEs}
        required
      />
      {HAS_ROMANIZATION.has(language) && (
        <TextField
          className="sm:col-span-2"
          label="Escritura en letras latinas"
          value={c.romanization}
          onChange={(romanization) => onChange({ ...c, romanization })}
          placeholder={sample(language).romanization}
        />
      )}
    </div>
  );
}

function TranslationEditor({ value: c, onChange }: EditorProps<"translation">) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        label="Texto original"
        value={c.source}
        onChange={(source) => onChange({ ...c, source })}
        placeholder="Je voudrais un café."
        multiline
        required
      />
      <TextField
        label="Traducción al español"
        value={c.targetEs}
        onChange={(targetEs) => onChange({ ...c, targetEs })}
        placeholder="Quisiera un café."
        multiline
        required
      />
      <MoreDetails open={filled(c.notes)}>
        <TextField
          className="sm:col-span-2"
          label="Notas"
          hint="Matices, registro o traducciones igual de válidas."
          value={c.notes}
          onChange={(notes) => onChange({ ...c, notes })}
          multiline
          rows={2}
        />
      </MoreDetails>
    </div>
  );
}

function PronunciationEditor({
  value: c,
  onChange,
  language,
}: EditorProps<"pronunciation">) {
  return (
    <div className="grid gap-3">
      <TextField
        label="Palabra o frase"
        value={c.text}
        onChange={(text) => onChange({ ...c, text })}
        placeholder={sample(language).word}
        required
      />
      <IpaFields
        value={c.ipa}
        onChange={(ipa) => onChange({ ...c, ipa })}
        required
        language={language}
      />
      {HAS_ROMANIZATION.has(language) && (
        <TextField
          label="Escritura en letras latinas"
          value={c.romanization}
          onChange={(romanization) => onChange({ ...c, romanization })}
          placeholder={sample(language).romanization}
        />
      )}
      {/* [Ficha de fonema · 2026-10-24]: para un sonido como /ɒ/ → símbolo, CUÁNDO se usa (grafías y posiciones), CÓMO se pronuncia, palabras y frases donde se oye */}
      <TextField
        label="Fonema (símbolo IPA)"
        hint="Opcional: el sonido que se practica, sin barras (p. ej. ɒ). La ficha lo muestra con un botón para escucharlo en la palabra clave."
        value={c.phoneme}
        onChange={(phoneme) => onChange({ ...c, phoneme: phoneme.replace(/\//g, "") })} // `replace(/\//g)`: sin barras → la ficha las añade
        placeholder="ɒ"
        mono
      />
      <TextField
        label="Cuándo se usa (en español)"
        hint="Qué letras o combinaciones producen el sonido y en qué posiciones."
        value={c.ruleEs}
        onChange={(ruleEs) => onChange({ ...c, ruleEs })}
        placeholder="«o» en sílaba cerrada en inglés británico (hot, dog) y «a» tras w (want, watch)."
        multiline
      />
      <TextField
        label="Cómo se pronuncia (en español)"
        hint="Posición de labios, lengua y mandíbula, comparada con el español."
        value={c.articulationEs}
        onChange={(articulationEs) => onChange({ ...c, articulationEs })}
        placeholder="Una «o» corta con la boca bien abierta y los labios ligeramente redondeados."
        multiline
        rows={2}
      />
      <WordsEditor value={c.words} onChange={(words) => onChange({ ...c, words })} language={language} />
      <ExamplesEditor
        value={c.examples ?? []}
        onChange={(examples) => onChange({ ...c, examples })}
        language={language}
      />
    </div>
  );
}

function CommonErrorEditor({
  value: c,
  onChange,
}: EditorProps<"common_error">) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        label="✗ Cómo lo dicen mal"
        value={c.incorrect}
        onChange={(incorrect) => onChange({ ...c, incorrect })}
        placeholder="She don't like it."
        required
      />
      <TextField
        label="✓ Forma correcta"
        value={c.correct}
        onChange={(correct) => onChange({ ...c, correct })}
        placeholder="She doesn't like it."
        required
      />
      <TextField
        className="sm:col-span-2"
        label="¿Por qué es un error? (en español)"
        value={c.explanationEs}
        onChange={(explanationEs) => onChange({ ...c, explanationEs })}
        placeholder="En tercera persona del singular se usa does/doesn't."
        multiline
        required
      />
      <MoreDetails open={filled(c.ruleKey)}>
        <TextField
          className="sm:col-span-2"
          label="Regla relacionada (opcional)"
          value={c.ruleKey}
          onChange={(ruleKey) => onChange({ ...c, ruleKey })}
          placeholder="present-simple"
          mono
          hint="Clave de un recurso de tipo Regla gramatical, para enlazarlos."
        />
      </MoreDetails>
    </div>
  );
}

// [Estado inicial al cambiar el tipo de ejercicio]: cada tipo tiene su forma de opciones/respuestas | [Patrón]: Strategy
function resetForType(c: ExerciseContent, type: ExerciseType): ExerciseContent {
  if (type === "multiple_choice")
    return {
      ...c,
      type,
      options: c.options?.length ? c.options : ["", ""],
      answerKey: [],
    };
  if (type === "true_false")
    return { ...c, type, options: undefined, answerKey: ["true"] };
  return { ...c, type, options: undefined, answerKey: [""] };
}

function ExerciseEditor({ value: c, onChange }: EditorProps<"exercise">) {
  const typeId = useId();
  const options = c.options ?? [];
  return (
    <div className="grid gap-3">
      <TextField
        label="Enunciado"
        value={c.prompt}
        onChange={(prompt) => onChange({ ...c, prompt })}
        placeholder="She ___ to school every day."
        multiline
        required
        hint={
          c.type === "fill_blank"
            ? "Marca el espacio a completar con ___."
            : undefined
        }
      />

      <div>
        <label
          htmlFor={typeId}
          className="mb-1 block text-xs font-semibold text-muted-foreground"
        >
          Tipo de pregunta *
        </label>
        <select
          id={typeId}
          value={c.type}
          onChange={(e) =>
            onChange(resetForType(c, e.target.value as ExerciseType))
          }
          className="control w-full sm:w-72"
        >
          {(Object.keys(EXERCISE_TYPE_LABEL) as ExerciseType[]).map((t) => (
            <option key={t} value={t}>
              {EXERCISE_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      {/* [Opción múltiple]: cada opción con su casilla "correcta" → answerKey se deriva de las marcadas (siempre coherente con options) */}
      {c.type === "multiple_choice" && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">
            Opciones (marca las correctas) *
          </legend>
          {options.map((opt, i) => {
            const correct = opt !== "" && c.answerKey.includes(opt);
            return (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`La opción ${i + 1} es correcta`}
                  checked={correct}
                  disabled={!opt.trim()}
                  onChange={(e) =>
                    onChange({
                      ...c,
                      answerKey: e.target.checked
                        ? [...c.answerKey, opt]
                        : c.answerKey.filter((a) => a !== opt),
                    })
                  }
                  className="size-4 shrink-0 accent-primary"
                />
                <input
                  aria-label={`Opción ${i + 1}`}
                  value={opt}
                  placeholder={
                    ["go", "goes", "going", "gone"][i] ?? `Opción ${i + 1}`
                  }
                  onChange={(e) => {
                    const next = e.target.value;
                    // [Renombrar opción]: si estaba marcada como correcta, la respuesta se actualiza con el nuevo texto
                    onChange({
                      ...c,
                      options: replaceAt(options, i, next),
                      answerKey: c.answerKey.map((a) => (a === opt ? next : a)),
                    });
                  }}
                  className="control w-full"
                />
                {options.length > 2 && (
                  <RemoveButton
                    onClick={() =>
                      onChange({
                        ...c,
                        options: removeAt(options, i),
                        answerKey: c.answerKey.filter((a) => a !== opt),
                      })
                    }
                    label={`Quitar opción ${i + 1}`}
                  />
                )}
              </div>
            );
          })}
          {options.length < 8 && (
            <button
              type="button"
              onClick={() => onChange({ ...c, options: [...options, ""] })}
              className="btn btn-outline"
            >
              + Añadir opción
            </button>
          )}
        </fieldset>
      )}

      {/* [Verdadero/falso]: radios nativos (accesibles por teclado); se guarda "true"/"false" como el resto de la plataforma */}
      {c.type === "true_false" && (
        <fieldset className="flex gap-4">
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">
            Respuesta correcta *
          </legend>
          {(["true", "false"] as const).map((v) => (
            <label key={v} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${typeId}-tf`}
                checked={c.answerKey[0] === v}
                onChange={() => onChange({ ...c, answerKey: [v] })}
                className="size-4 accent-primary"
              />
              {v === "true" ? "Verdadero" : "Falso"}
            </label>
          ))}
        </fieldset>
      )}

      {/* [Completar / abierta]: lista de respuestas aceptadas (corrección automática sin IA) */}
      {(c.type === "fill_blank" || c.type === "open_answer") && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">
            {c.type === "fill_blank"
              ? "Respuestas aceptadas *"
              : "Respuestas modelo *"}
          </legend>
          {c.answerKey.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                aria-label={`Respuesta ${i + 1}`}
                value={a}
                placeholder={i === 0 ? "goes" : "Otra forma válida"}
                onChange={(e) =>
                  onChange({
                    ...c,
                    answerKey: replaceAt(c.answerKey, i, e.target.value),
                  })
                }
                className="control w-full"
              />
              {c.answerKey.length > 1 && (
                <RemoveButton
                  onClick={() =>
                    onChange({ ...c, answerKey: removeAt(c.answerKey, i) })
                  }
                  label={`Quitar respuesta ${i + 1}`}
                />
              )}
            </div>
          ))}
          {c.answerKey.length < 10 && (
            <button
              type="button"
              onClick={() =>
                onChange({ ...c, answerKey: [...c.answerKey, ""] })
              }
              className="btn btn-outline"
            >
              + Añadir respuesta válida
            </button>
          )}
        </fieldset>
      )}

      <MoreDetails open={filled(c.explanationEs, c.rubricKey)}>
        <TextField
          className="sm:col-span-2"
          label="Explicación de la respuesta"
          value={c.explanationEs}
          onChange={(explanationEs) => onChange({ ...c, explanationEs })}
          placeholder="Tercera persona del singular: verbo + -s."
          multiline
          rows={2}
        />
        {c.type === "open_answer" && (
          <TextField
            className="sm:col-span-2"
            label="Rúbrica para corregir (clave)"
            value={c.rubricKey}
            onChange={(rubricKey) => onChange({ ...c, rubricKey })}
            mono
            placeholder="expresion-escrita-b1"
          />
        )}
      </MoreDetails>
    </div>
  );
}

function RubricEditor({ value: c, onChange }: EditorProps<"rubric">) {
  const setCriterion = (i: number, patch: Partial<RubricCriterion>) =>
    onChange({
      ...c,
      criteria: replaceAt(c.criteria, i, { ...c.criteria[i]!, ...patch }),
    });
  const uid = useId(); // [a11y]: prefijo único → ids sin colisión cuando hay varias rúbricas en el mismo formulario
  return (
    <div className="grid gap-3">
      <TextField
        label="Nombre de la rúbrica"
        value={c.title}
        onChange={(title) => onChange({ ...c, title })}
        placeholder="Expresión escrita B1"
        required
      />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold text-muted-foreground">
          Criterios *
        </legend>
        {c.criteria.map((cr, i) => (
          <div
            key={i}
            className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_2fr_7rem_auto]"
          >
            <TextField
              label={`Criterio ${i + 1}`}
              value={cr.name}
              onChange={(name) => setCriterion(i, { name })}
              placeholder="Coherencia"
            />
            <TextField
              label="Qué se evalúa"
              value={cr.descriptorEs}
              onChange={(descriptorEs) => setCriterion(i, { descriptorEs })}
              placeholder="Organiza las ideas con conectores adecuados."
            />
            <div>
              <label
                className="mb-1 block text-xs font-semibold text-muted-foreground"
                htmlFor={`${uid}-crit-${i}-pts`}
              >
                Puntos máx.
              </label>
              {/* `Number(…) || 1` (JS): entrada vacía o inválida → 1 (el backend exige entero 1–100) */}
              <input
                id={`${uid}-crit-${i}-pts`}
                type="number"
                min={1}
                max={100}
                inputMode="numeric"
                value={cr.maxPoints}
                onChange={(e) => {
                  const maxPoints = Math.min(
                    100,
                    Math.max(1, Math.trunc(Number(e.target.value) || 1)),
                  );
                  setCriterion(i, {
                    maxPoints,
                    bands: cr.bands.map((b) => ({
                      ...b,
                      points: Math.min(b.points, maxPoints),
                    })),
                  }); // Bajar el peso recorta los niveles que lo superen
                }}
                className="control w-full"
              />
            </div>
            <div className="flex items-end">
              {c.criteria.length > 1 && (
                <RemoveButton
                  onClick={() =>
                    onChange({ ...c, criteria: removeAt(c.criteria, i) })
                  }
                  label={`Quitar criterio ${i + 1}`}
                />
              )}
            </div>
            {/* [Sprint 5.5 · niveles]: bandas de desempeño del criterio (las propone la IA y el docente las revisa) */}
            <BandsEditor
              criterion={cr}
              index={i}
              uid={uid}
              onChange={(bands) => setCriterion(i, { bands })}
            />
          </div>
        ))}
        {c.criteria.length < 20 && (
          <button
            type="button"
            onClick={() =>
              onChange({
                ...c,
                criteria: [
                  ...c.criteria,
                  { name: "", descriptorEs: "", maxPoints: 5, bands: [] },
                ],
              })
            }
            className="btn btn-outline"
          >
            + Añadir criterio
          </button>
        )}
      </fieldset>
    </div>
  );
}

// [BandsEditor · Sprint 5.5]: niveles de un criterio (puntos + descriptor) | `max={maxPoints}`: una banda no supera el peso del criterio (misma regla que el esquema Zod del backend) | [Patrón]: Composite (subeditor) | [Principio]: SRP
function BandsEditor({
  criterion: cr,
  index: i,
  uid,
  onChange,
}: {
  criterion: RubricCriterion;
  index: number;
  uid: string;
  onChange: (bands: RubricCriterion["bands"]) => void;
}) {
  return (
    <fieldset className="space-y-2 sm:col-span-4">
      <legend className="text-xs font-semibold text-muted-foreground">
        Niveles del criterio {i + 1}
      </legend>
      {cr.bands.map((b, j) => (
        <div
          key={j}
          className="grid grid-cols-[5.5rem_1fr_auto] items-end gap-2"
        >
          <div>
            <label
              className="mb-1 block text-xs text-muted-foreground"
              htmlFor={`${uid}-crit-${i}-band-${j}`}
            >
              Puntos
            </label>
            <input
              id={`${uid}-crit-${i}-band-${j}`}
              type="number"
              min={0}
              max={cr.maxPoints}
              inputMode="numeric"
              value={b.points}
              onChange={(e) =>
                onChange(
                  replaceAt(cr.bands, j, {
                    ...b,
                    points: Math.min(
                      cr.maxPoints,
                      Math.max(0, Math.trunc(Number(e.target.value) || 0)),
                    ),
                  }),
                )
              }
              className="control w-full"
            />
          </div>
          <TextField
            label={`Descriptor del nivel ${j + 1}`}
            value={b.descriptorEs}
            onChange={(descriptorEs) =>
              onChange(replaceAt(cr.bands, j, { ...b, descriptorEs }))
            }
            placeholder="Usa conectores variados sin errores."
          />
          <RemoveButton
            onClick={() => onChange(removeAt(cr.bands, j))}
            label={`Quitar nivel ${j + 1} del criterio ${i + 1}`}
          />
        </div>
      ))}
      {cr.bands.length < 10 && (
        <button
          type="button"
          onClick={() =>
            onChange([...cr.bands, { points: cr.maxPoints, descriptorEs: "" }])
          }
          className="btn btn-ghost"
        >
          + Añadir nivel
        </button>
      )}
    </fieldset>
  );
}

// [Registro tipo → editor]: `{ [K in Kind]: … }` (TS mapped type) obliga a tener editor para CADA tipo | [Patrón]: Registry + Strategy
const EDITORS: {
  [K in CurriculumItemKind]: (props: EditorProps<K>) => React.ReactElement;
} = {
  vocabulary: VocabularyEditor,
  grammar_rule: GrammarRuleEditor,
  example: ExampleEditor,
  translation: TranslationEditor,
  pronunciation: PronunciationEditor,
  common_error: CommonErrorEditor,
  exercise: ExerciseEditor,
  rubric: RubricEditor,
};

// `export function`: fachada del editor | `as never` (TS): el registro garantiza que `value` corresponde a `kind`
export function ContentEditor<K extends CurriculumItemKind>({
  kind,
  value,
  onChange,
  language,
}: { kind: K } & EditorProps<K>) {
  const Editor = EDITORS[kind] as (props: EditorProps<K>) => React.ReactElement;
  return <Editor value={value} onChange={onChange} language={language} />;
}

// [missingFields]: comprobación local de obligatorios → mensajes claros ANTES de ir al servidor (el backend vuelve a validar) | [Paradigma]: Funcional (pura)
export function missingFields(
  kind: CurriculumItemKind,
  content: Record<string, unknown>,
  language: Language | "",
): string[] {
  // [Coherencia de idioma]: misma regla que el backend (la variante IPA debe ser del idioma del recurso)
  const variant = (content.ipa as IpaValue | undefined)?.variant?.trim();
  const mismatch =
    language && variant && !variant.toLowerCase().startsWith(language)
      ? [`La variante IPA "${variant}" no es del idioma elegido`]
      : [];
  return [...mismatch, ...requiredFields(kind, content)];
}

// [requiredFields]: obligatorios por tipo | [Paradigma]: Funcional (pura)
function requiredFields(
  kind: CurriculumItemKind,
  content: Record<string, unknown>,
): string[] {
  const c = content as Record<string, unknown> & Partial<ExerciseContent>;
  const blank = (v: unknown) => typeof v !== "string" || v.trim() === "";
  const need = (label: string, v: unknown) => (blank(v) ? [label] : []);
  switch (kind) {
    case "vocabulary": {
      const ipa = c.ipa as IpaValue | undefined;
      return [
        ...need("Palabra", c.lemma),
        ...need("Traducción", c.translationEs),
        ...(ipa?.value?.trim() && blank(ipa.variant)
          ? ["Variante regional de la IPA"]
          : []),
      ];
    }
    case "grammar_rule":
      return [
        ...need("Nombre de la regla", c.title),
        ...need("Explicación", c.explanationEs),
      ];
    case "example":
      return [...need("Frase", c.text), ...need("Traducción", c.translationEs)];
    case "translation":
      return [
        ...need("Texto original", c.source),
        ...need("Traducción", c.targetEs),
      ];
    case "pronunciation": {
      const ipa = c.ipa as IpaValue | undefined;
      return [
        ...need("Palabra o frase", c.text),
        ...need("Transcripción IPA", ipa?.value),
        ...need("Variante regional de la IPA", ipa?.variant),
      ];
    }
    case "common_error":
      return [
        ...need("Forma incorrecta", c.incorrect),
        ...need("Forma correcta", c.correct),
        ...need("Explicación", c.explanationEs),
      ];
    case "exercise": {
      const out = need("Enunciado", c.prompt);
      const filledOptions = (c.options ?? []).filter((o) => o.trim());
      if (c.type === "multiple_choice" && filledOptions.length < 2)
        out.push("Al menos 2 opciones");
      if (!(c.answerKey ?? []).some((a) => a.trim()))
        out.push(
          c.type === "multiple_choice"
            ? "Marcar al menos una opción correcta"
            : "Al menos una respuesta",
        );
      return out;
    }
    case "rubric": {
      const criteria = (c.criteria as RubricCriterion[] | undefined) ?? [];
      return [
        ...need("Nombre de la rúbrica", c.title),
        ...(criteria.some((cr) => cr.name.trim() && cr.descriptorEs.trim())
          ? []
          : ["Al menos un criterio completo"]),
      ];
    }
  }
}
