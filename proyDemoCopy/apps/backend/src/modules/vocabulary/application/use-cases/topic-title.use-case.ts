import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
} from '../../../../shared/domain/interfaces/language-tools.interface';
// [UseCase TopicTitle · 2026-10-19]: el tema de un vocabulario (guardado en español: «La familia») en el idioma que se estudia («The family») con su IPA y la traducción al español | [Patrón]: Use Case (Query) + Ports & Adapters (LanguageToolsPort) + Cache-Aside en memoria | [Principio]: SRP + DRY (mismo puerto que el traductor) | [Paradigma]: POO + async/await
// [Por qué]: el alumno veía el título solo en español; ahora lo ve, lo escucha (audio del servidor) y lo pronuncia en el idioma estudiado
// [Fail Soft total · 2026-10-27]: este endpoint es DECORATIVO (un título en la cabecera de la ficha) → NUNCA responde 503: si FastAPI/Ollama no traducen o no dan IPA
// se devuelve 200 con el tema original, `ipa: null` y `translated: false`, SIN cachear (el próximo intento lo completa) | [Principio]: Fail Soft + Graceful Degradation

export interface TopicTitle {
  text: string; // Título en el idioma estudiado (o el tema original si no hubo traducción)
  ipa: string | null; // null = sin IPA (servicio caído o texto sin traducir)
  ipaUs: string | null;
  translationEs: string; // El tema original en español
  translated: boolean; // [2026-10-27]: false → `text` es el tema original (la UI no repite «La familia · La familia» ni lo lee con voz extranjera)
}

// [Plazo]: un FastAPI colgado (Ollama cargando el modelo) no debe dejar la cabecera esperando 90 s → a los 8 s se responde sin traducción | constante nombrada (sin número mágico)
const TOPIC_DEADLINE_MS = 8_000;

// [withDeadline]: `Promise.race` (ES2015) entre la llamada y un temporizador → null si vence o si la llamada falla | `finally` limpia el temporizador (sin fugas en Jest ni en el proceso)
// [Patrón]: Timeout + Null Object | [Paradigma]: Funcional (no lanza nunca)
async function withDeadline<T>(
  task: () => Promise<T>,
  ms: number,
): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  const expired = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    // `Promise.resolve().then(task)`: un `throw` SÍNCRONO del adaptador también se convierte en rechazo → `.catch` lo recoge
    return await Promise.race([
      Promise.resolve()
        .then(task)
        .catch(() => null),
      expired,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class TopicTitleUseCase {
  private readonly logger = new Logger(TopicTitleUseCase.name);
  // ponytail: caché en memoria del proceso (pocos temas); Redis si hay varias instancias del backend
  private readonly cache = new Map<string, TopicTitle>();
  // [En vuelo · 2026-10-27]: peticiones simultáneas del mismo tema (varias fichas, StrictMode) comparten UNA llamada a FastAPI | [Patrón]: Single-Flight
  private readonly pending = new Map<string, Promise<TopicTitle>>();

  constructor(@Inject(LANGUAGE_TOOLS) private readonly tools: LanguageToolsPort) {}

  execute(topic: string, language: string, token: string): Promise<TopicTitle> {
    const key = `${language}|${topic.toLowerCase()}`;
    const hit = this.cache.get(key);
    if (hit) return Promise.resolve(hit);
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;
    // `.finally` (ES2018): libera la entrada en vuelo tanto si hubo traducción como si se degradó
    const run = this.resolve(key, topic, language, token).finally(() =>
      this.pending.delete(key),
    );
    this.pending.set(key, run);
    return run;
  }

  // [resolve]: traducción → IPA, cada paso con plazo y sin lanzar | solo se cachea el resultado COMPLETO (traducción + IPA)
  private async resolve(
    key: string,
    topic: string,
    language: string,
    token: string,
  ): Promise<TopicTitle> {
    const original: TopicTitle = {
      text: topic,
      ipa: null,
      ipaUs: null,
      translationEs: topic,
      translated: false,
    };
    // Español: el título ya está en el idioma; solo falta el IPA
    const translated =
      language === 'es'
        ? topic
        : await withDeadline(
            () =>
              this.tools
                .translate(topic, 'es', language, token)
                .then((r) => r.translation?.trim() || null), // `?.` (ES2020): respuesta sin `translation` o vacía («unavailable») → null
            TOPIC_DEADLINE_MS,
          );
    if (!translated) {
      this.logger.debug(`Título sin traducir (${key}): servicio de idiomas no disponible`);
      return original; // [Sin traducción]: la IPA del español leída con fonética extranjera sería falsa → no se pide
    }
    // [Degradación · 2026-10-24]: si FastAPI no da la IPA (503 puntual de espeak-ng) el título se muestra igual, sin IPA, y NO se cachea
    const ipa = await withDeadline(
      () => this.tools.ipa(translated, language, token),
      TOPIC_DEADLINE_MS,
    );
    const out: TopicTitle = {
      text: translated,
      ipa: ipa?.ipa || null, // `||`: IPA vacía ('') también cuenta como «sin IPA»
      ipaUs: ipa?.ipa_us ?? null,
      translationEs: topic,
      translated: language !== 'es',
    };
    if (out.ipa) this.cache.set(key, out);
    return out;
  }
}
