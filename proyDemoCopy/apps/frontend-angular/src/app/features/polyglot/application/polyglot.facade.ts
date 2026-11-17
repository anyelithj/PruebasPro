import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import type { Language } from '@aula/shared-schemas';
import { AsyncState } from '@shared/utils/async-state';
import { DEFAULT_ORDER, move, reorder, toggle } from '../domain/language-order';
import { PolyglotRepository } from '../domain/polyglot.repository.port';
import type {
  ComparisonTable,
  ConceptInput,
  TermInput,
  Topic,
  TopicInput,
} from '../domain/models/polyglot';
// [PolyglotFacade · Aplicación · Sprints 10.7/10.8 · RF-129 a RF-132]: casos de uso — tema e idiomas elegidos (orden de columnas en el navegador), tabla y administración (2026-11-14: sin comparaciones guardadas en la vista del estudiante) (temas, conceptos, términos, borrador con IA e IPA) | [Patrón]: Facade + State Machine (AsyncState) + Command (`act`) | [Principio]: SRP + DIP + DRY (language-order puro) | [Paradigma]: Reactivo (signals) + async/await

@Injectable()
export class PolyglotFacade {
  private readonly repo = inject(PolyglotRepository);

  readonly topics = new AsyncState<Topic[]>((l) => !l.length);
  readonly table = new AsyncState<ComparisonTable>((t) => !t.rows.length);
  readonly topicId = signal<string | null>(null);
  readonly languages = signal<Language[]>([...DEFAULT_ORDER]);
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly notice = signal<string | null>(null); // Resultado de la última acción («Comparación guardada»)

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

  // ── Tabla del estudiante ──
  // `preferred` (2026-10-31): tema del enlace (?tema=) → «Probar» abre ESE tema | si no existe o el usuario no puede verlo, el primero
  async loadTopics(preferred?: string | null): Promise<void> {
    const list = await this.topics.run(this.repo.listTopics());
    if (list?.length && !this.topicId()) this.selectTopic(list.some((t) => t.id === preferred) ? preferred! : list[0].id); // Primer tema por defecto
  }
  selectTopic(id: string): void {
    this.topicId.set(id);
    void this.loadTable();
  }
  loadTable(): Promise<ComparisonTable | null> {
    const id = this.topicId();
    return id ? this.table.run(this.repo.table(id, this.languages())) : Promise.resolve(null);
  }

  // [Idiomas]: cambiar el orden NO pide la tabla otra vez si los idiomas son los mismos (las celdas ya están) · agregar uno sí
  toggleLanguage(lang: Language): void {
    const before = this.languages();
    this.languages.set(toggle(before, lang));
    if (this.languages().length > before.length) void this.loadTable();
  }
  moveLanguage(lang: Language, delta: -1 | 1): void {
    this.languages.update((o) => move(o, lang, delta));
  }
  dropLanguage(from: number, to: number): void {
    this.languages.update((o) => reorder(o, from, to));
  }
  restoreOrder(): void {
    const had = new Set(this.languages());
    this.languages.set([...DEFAULT_ORDER]);
    if (DEFAULT_ORDER.some((l) => !had.has(l))) void this.loadTable();
  }

  // ── Administración (DOCENTE / ADMIN) ──
  async createTopic(input: TopicInput): Promise<Topic | null> {
    const t = await this.act(this.repo.createTopic(input));
    if (t) this.topics.set([...(this.topics.data() ?? []), t]);
    return t;
  }
  async setStatus(id: string, status: Topic['status']): Promise<boolean> {
    const t = await this.act(this.repo.updateTopic(id, { status }));
    if (t) this.topics.set((this.topics.data() ?? []).map((x) => (x.id === id ? { ...x, status } : x)));
    return !!t;
  }
  async archiveTopic(id: string): Promise<boolean> {
    const ok = (await this.act(this.repo.archiveTopic(id))) !== null;
    if (ok) this.topics.set((this.topics.data() ?? []).filter((t) => t.id !== id));
    return ok;
  }
  async draft(kind: 'word' | 'phrase', count: number): Promise<number | null> {
    const id = this.topicId();
    if (!id) return null;
    const r = await this.act(this.repo.draft(id, { kind, count }));
    if (r) await this.loadTable();
    return r?.added ?? null;
  }
  async enrich(): Promise<number | null> {
    const id = this.topicId();
    if (!id) return null;
    const r = await this.act(this.repo.enrich(id));
    if (r) await this.loadTable();
    return r?.updated ?? null;
  }
  async addConcept(input: ConceptInput, terms: TermInput[]): Promise<boolean> {
    const id = this.topicId();
    if (!id) return false;
    const c = await this.act(this.repo.addConcept(id, input));
    if (c && terms.length) await this.act(this.repo.upsertTerms(c.id, terms));
    if (c) await this.loadTable();
    return !!c;
  }
  // [updateConcept · 2026-11-03]: «Editar» de una fila → emoji y significado (PATCH /polyglot/concepts/:id) + términos cambiados en una sola recarga de la tabla
  async updateConcept(id: string, patch: Partial<ConceptInput>, terms: TermInput[]): Promise<boolean> {
    const c = await this.act(this.repo.updateConcept(id, patch));
    if (c && terms.length) await this.act(this.repo.upsertTerms(id, terms));
    if (c) await this.loadTable();
    return !!c;
  }
  async saveTerms(conceptId: string, terms: TermInput[]): Promise<boolean> {
    const r = await this.act(this.repo.upsertTerms(conceptId, terms));
    if (r) await this.loadTable();
    return !!r;
  }
  async reviewTerm(id: string, patch: { text?: string; ipa?: string; ipaUs?: string }): Promise<boolean> {
    const r = await this.act(this.repo.reviewTerm(id, patch));
    if (r) await this.loadTable();
    return !!r;
  }
  async removeConcept(id: string): Promise<boolean> {
    const ok = (await this.act(this.repo.removeConcept(id))) !== null;
    if (ok) await this.loadTable();
    return ok;
  }
}
