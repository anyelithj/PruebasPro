import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';
import { z } from 'zod';
import { API_URL } from '@core/http/api-url.token';
import { ApiError } from '@core/http/error.interceptor';
import { TextImportService, type ExtractedText } from '@core/media/text-import.service';
// [LyricsImportService · Infraestructura · 2026-10-24]: «Importar la letra desde un enlace» → primero NestJS POST /music/lyrics/from-url (descarga como navegador y localiza la letra en Genius, Letras, AZLyrics…)
// Si el enlace no es una página de texto (PDF, imagen, audio → 415) se usa el extractor general de Next.js (OCR, Whisper) heredado de TextImportService
// [Bug]: «El sitio bloqueó la descarga automática (código 403)» — el extractor general se identificaba como bot y devolvía la página entera; este va directo a la letra
// [Patrón]: Decorator/Override por DI (el componente compartido <aula-text-import> recibe esta clase vía `providers` del editor de letra) + Fallback | [Principio]: OCP (no se toca la molécula compartida) + LSP (mismo contrato que TextImportService) | [Paradigma]: Asíncrono

const LyricsSchema = z.object({ title: z.string().default(''), text: z.string(), holder: z.string().default('') }); // Mismo contrato que ExtractedText

@Injectable()
export class LyricsImportService extends TextImportService {
  private readonly client = inject(HttpClient); // Nombre distinto: el `http` del padre es `private`
  private readonly lyricsUrl = `${inject(API_URL)}/music/lyrics/from-url`;

  // `override` (TS 4.3): reemplaza el método del padre; el archivo (fromFile) sigue igual
  override async fromUrl(url: string, language: string): Promise<ExtractedText> {
    try {
      return await firstValueFrom(this.client.post<unknown>(this.lyricsUrl, { url }).pipe(map((r) => LyricsSchema.parse(r))));
    } catch (err) {
      // 415 = no es HTML/texto → el extractor general sabe leer PDF, imágenes y audio; cualquier otro error trae ya un mensaje accionable
      if (err instanceof ApiError && err.status === 415) return super.fromUrl(url, language); // `ApiError`: el interceptor ya tradujo el HttpErrorResponse
      throw err;
    }
  }
}
