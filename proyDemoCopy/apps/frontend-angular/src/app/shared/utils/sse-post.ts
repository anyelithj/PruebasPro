import { HttpEventType, type HttpClient } from '@angular/common/http';
import { concatMap, from, type Observable } from 'rxjs';
import { parseSseText, type SseData, type SseMessage } from './event-source';
// [postSse · shared/utils]: POST cuyo cuerpo de respuesta es SSE, leído en streaming (Tutor IA y Agente Guía) | [Patrón]: Adapter (texto SSE → mensajes tipados) | [Principio]: DRY (2 funcionalidades) + SRP (el parser puro `parseSseText` vive en event-source.ts, sin HTTP → lo usa también domain/) | [Paradigma]: Reactivo + Funcional
// [Tecnología]: HttpClient con fetch (`withFetch`) + `reportProgress` → `partialText` crece con cada trozo; los interceptores (credenciales, errores) siguen aplicando
// [Por qué no fromEventSource]: EventSource solo hace GET; aquí la pregunta viaja en el cuerpo del POST

// [postSse]: Observable frío de mensajes SSE en orden; procesa solo lo nuevo de `partialText` en cada evento de progreso
export function postSse(http: HttpClient, url: string, body: unknown): Observable<SseMessage<SseData>> {
  let consumed = 0; // Caracteres de `partialText` ya procesados
  let rest = ''; // Trozo SSE a medias entre eventos de progreso
  const feed = (text: string): SseMessage<SseData>[] => {
    const parsed = parseSseText(rest + text.slice(consumed));
    consumed = text.length;
    rest = parsed.rest;
    return parsed.messages;
  };
  return http.post(url, body, { observe: 'events', reportProgress: true, responseType: 'text' }).pipe(
    // `concatMap` + `from` (RxJS): cada evento HTTP se aplana en 0..n mensajes en orden
    concatMap((event) => {
      if (event.type === HttpEventType.DownloadProgress) return from(feed(event.partialText ?? ''));
      if (event.type === HttpEventType.Response) return from(feed((event.body ?? '') + '\n\n')); // Cierra el último trozo
      return from([] as SseMessage<SseData>[]);
    }),
  );
}
