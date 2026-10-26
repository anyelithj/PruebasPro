"use client"; // [Next.js]: Client Component → subida opcional de audio y foco al aparecer
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Upload } from "lucide-react";
import { ACTIVITY_ROUTES, ACTIVITY_KINDS, withReturnTo, type CreatableKind } from "@/lib/activity-kinds";
// [ActivityCreated · 2026-10-24]: panel EN LÍNEA (no modal) que sustituye al formulario tras guardar — Ver · Seguir editando · Crear otra · Volver a la lista
// Diálogos: subida opcional del audio aquí mismo (POST /api/dialogues/:id/audio → BFF → NestJS sincroniza los turnos)
// [Patrón]: Presentational + Post/Redirect/Get «en sitio» | [Principio]: SRP | [A11y]: role="status" + foco programático en el título → el lector anuncia el resultado

interface ActivityCreatedProps {
  kind: CreatableKind;
  id: string;
  warnings: string[];
  listHref: string; // /admin/activities?tab=… (pestaña de Gestión)
  onAnother: () => void;
}

export function ActivityCreated({ kind, id, warnings, listHref, onAnother }: ActivityCreatedProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputId = useId();
  const upload = ACTIVITY_KINDS[kind].mediaUpload;
  const [media, setMedia] = useState<{ busy: boolean; msg?: { ok: boolean; text: string } }>({ busy: false });
  useEffect(() => headingRef.current?.focus(), []); // [A11y]: el foco salta al resultado (el formulario ya no existe)

  // [onMedia]: multipart con el archivo → la respuesta de NestJS dice si se sincronizó
  const onMedia = async (file: File | undefined) => {
    if (!file || !upload) return;
    if (file.size > 20 * 1024 * 1024) return setMedia({ busy: false, msg: { ok: false, text: "El audio supera 20 MB." } }); // = maxBytes del BFF para dialogues
    setMedia({ busy: true });
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(upload.path(id), { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setMedia({ busy: false, msg: res.ok ? { ok: true, text: "Audio subido y sincronizado con los turnos." } : { ok: false, text: body.message ?? `HTTP ${res.status}` } });
    } catch (err) {
      setMedia({ busy: false, msg: { ok: false, text: err instanceof Error ? err.message : "No se pudo subir el audio." } });
    }
  };

  const routes = ACTIVITY_ROUTES[kind];
  return (
    <section role="status" aria-labelledby="created-title" className="surface space-y-4 p-6">
      <h2 id="created-title" ref={headingRef} tabIndex={-1} className="flex items-center gap-2 text-lg font-bold focus:outline-none">
        <CheckCircle2 aria-hidden className="size-6 text-tone-brand" /> {ACTIVITY_KINDS[kind].label} creada como borrador
      </h2>
      <p className="text-sm text-muted-foreground">Revísala y publícala desde la tabla de Gestión cuando esté lista.</p>
      {warnings.length > 0 && (
        <ul className="list-inside list-disc rounded-lg border border-tone-warning-line bg-tone-warning-soft p-3 text-xs text-tone-warning">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {upload && (
        <div className="space-y-1 rounded-xl border border-dashed border-border p-4">
          <label htmlFor={inputId} className={`btn btn-outline w-fit cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${media.busy ? "pointer-events-none opacity-50" : ""}`}>
            <Upload aria-hidden className="size-4" /> {media.busy ? "Subiendo…" : upload.label}
            <input id={inputId} type="file" accept={upload.accept} className="sr-only" disabled={media.busy} onChange={(e) => void onMedia(e.target.files?.[0])} />
          </label>
          <p className="text-[11px] text-muted-foreground">{upload.hint}</p>
          <p aria-live="polite" className={`text-xs ${media.msg ? (media.msg.ok ? "text-tone-brand" : "text-tone-danger") : "sr-only"}`}>
            {media.msg?.text ?? ""}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {/* `<a>`: Ver/Editar son pantallas del remoto Angular (rewrites) → navegación completa */}
        <a href={withReturnTo(routes.edit(id), listHref)} className="btn btn-primary">
          Seguir editando
        </a>
        <a href={`/admin/activities/ver/${kind}/${encodeURIComponent(id)}`} className="btn btn-outline">
          Revisar y publicar
        </a>
        <button type="button" onClick={onAnother} className="btn btn-outline">
          Crear otra
        </button>
        <Link href={listHref} className="btn btn-ghost">
          Volver a la lista
        </Link>
      </div>
    </section>
  );
}
