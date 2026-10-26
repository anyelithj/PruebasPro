import { NextResponse } from "next/server";
import { z } from "zod";
import { parse } from "node-html-parser";
import { getCurrentUserPayload } from "@/lib/auth";
import { Role } from "@/lib/constants";
import { safeFetch } from "@/lib/safe-fetch";
import { MAX_IMPORT_ROWS, type Extracted } from "@/lib/resource-import";
const MAX_TEXT = 50_000; // Tope de texto devuelto (una página larga de gramática cabe; evita respuestas enormes)
// [Route Handler POST /api/curriculum/import-url]: importa recursos desde el ENLACE de una página web (o de un PDF/Excel/CSV/Word/imagen publicado en la web)
// [Por qué en el servidor]: el navegador no puede leer páginas de otros dominios (CORS) → el BFF descarga con safeFetch (anti-SSRF) y devuelve filas o el archivo
// [Patrón]: BFF + Adapter (HTML → filas) + Guard (rol y red) | [Principio]: SRP + Least Privilege | [Tecnología]: Next.js Route Handler (Node.js) + node-html-parser + Zod

export const runtime = "nodejs"; // `runtime` (Next.js): necesita node:dns/http/net

const schema = z.object({ url: z.string().trim().url().max(2000) });
// Tipos de archivo que el navegador sabe convertir (mismos extractores que "Importar archivo")
const FILE_TYPES = /^(application\/pdf|text\/csv|text\/plain|text\/tab-separated-values|image\/|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml|wordprocessingml)|application\/vnd\.ms-excel|application\/vnd\.oasis\.opendocument\.spreadsheet)/;

// [htmlExtract]: página → tabla (una fila por <tr> con ≥ 2 celdas) + texto (títulos, párrafos, listas) | [Paradigma]: Funcional
// [2026-10-24]: devuelve AMBOS (mismo `Extracted` que un archivo) → cada tipo de recurso elige: vocabulario usa la tabla; una regla gramatical, el texto
function htmlExtract(html: string): Extracted & { title: string } {
  const root = parse(html);
  const title = root.querySelector("title")?.text.trim() ?? "";
  root.querySelectorAll("script,style,noscript,nav,header,footer,aside,form,svg").forEach((n) => n.remove()); // Ruido de la página
  const tableRows = root
    .querySelectorAll("table tr")
    .map((tr) => tr.querySelectorAll("th,td").map((td) => td.text.replace(/\s+/g, " ").trim()))
    .filter((r) => r.filter(Boolean).length >= 2); // Filas con al menos 2 celdas con texto (palabra + traducción)
  const main = root.querySelector("main,article") ?? root; // Contenido principal si existe
  const lines = main.querySelectorAll("h1,h2,h3,h4,p,li,dt,dd").map((n) => n.text.replace(/\s+/g, " ").trim());
  return { rows: tableRows.length >= 2 ? tableRows.slice(0, MAX_IMPORT_ROWS + 1) : [], text: lines.filter(Boolean).join("\n").slice(0, MAX_TEXT), title };
}

export async function POST(request: Request) {
  // [Autorización]: solo docentes y administradores crean recursos (y este endpoint hace peticiones salientes)
  const user = await getCurrentUserPayload();
  if (!user) return NextResponse.json({ message: "Inicia sesión." }, { status: 401 });
  if (user.role !== Role.TEACHER && user.role !== Role.ADMIN) return NextResponse.json({ message: "No tienes permiso para importar recursos." }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ message: "Escribe un enlace válido (https://…)." }, { status: 400 });

  try {
    const res = await safeFetch(parsed.data.url);
    const type = res.contentType.split(";")[0].trim().toLowerCase();
    if (type === "text/html" || type === "application/xhtml+xml") {
      return NextResponse.json({ kind: "page", ...htmlExtract(res.body.toString("utf-8")) }); // `...` (ES2018): rows + text + title
    }
    if (FILE_TYPES.test(type)) {
      // [Archivo]: se devuelve en base64 y el navegador usa los mismos extractores que al subir un archivo
      const name = decodeURIComponent(new URL(res.url).pathname.split("/").pop() || "archivo");
      return NextResponse.json({ kind: "file", name, type, base64: res.body.toString("base64") });
    }
    return NextResponse.json({ message: `El enlace devuelve un tipo de contenido no admitido (${type || "desconocido"}).` }, { status: 415 });
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : "No se pudo leer el enlace." }, { status: 422 });
  }
}
