import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackgroundTasks } from '../../../../shared/background/background-tasks';
import { GrammarExample } from '../../domain/entities/grammar-example.entity';
import type { ExampleBody } from '../dtos/grammar.dto';
import { EnrichExampleUseCase } from './enrich-example.use-case';
import { type GrammarActor, GrammarAccess } from './list-sections.use-case';
// [UseCase AddExample · Sprint 10.9 · RF-134]: agrega un ejemplo a la sección y obtiene su IPA y su traducción al español | [Patrón]: Use Case (Command) | [Principio]: SRP + DRY (EnrichExample) | [Paradigma]: POO + async/await
// [2026-10-27 · Rendimiento]: `defer` (alta de una ficha con varios ejemplos) → se guarda y responde al instante; la IPA/traducción de TODOS los ejemplos diferidos de la ficha
// se piden juntos en UNA llamada en segundo plano (BackgroundTasks, clave por ficha). Antes: una llamada al LLM por ejemplo, en serie, + otra para la ficha entera (los traducía dos veces)
// y la ruta caía a los 30 s del TimeoutInterceptor → «Parte del contenido no se guardó» | [Patrón]: Fire-and-Forget + Coalescing + Batch | [Principio]: Fail-soft (si falla, «Completar IPA» en el editor)

@Injectable()
export class AddExampleUseCase {
  constructor(
    private readonly access: GrammarAccess,
    @InjectRepository(GrammarExample)
    private readonly examples: Repository<GrammarExample>,
    private readonly enrich: EnrichExampleUseCase,
    private readonly background: BackgroundTasks, // [DI · 2026-10-27]: cola global en segundo plano (@Global)
  ) {}

  // `Map<ficha, Set<ejemplo>>` (ES2015): ejemplos diferidos aún sin enviar a FastAPI → la tarea de la ficha los drena todos de una vez
  private readonly deferred = new Map<string, Set<string>>();

  async execute(
    actor: GrammarActor,
    sectionId: string,
    body: ExampleBody,
    token: string,
    defer = false, // [2026-10-27]: `true` → IPA/traducción en segundo plano (la respuesta llega sin ellas)
  ): Promise<GrammarExample> {
    const section = await this.access.section(sectionId);
    const topic = await this.access.editable(actor, section.topicId);
    const last = await this.examples.findOne({
      where: { sectionId },
      order: { position: 'DESC' },
    });
    const saved = await this.examples.save(
      this.examples.create({
        sectionId,
        text: body.text,
        position: body.position ?? (last ? last.position + 1 : 0),
        ipa: '',
        ipaUs: null,
        translation: null,
        reviewed: false,
      }),
    );
    if (defer) {
      this.later(topic.id, saved.id, topic.language ?? 'en', token);
      return saved;
    }
    await this.enrich.execute([saved.id], topic.language ?? 'en', token);
    return (await this.examples.findOneBy({ id: saved.id })) ?? saved;
  }

  // [later]: acumula el ejemplo y programa (o reprograma) la tarea de su ficha → N ejemplos = 1 lote a /language-tools/lines
  private later(topicId: string, exampleId: string, language: string, token: string): void {
    const ids = this.deferred.get(topicId) ?? new Set<string>();
    ids.add(exampleId);
    this.deferred.set(topicId, ids);
    this.background.schedule(`grammar:${topicId}`, async () => {
      const batch = [...(this.deferred.get(topicId) ?? [])]; // `[...set]` (ES2015): copia; los que lleguen durante la llamada esperan a la siguiente ejecución
      this.deferred.delete(topicId);
      if (batch.length) await this.enrich.execute(batch, language, token); // Nunca lanza: degrada a «sin IPA»
    });
  }
}
