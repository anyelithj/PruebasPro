import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthor, textFromUrl } from "@/lib/extract-text";
// [Route Handler POST /api/dialogues/import-url · 2026-10-19]: lee el TEXTO de una página con un diálogo (modo «Desde una URL» del formulario Angular /dialogos/subir)
// → Angular envía ese texto a NestJS POST /dialogues/draft, que extrae el guion «Nombre: frase» (o lo arma la IA) | [Patrón]: BFF + Adapter (HTML → texto) + Guard (rol y red)
// [2026-10-23]: usa el extractor compartido (lib/extract-text) → el enlace también puede ser un PDF, un .docx o una imagen | [Principio]: DRY
// [Ruta estática]: tiene prioridad sobre el catch-all /api/[...path] (proxy a NestJS)

export const runtime = "nodejs"; // `runtime` (Next.js): safeFetch usa node:dns/http/net

const schema = z.object({ url: z.string().trim().url().max(2000), language: z.string().max(5).optional() });

export async function POST(request: Request) {
  const denied = await requireAuthor(); // [Autorización]: solo docentes y administradores (este endpoint hace peticiones salientes)
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ message: "Escribe un enlace válido (https://…)." }, { status: 400 });
  try {
    return NextResponse.json(await textFromUrl(parsed.data.url, parsed.data.language));
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : "No se pudo leer el enlace." }, { status: 422 });
  }
}
