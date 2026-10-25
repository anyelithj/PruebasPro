import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';
import { z } from 'zod';
import { API_URL } from '@core/http/api-url.token';
// [TextImportService · core/media · 2026-10-23]: texto de un archivo (PDF, Word .docx, texto, imagen con OCR) o de un enlace → Route Handler de Next.js /api/media/extract-text
// [Uso]: letra de canciones y cualquier formulario que quiera «importar desde archivo o URL» | [Patrón]: Facade + Adapter (HTTP → texto validado) | [Principio]: DRY (un extractor para todo el portal) + Fail Fast (Zod) | [Paradigma]: Asíncrono

// [ExtractedSchema]: contrato de la respuesta (lib/extract-text.ts de Next.js) | `z.object` (Zod)
const ExtractedSchema = z.object({ title: z.string().default(''), text: z.string(), holder: z.string().default('') });
export type ExtractedText = z.infer<typeof ExtractedSchema>;

// `accept` del <input type="file">: lo que el extractor sabe leer
export const TEXT_IMPORT_ACCEPT = '.pdf,.docx,.xlsx,.xls,.ods,.csv,.txt,.lrc,.srt,.md,.html,image/*,audio/*,video/*'; // [2026-10-23]: + Excel y audio/video (transcripción Whisper)

@Injectable({ providedIn: 'root' })
export class TextImportService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/media/extract-text`;

  // [fromFile]: multipart con el archivo y el idioma (el OCR elige su modelo) | `FormData` (Web API)
  fromFile(file: File, language: string): Promise<ExtractedText> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('language', language);
    return firstValueFrom(this.http.post<unknown>(this.url, form).pipe(map((r) => ExtractedSchema.parse(r))));
  }

  // [fromUrl]: el servidor descarga el enlace con protección SSRF (página web, PDF, imagen…)
  fromUrl(url: string, language: string): Promise<ExtractedText> {
    return firstValueFrom(this.http.post<unknown>(this.url, { url, language }).pipe(map((r) => ExtractedSchema.parse(r))));
  }
}
