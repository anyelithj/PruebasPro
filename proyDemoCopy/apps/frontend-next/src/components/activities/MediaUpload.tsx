"use client"; // [Next.js]: Client Component → subida del archivo y mensaje de resultado
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "@/components/shared/Toaster";
// [MediaUpload · 2026-10-27]: audio opcional de una actividad (Diálogos: cada turno se sincroniza) — antes vivía en el panel «Actividad creada», que se quitó
// a favor de «crear → toast → revisión»; ahora está en la página de REVISIÓN | [Patrón]: Presentational + Command (POST multipart al BFF) | [Principio]: SRP + DRY (la ruta y los límites salen de la estrategia)
// [A11y]: <label> que envuelve el input (activable con teclado) · resultado en aria-live + toast

// [Fix 2026-10-28]: el Server Component ya NO pasa `upload.path` (una función → no serializable por RSC: «Functions cannot be passed directly to Client Components»)
// [Patrón]: DTO serializable — la página resuelve la URL en el servidor y aquí solo llegan strings | [TypeScript]: `type` alias = contrato de props
export type MediaUploadProps = { url: string; accept: string; label: string; hint: string };

export function MediaUpload({ url, accept, label, hint }: MediaUploadProps) {
  const inputId = useId();
  const router = useRouter();
  const [state, setState] = useState<{ busy: boolean; msg?: { ok: boolean; text: string } }>({ busy: false });

  // [onFile]: multipart con el archivo → la respuesta de NestJS dice si se sincronizó
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return setState({ busy: false, msg: { ok: false, text: "El audio supera 20 MB." } }); // = maxBytes del BFF
    setState({ busy: true });
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(url, { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { message?: string; aligned?: boolean };
      const msg = res.ok ? { ok: true, text: body.aligned === false ? "Audio subido (sin sincronizar: el servicio de alineación no respondió)." : "Audio subido y sincronizado con los turnos." } : { ok: false, text: body.message ?? `HTTP ${res.status}` };
      setState({ busy: false, msg });
      toast(msg.ok ? "success" : "error", msg.text);
      if (res.ok) router.refresh();
    } catch (err) {
      setState({ busy: false, msg: { ok: false, text: err instanceof Error ? err.message : "No se pudo subir el audio." } });
    }
  };

  return (
    <div className="space-y-1 rounded-xl border border-dashed border-border p-4">
      <label htmlFor={inputId} className={`btn btn-outline w-fit cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${state.busy ? "pointer-events-none opacity-50" : ""}`}>
        <Upload aria-hidden className="size-4" /> {state.busy ? "Subiendo…" : label}
        <input id={inputId} type="file" accept={accept} className="sr-only" disabled={state.busy} onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>
      <p className="type-meta text-muted-foreground">{hint}</p>
      <p aria-live="polite" className={`text-xs ${state.msg ? (state.msg.ok ? "text-tone-brand" : "text-tone-danger") : "sr-only"}`}>
        {state.msg?.text ?? ""}
      </p>
    </div>
  );
}
