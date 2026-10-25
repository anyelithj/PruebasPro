import { materialMime, type CourseMaterial } from "@/types/courses";
// [Cliente de subida de materiales]: sube un archivo al BFF informando el progreso | [Patrón]: Adapter (XHR → Promise) | [Principio]: SRP | [Paradigma]: Asíncrono (Promise)
// [Tecnología]: XMLHttpRequest — a diferencia de fetch, expone `upload.onprogress` → barra de progreso real en videos grandes

// [addLinkMaterial · 2026-10-23]: adjunta un enlace externo (sin binario) → POST JSON al BFF | [Patrón]: Adapter (fetch → Promise)
export async function addLinkMaterial(courseId: string, url: string, title: string): Promise<CourseMaterial> {
  const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}/materials/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, title }),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: CourseMaterial; message?: string | string[] };
  if (!res.ok || !body.data) throw new Error(Array.isArray(body.message) ? body.message.join(", ") : (body.message ?? `HTTP ${res.status}`));
  return body.data;
}

export function uploadMaterial(courseId: string, file: File, title: string, onProgress: (pct: number) => void): Promise<CourseMaterial> {
  // `new Promise` (ES2015): envuelve la API de eventos de XHR en una promesa
  return new Promise((resolve, reject) => {
    const form = new FormData(); // [FormData] (Web API): multipart/form-data con el archivo y su título
    form.append("title", title);
    // [Tipo explícito]: si el navegador no lo aportó, se re-etiqueta el Blob con el MIME deducido → el backend no lo rechaza como octet-stream
    const type = materialMime(file) ?? file.type;
    form.append("file", type === file.type ? file : new File([file], file.name, { type }));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/courses/${encodeURIComponent(courseId)}/materials`);
    // `lengthComputable`: el navegador conoce el tamaño total → porcentaje exacto
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      // [Respuesta]: envelope { data } del backend o { message } de error
      let body: { data?: CourseMaterial; message?: string | string[] } = {};
      try {
        body = JSON.parse(xhr.responseText) as typeof body;
      } catch {
        /* cuerpo no JSON → se usa el status */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.data) resolve(body.data);
      else reject(new Error(Array.isArray(body.message) ? body.message.join(", ") : (body.message ?? `HTTP ${xhr.status}`)));
    };
    xhr.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
    xhr.send(form);
  });
}
