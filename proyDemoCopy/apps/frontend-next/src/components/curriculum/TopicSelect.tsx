"use client"; // [Next.js]: Client Component → pide el temario al BFF y gestiona «Otro tema»
import { useEffect, useState } from "react";
import { curatedTopicsAllLevels, textLevel, topicLevel, type TopicGroup } from "@/config/curriculum-topics";
import { slugify } from "@/lib/slug";
import { TopicTitle } from "@/components/language/TopicTitle";
import type { CefrLevel } from "@/types/courses";
import type { CurriculumItemKind, CurriculumSkill, CurriculumTopic } from "@/types/curriculum";
import type { Language } from "@/types/quiz";
// [TopicSelect · 2026-10-27]: el campo «Tema» de «Crear recurso» extraído para reutilizarlo en «Crear actividad» (antes Actividades tenía un <input> libre)
// MISMA fuente de temas: 1) catálogo curado (config/curriculum-topics, por tipo × idioma × nivel) · 2) temario guardado en NestJS (/api/curriculum/topics) · 3) grupos extra (p. ej. sugerencias de la IA) · «Otro tema (escribirlo)…»
// [Patrón]: Presentational + Custom Hook (useCatalogTopics) + Controlled Component | [Principio]: DRY (una sola lista de temas en todo el portal) + SRP | [Paradigma]: Declarativo + Reactivo
// [A11y]: <label> asociado, <optgroup> con el origen de cada tema, aria-invalid, el campo «Otro tema» con nombre accesible

export const OTHER_TOPIC = "__other__"; // Valor centinela del <option> «Otro tema»

export interface TopicQuery {
  language: Language | "";
  level: CefrLevel | "";
  skill: CurriculumSkill | "";
  kind: CurriculumItemKind;
}

// [useCatalogTopics]: temario guardado (NestJS) para la combinación idioma × nivel × competencia × tipo | se cancela si la combinación cambia
// `AbortController` (DOM): la respuesta de una combinación anterior nunca pisa la actual
export function useCatalogTopics({ language, level, skill, kind }: TopicQuery): CurriculumTopic[] {
  const comboKey = language && level && skill ? `${language}|${level}|${skill}|${kind}` : "";
  const [topics, setTopics] = useState<{ key: string; list: CurriculumTopic[] }>({ key: "", list: [] });
  useEffect(() => {
    if (!comboKey) return;
    const controller = new AbortController();
    const qs = new URLSearchParams({ language, level, skill, kind, limit: "50" }); // El backend admite máx. 50
    fetch(`/api/curriculum/topics?${qs}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<CurriculumTopic[]>) : []))
      .then((list) => setTopics({ key: comboKey, list }))
      .catch(() => undefined); // Sin temario se puede escribir «Otro tema»
    return () => controller.abort();
  }, [comboKey, language, level, skill, kind]);
  return topics.key === comboKey ? topics.list : [];
}

// [topicGroups]: grupos del <select> sin duplicados (por slug: sin tildes ni mayúsculas) | Función pura
export function topicGroups(curated: TopicGroup[], saved: CurriculumTopic[], extra: TopicGroup[] = []): TopicGroup[] {
  const seen = new Set(curated.flatMap((g) => g.topics.map((x) => slugify(x)))); // `Set` (ES2015): búsqueda O(1)
  const fresh = (names: ReadonlyArray<string>) =>
    names.filter((n) => {
      const k = slugify(n);
      return seen.has(k) ? false : (seen.add(k), true);
    });
  const savedNames = fresh(saved.map((x) => x.name));
  return [...curated, ...(savedNames.length ? [{ label: "Temario guardado", topics: savedNames }] : []), ...extra.map((g) => ({ ...g, topics: fresh(g.topics) })).filter((g) => g.topics.length)];
}

export interface TopicSelectProps {
  id: string;
  value: string; // Tema elegido o escrito
  custom: boolean; // true = «Otro tema»: se escribe en el campo de texto
  onChange: (topic: string, custom: boolean) => void;
  groups: TopicGroup[];
  ready: boolean; // false = falta idioma/nivel → select deshabilitado
  language?: Language | "";
  invalid?: boolean;
  label?: string;
  showTitle?: boolean; // Muestra el tema en el idioma estudiado (TopicTitle) — por defecto sí
  // [2026-11-09 · Nivel según el tema]: nivel elegido + setter → al elegir un tema del catálogo el nivel se ajusta solo y se muestra si coincide
  level?: CefrLevel | "";
  onLevelChange?: (level: CefrLevel) => void;
}

export function TopicSelect({ id, value, custom, onChange, groups, ready, language = "", invalid, label = "Tema", showTitle = true, level, onLevelChange }: TopicSelectProps) {
  const known = new Set(groups.flatMap((g) => g.topics));
  const topicLvl = value.trim().length >= 2 ? (topicLevel(value, language) ?? textLevel(value, language)) : null; // Nivel MCER del tema según el catálogo
  const pick = (next: string, isCustom: boolean) => {
    onChange(next, isCustom);
    const l = isCustom ? null : topicLevel(next, language);
    if (l && l !== level) onLevelChange?.(l); // [Asignar]: el tema define el nivel
  };
  const orphan = !custom && value && !known.has(value) ? value : null; // [Tema fuera de las listas]: p. ej. al editar contenido antiguo → no se pierde
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs font-semibold text-muted-foreground">
        {label} <span className="req" aria-hidden>*</span>
      </label>
      <select id={id} required value={custom ? OTHER_TOPIC : value} onChange={(e) => pick(e.target.value === OTHER_TOPIC ? "" : e.target.value, e.target.value === OTHER_TOPIC)} disabled={!ready} className="control w-full" aria-invalid={invalid || undefined}>
        <option value="">{ready ? "Elige un tema…" : "Primero elige el idioma"}</option>
        {orphan && <option value={orphan}>{orphan}</option>}
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.topics.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={OTHER_TOPIC}>Otro tema (escribirlo)…</option>
      </select>
      {/* [Evaluar · 2026-11-09]: nivel del tema frente al nivel elegido (texto + icono, no solo color) */}
      {onLevelChange !== undefined && value.trim().length >= 2 && (
        <p role="status" className={`type-meta ${topicLvl && level && topicLvl !== level ? "text-tone-warning" : "text-muted-foreground"}`}>
          {topicLvl
            ? level === topicLvl
              ? `✓ Tema de nivel ${topicLvl}: coincide con el nivel elegido.`
              : `⚠ Este tema es de nivel ${topicLvl} y el nivel elegido es ${level || "—"}.`
            : "Tema libre: el nivel no se detecta automáticamente; comprueba que corresponda al nivel elegido."}
          {topicLvl && level && topicLvl !== level && (
            <button type="button" className="ml-2 font-semibold text-primary underline" onClick={() => onLevelChange(topicLvl)}>Usar {topicLvl}</button>
          )}
        </p>
      )}
      {showTitle && language && value.trim().length >= 2 && !custom && <TopicTitle topic={value} language={language} />}
      {custom && (
        <input aria-label="Escribe el tema" required aria-invalid={invalid || undefined} value={value} onChange={(e) => onChange(e.target.value, true)} maxLength={160} placeholder="Ej.: Pedir en un restaurante" className="control w-full" autoFocus autoComplete="off" />
      )}
    </div>
  );
}

// [ACTIVITY_TOPIC_SOURCE · 2026-10-27]: qué temario usa cada sección de Actividades (mismo catálogo que Recursos) | [Patrón]: Lookup Table
// Práctica → gramática + vocabulario + situaciones (como «Ejercicio») · Diálogos → situaciones comunicativas · Lectura/Juegos/Poliglota → vocabulario y situaciones
export const ACTIVITY_TOPIC_SOURCE: Readonly<Record<string, { kind: CurriculumItemKind; skill: CurriculumSkill }>> = {
  practice: { kind: "exercise", skill: "grammar" },
  dialogues: { kind: "example", skill: "speaking" },
  reading: { kind: "exercise", skill: "reading" },
  games: { kind: "vocabulary", skill: "vocabulary" },
  polyglot: { kind: "vocabulary", skill: "vocabulary" },
  grammar: { kind: "grammar_rule", skill: "grammar" },
};

// [activityTopicGroups]: grupos curados para una sección de Actividades | Función pura
export const activityCurated = (tab: string, language: Language | "", level: CefrLevel | ""): TopicGroup[] => {
  const src = ACTIVITY_TOPIC_SOURCE[tab];
  // Poliglota no tiene idioma (siete a la vez) → se usa el inglés solo para la lista universal de vocabulario
  // [2026-11-09]: todos los niveles (primero el elegido) → el tema puede elegirse antes que el nivel y lo asigna
  return src && (language || tab === "polyglot") ? curatedTopicsAllLevels(src.kind, (language || "en") as Language, level) : [];
};
