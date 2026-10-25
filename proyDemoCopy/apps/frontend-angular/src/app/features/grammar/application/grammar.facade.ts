import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AsyncState } from '@shared/utils/async-state';
import { GrammarRepository } from '../domain/grammar.repository.port';
import type {
  ExamplePatch,
  GrammarTopic,
  SectionInput,
  TopicDetail,
  TopicFilter,
  TopicInput,
} from '../domain/models/grammar';
// [GrammarFacade · Aplicación · Sprints 10.11/10.12 · RF-133 a RF-135]: casos de uso — lista y ficha (estudiante) y edición manual o con borrador de IA (docente): secciones, ejemplos, IPA y traducción, publicar y archivar | [Patrón]: Facade + State Machine (AsyncState) + Command (`act`) | [Principio]: SRP + DIP | [Paradigma]: Reactivo (signals) + async/await

@Injectable()
export class GrammarFacade {
  private readonly repo = inject(GrammarRepository);

  readonly topics = new AsyncState<GrammarTopic[]>((l) => !l.length);
  readonly topic = new AsyncState<TopicDetail>();
  readonly showTranslation = signal(true); // [RF-134]: traducción visible por defecto
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  private async act<T>(source: Observable<T>): Promise<T | null> {
    this.busy.set(true);
    this.actionError.set(null);
    this.notice.set(null);
    try {
      return await firstValueFrom(source);
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  // [reload]: tras editar se vuelve a pedir la ficha (secciones y ejemplos en una sola respuesta) sin pasar por «cargando»
  private async reload(id: string): Promise<void> {
    const t = await this.act(this.repo.getTopic(id));
    if (t) this.topic.set(t);
  }

  loadTopics(f: TopicFilter) {
    return this.topics.run(this.repo.listTopics(f));
  }
  loadTopic(id: string) {
    return this.topic.run(this.repo.getTopic(id));
  }

  async create(input: TopicInput): Promise<GrammarTopic | null> {
    const t = await this.act(this.repo.createTopic(input));
    if (t) this.topics.set([t, ...(this.topics.data() ?? [])]);
    return t;
  }
  async draft(input: TopicInput): Promise<string | null> {
    const r = await this.act(this.repo.draft(input));
    return r?.id ?? null;
  }
  async setStatus(id: string, status: GrammarTopic['status']): Promise<boolean> {
    const t = await this.act(this.repo.updateTopic(id, { status }));
    if (t) await this.reload(id);
    return !!t;
  }
  async saveSummary(id: string, summary: string): Promise<boolean> {
    const t = await this.act(this.repo.updateTopic(id, { summary }));
    if (t) await this.reload(id);
    return !!t;
  }
  async archive(id: string): Promise<boolean> {
    const ok = (await this.act(this.repo.archiveTopic(id))) !== null;
    if (ok) this.topics.set((this.topics.data() ?? []).filter((t) => t.id !== id));
    return ok;
  }
  async enrich(id: string): Promise<number | null> {
    const r = await this.act(this.repo.enrich(id));
    if (r) await this.reload(id);
    return r?.updated ?? null;
  }
  async addSection(topicId: string, input: SectionInput): Promise<boolean> {
    const s = await this.act(this.repo.addSection(topicId, input));
    if (s) await this.reload(topicId);
    return !!s;
  }
  async updateSection(topicId: string, id: string, patch: Partial<SectionInput>): Promise<boolean> {
    const s = await this.act(this.repo.updateSection(id, patch));
    if (s) await this.reload(topicId);
    return !!s;
  }
  async removeSection(topicId: string, id: string): Promise<boolean> {
    const ok = (await this.act(this.repo.removeSection(id))) !== null;
    if (ok) await this.reload(topicId);
    return ok;
  }
  async addExample(topicId: string, sectionId: string, text: string): Promise<boolean> {
    const e = await this.act(this.repo.addExample(sectionId, text));
    if (e) await this.reload(topicId);
    return !!e;
  }
  async updateExample(topicId: string, id: string, patch: ExamplePatch): Promise<boolean> {
    const e = await this.act(this.repo.updateExample(id, patch));
    if (e) await this.reload(topicId);
    return !!e;
  }
  async removeExample(topicId: string, id: string): Promise<boolean> {
    const ok = (await this.act(this.repo.removeExample(id))) !== null;
    if (ok) await this.reload(topicId);
    return ok;
  }
}
