import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackgroundTasks } from '../../../../shared/background/background-tasks';
import { ReadingSentence } from '../../domain/entities/reading-sentence.entity';
import { ReadingText } from '../../domain/entities/reading-text.entity';
import { ReadingGenre } from '../../domain/reading-genre';
import { buildSentences, countWords } from '../../domain/sentence-splitter';
import { ENRICH_BATCH, SentenceEnricher } from './sentence-enricher';
// [ReadingContentWriter · Lectura · 2026-10-25]: escribe el CONTENIDO de un texto — párrafos → frases → filas — en una transacción | [Patrón]: Domain Service + Unit of Work (transacción TypeORM) + Memoization (reutiliza la traducción de frases idénticas) | [Principio]: SRP + DRY (crear y reemplazar el texto comparten el flujo) | [Paradigma]: POO + async/await
// [Reutilización]: al editar el texto, las frases que no cambiaron conservan su traducción/IPA (incluida la corrección manual del docente) → solo se piden las nuevas
// [Guardar primero, enriquecer después · 2026-10-27]: antes `write` esperaba la traducción + IPA de TODAS las frases (lotes de 20 en serie, hasta 70–90 s cada uno con Ollama en CPU)
// → crear una lectura de ~60 frases tardaba 3–5 min y el BFF podía cortar. Ahora las frases se guardan al instante y `fill` las completa en segundo plano (BackgroundTasks);
// la API devuelve `enriching: true` y la UI muestra «Generando IPA/traducción…» | [Patrón]: Fire-and-Forget + Lazy Backfill | [Principio]: Fail-soft (si falla, queda «Completar IPA y traducción»)

export interface WriteResult {
  sentences: ReadingSentence[];
  pending: number; // Frases aún sin IPA o sin traducción (se están generando o falló un lote) → «Completar IPA y traducción»
  enriching: boolean; // `true` = hay una tarea en segundo plano completándolas
}

// [enrichKey]: clave de coalescing por texto → crear/editar varias veces seguidas = una sola tarea con los datos más recientes | Función pura
export const enrichKey = (textId: string): string => `reading:${textId}`;

// [BACKFILL_COOLDOWN_MS · 2026-10-28]: entre dos rellenos perezosos del MISMO texto disparados al leer → si FastAPI/Ollama falla, el lector no lo reintenta en cada GET | [Patrón]: Throttle por clave
export const BACKFILL_COOLDOWN_MS = 120_000;

@Injectable()
export class ReadingContentWriter {
  constructor(
    @InjectRepository(ReadingSentence)
    private readonly sentences: Repository<ReadingSentence>,
    private readonly enricher: SentenceEnricher,
    private readonly background: BackgroundTasks, // [DI · 2026-10-27]: cola global en segundo plano (BackgroundTasksModule, @Global)
  ) {}

  // [write]: reemplaza todas las frases del texto (borrar + insertar en la misma transacción), actualiza los contadores y PROGRAMA la traducción/IPA de las nuevas
  async write(
    text: ReadingText,
    paragraphs: readonly string[],
    token: string,
    previous: readonly ReadingSentence[] = [],
  ): Promise<WriteResult> {
    const drafts = buildSentences(
      paragraphs,
      text.language,
      text.genre === ReadingGenre.POEM,
    );
    // `Map` (ES2015): texto exacto → frase anterior (la última gana) → se conserva traducción/IPA/revisión
    const known = new Map(previous.map((s) => [s.text, s]));
    const rows = drafts.map((d) => {
      const old = known.get(d.text);
      return this.sentences.create({
        textId: text.id,
        paragraph: d.paragraph,
        position: d.position,
        text: d.text,
        translation: old?.translation ?? null,
        ipa: old?.ipa ?? '',
        ipaUs: old?.ipaUs ?? null,
        reviewed: !!old?.reviewed,
      });
    });
    text.sentenceCount = rows.length;
    text.wordCount = countWords(
      drafts.map((d) => d.text).join(' '),
      text.language,
    );
    // `manager.transaction` (TypeORM): todo o nada — nunca queda un texto a medias
    const saved = await this.sentences.manager.transaction(async (em) => {
      await em.delete(ReadingSentence, { textId: text.id });
      await em.save(ReadingText, text);
      return em.save(ReadingSentence, rows);
    });
    const pending = saved.filter((s) =>
      needsEnrichment(s, text.language),
    ).length;
    // [Segundo plano]: solo si falta algo; `schedule` vuelve al instante (la respuesta no espera a FastAPI/Ollama)
    if (pending)
      this.background.schedule(enrichKey(text.id), () =>
        this.fill(text.id, text.language, token),
      );
    return { sentences: saved, pending, enriching: pending > 0 };
  }

  // `Map` (ES2015): textId → último relleno perezoso programado (ms) | memoria del proceso (se pierde al reiniciar: aceptable, solo limita reintentos)
  private readonly lastBackfill = new Map<string, number>();

  // [backfill · 2026-10-28]: relleno perezoso al LEER (lector de estudiantes incluido) — si faltan traducciones/IPA y no hay tarea en curso, se programa `fill` en segundo plano
  // y el resultado queda CACHEADO en las filas (la próxima lectura ya no llama a la IA) | devuelve `true` si hay una tarea activa → la UI sondea
  // [Patrón]: Lazy Backfill + Cache-Aside (la tabla de frases es la caché) + Throttle (BACKFILL_COOLDOWN_MS) | [Principio]: Fail-soft (un fallo no rompe el GET)
  backfill(
    textId: string,
    language: string,
    token: string,
    now = Date.now(),
  ): boolean {
    if (this.isEnriching(textId)) return true;
    if (
      !token ||
      now - (this.lastBackfill.get(textId) ?? 0) < BACKFILL_COOLDOWN_MS
    )
      return false;
    this.lastBackfill.set(textId, now);
    this.background.schedule(enrichKey(textId), () =>
      this.fill(textId, language, token),
    );
    return true;
  }

  // [isEnriching]: ¿se están generando la IPA/traducción de este texto? → `enriching` en GET y en el alta
  isEnriching(textId: string): boolean {
    return this.background.isActive(enrichKey(textId));
  }

  // [fill]: completa las frases a las que les falta IPA o traducción (`force`: todas menos las revisadas) | lo usan el segundo plano y «Completar IPA y traducción» | [Principio]: DRY
  async fill(
    textId: string,
    language: string,
    token: string,
    force = false,
  ): Promise<{ updated: number; pending: number }> {
    const all = await this.sentences.find({
      where: { textId },
      order: { position: 'ASC' },
    });
    const target = all.filter((s) =>
      force ? !s.reviewed : needsEnrichment(s, language),
    );
    if (!target.length) return { updated: 0, pending: 0 };
    let updated = 0;
    // [Por tandas · 2026-10-31]: se guarda cada lote al terminarlo → el sondeo del lector rellena la columna poco a poco y un corte no pierde lo ya traducido
    const batches = async (rows: ReadingSentence[]): Promise<void> => {
      for (let i = 0; i < rows.length; i += ENRICH_BATCH) {
        const chunk = rows.slice(i, i + ENRICH_BATCH);
        const { items } = await this.enricher.enrich(
          chunk.map((s) => s.text),
          language,
          token,
        );
        // [Fusión]: un dato nuevo vacío NO borra uno existente (lote fallido) | `flatMap`: solo las frases que cambiaron
        const changed = chunk.flatMap((s, k) => {
          const l = items[k];
          if (!l || (!l.ipa && !l.translation)) return [];
          if (l.ipa) Object.assign(s, { ipa: l.ipa, ipaUs: l.ipaUs });
          if (l.translation) s.translation = l.translation;
          return [s];
        });
        // [Sin resucitar filas · 2026-10-27]: el docente pudo reescribir el texto mientras se traducía (borrar + insertar frases) → `update` por id + texto
        // nunca inserta (a diferencia de `save`) y no pisa una frase que cambió | `manager.transaction` (TypeORM): un solo commit por lote
        if (changed.length)
          await this.sentences.manager.transaction((em) =>
            Promise.all(
              changed.map((s) =>
                em.update(
                  ReadingSentence,
                  { id: s.id, text: s.text },
                  { ipa: s.ipa, ipaUs: s.ipaUs, translation: s.translation },
                ),
              ),
            ),
          );
        updated += changed.length;
      }
    };
    await batches(target);
    // [Segunda pasada · 2026-10-31]: con el modelo en frío la primera frase puede fallar (carga lenta) → se reintenta UNA vez lo que quedó sin traducir, ya con el modelo cargado
    const missing = target.filter((s) => needsEnrichment(s, language));
    if (missing.length) await batches(missing);
    return {
      updated,
      pending: all.filter((s) => needsEnrichment(s, language)).length,
    };
  }
}

// [needsEnrichment]: falta IPA, o falta traducción en un texto que no es español | Función pura (la usan escribir, completar y la vista)
export const needsEnrichment = (
  s: Pick<ReadingSentence, 'ipa' | 'translation'>,
  language: string,
): boolean => !s.ipa?.trim() || (language !== 'es' && !s.translation?.trim());
