"use client";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/slug";
import { languageLabel } from "@/lib/languages";
import { SearchSelect, type SearchOption } from "@/components/curriculum/SearchSelect";
import { SKILL_LABEL, type CurriculumSkill, type CurriculumSource, type CurriculumTopic } from "@/types/curriculum";
import type { CefrLevel } from "@/types/courses";
import type { Language } from "@/types/quiz";
// [Paneles de alta rápida]: crear tema o fuente sin salir del formulario de recurso (solo ADMIN; el backend lo exige) | sin LLM

type TopicOption = CurriculumTopic & SearchOption;

// [POST al BFF]: devuelve la entidad creada o lanza con el mensaje del backend
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json()) as T & { message?: string };
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return data;
}

export function TopicCreatePanel({
  language,
  level,
  skill,
  onCreated,
  onCancel,
}: {
  language: Language;
  level: CefrLevel;
  skill: CurriculumSkill;
  onCreated: (topic: CurriculumTopic) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [parent, setParent] = useState<TopicOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const slug = slugify(name); // Vista previa; el backend genera el definitivo

  // [Tema padre]: se elige entre los temas de la misma combinación
  const fetchParents = useCallback(
    async (q: string, signal: AbortSignal): Promise<TopicOption[]> => {
      const qs = new URLSearchParams({ language, level, skill, limit: "20", ...(q ? { search: q } : {}) });
      const res = await fetch(`/api/curriculum/topics?${qs}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return ((await res.json()) as CurriculumTopic[]).map((t) => ({ ...t, label: t.name }));
    },
    [language, level, skill],
  );

  const save = async () => {
    if (!slug || saving) return;
    setSaving(true);
    setError(null);
    try {
      const topic = await postJson<CurriculumTopic>("/api/curriculum/topics", {
        name: name.trim(),
        language,
        level,
        skill,
        ...(parent ? { parentId: parent.id } : {}),
      });
      onCreated(topic);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="group" aria-label="Crear nuevo tema" className="space-y-3 rounded-lg border border-primary/30 bg-background p-4">
      <p className="text-xs text-muted-foreground">
        {languageLabel(language)} · {level} · {SKILL_LABEL[skill]}
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="new-topic-name">Nombre *</Label>
        <Input id="new-topic-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Present Simple" autoFocus />
        <p className="text-xs text-muted-foreground">
          Clave: <code>{slug || "—"}</code>
        </p>
      </div>
      <SearchSelect<TopicOption>
        id="new-topic-parent"
        label="Tema padre (opcional)"
        placeholder="Buscar tema padre…"
        value={parent}
        onSelect={setParent}
        fetchOptions={fetchParents}
        contextKey={`${language}|${level}|${skill}`}
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={!slug || saving} onClick={save}>
          {saving ? "Guardando…" : "Guardar tema"}
        </Button>
      </div>
    </div>
  );
}

const SOURCE_FIELDS = [
  { key: "type", label: "Tipo", placeholder: "libro, web, diccionario" },
  { key: "author", label: "Autor", placeholder: "" },
  { key: "publisher", label: "Editorial", placeholder: "" },
  { key: "url", label: "URL", placeholder: "https://…" },
  { key: "license", label: "Licencia", placeholder: "CC BY 4.0" },
  { key: "language", label: "Idioma", placeholder: "en" },
] as const;

export function SourceCreatePanel({
  onCreated,
  onCancel,
}: {
  onCreated: (source: CurriculumSource) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [attribution, setAttribution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (name.trim().length < 2 || saving) return;
    setSaving(true);
    setError(null);
    // Solo se envían los campos rellenados
    const extra = Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
    try {
      const source = await postJson<CurriculumSource>("/api/curriculum/sources", {
        name: name.trim(),
        ...extra,
        ...(attribution.trim() ? { attribution: attribution.trim() } : {}),
      });
      onCreated(source);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="group" aria-label="Crear nueva fuente" className="space-y-3 rounded-lg border border-primary/30 bg-background p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="new-source-name">Nombre *</Label>
          <Input id="new-source-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        {SOURCE_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`new-source-${f.key}`}>{f.label}</Label>
            <Input
              id={`new-source-${f.key}`}
              value={fields[f.key] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
          </div>
        ))}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="new-source-attribution">Atribución</Label>
          <Input
            id="new-source-attribution"
            value={attribution}
            onChange={(e) => setAttribution(e.target.value)}
            placeholder="Si se deja vacía se usa: «Nombre. Material utilizado/adaptado según la licencia registrada.»"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" size="sm" disabled={name.trim().length < 2 || saving} onClick={save}>
          {saving ? "Guardando…" : "Guardar fuente"}
        </Button>
      </div>
    </div>
  );
}
