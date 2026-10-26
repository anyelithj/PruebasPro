import { Inject, Injectable } from '@nestjs/common';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
} from '../../../../shared/domain/interfaces/language-tools.interface';
// [UseCase TopicTitle · 2026-10-19]: el tema de un vocabulario (guardado en español: «La familia») en el idioma que se estudia («The family») con su IPA y la traducción al español | [Patrón]: Use Case (Query) + Ports & Adapters (LanguageToolsPort) + Cache-Aside en memoria | [Principio]: SRP + DRY (mismo puerto que el traductor) | [Paradigma]: POO + async/await
// [Por qué]: el alumno veía el título solo en español; ahora lo ve, lo escucha (audio del servidor) y lo pronuncia en el idioma estudiado

export interface TopicTitle {
  text: string; // Título en el idioma estudiado
  ipa: string;
  ipaUs: string | null;
  translationEs: string; // El tema original en español
}

@Injectable()
export class TopicTitleUseCase {
  // ponytail: caché en memoria del proceso (pocos temas); Redis si hay varias instancias del backend
  private readonly cache = new Map<string, TopicTitle>();

  constructor(@Inject(LANGUAGE_TOOLS) private readonly tools: LanguageToolsPort) {}

  async execute(topic: string, language: string, token: string): Promise<TopicTitle> {
    const key = `${language}|${topic.toLowerCase()}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    // Español: el título ya está en el idioma; solo falta el IPA
    const text =
      language === 'es'
        ? topic
        : (await this.tools.translate(topic, 'es', language, token)).translation.trim() || topic;
    // [Degradación · 2026-10-24]: si FastAPI no da la IPA (503 puntual de espeak-ng) el título se muestra igual, sin IPA, y NO se cachea → el próximo intento la completa | [Principio]: Fail Soft
    const ipa = await this.tools
      .ipa(text, language, token)
      .catch(() => null); // `.catch` (Promise): convierte el fallo en `null` sin try/catch anidado
    const out = {
      text,
      ipa: ipa?.ipa ?? '',
      ipaUs: ipa?.ipa_us ?? null,
      translationEs: topic,
    };
    if (ipa) this.cache.set(key, out);
    return out;
  }
}
