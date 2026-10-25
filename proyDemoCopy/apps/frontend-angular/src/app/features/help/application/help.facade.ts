import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { I18nService } from '@core/i18n/i18n.service';
import { AsyncState } from '@shared/utils/async-state';
import { HelpRepository } from '../domain/help.repository.port';
import { filterFaqs, type Faq, type FaqInput, type HelpRole, type ManualArticle, type ManualEntry, type ReindexResult } from '../domain/models/help';
// [HelpFacade · Aplicación]: casos de uso «FAQ (buscar, filtrar, crear, editar, archivar)», «manual por rol», «artículo» y «reindexar» (ADMIN) | [Patrón]: Facade + State Machine (AsyncState) + Derived State (computed) | [Principio]: SRP + DIP | [Paradigma]: Reactivo (signals) + async/await
// [UX]: la búsqueda filtra en el cliente al teclear (sin peticiones por letra) · tras guardar se relee la lista con el estado real del backend

@Injectable()
export class HelpFacade {
  private readonly repo = inject(HelpRepository);
  private readonly i18n = inject(I18nService);

  readonly faqs = new AsyncState<Faq[]>((rows) => rows.length === 0);
  readonly query = signal('');
  readonly category = signal('');
  readonly role = signal<HelpRole | ''>('');
  // `computed`: lista visible y categorías disponibles se recalculan solo cuando cambian sus fuentes
  readonly visible = computed(() => filterFaqs(this.faqs.data() ?? [], { q: this.query(), category: this.category(), role: this.role() }));
  readonly categories = computed(() => [...new Set((this.faqs.data() ?? []).map((f) => f.category))].sort());

  readonly manual = new AsyncState<ManualEntry[]>((rows) => rows.length === 0);
  readonly article = new AsyncState<ManualArticle>();
  readonly saving = signal(false);
  readonly reindexing = signal(false);
  readonly reindexResult = signal<ReindexResult | null>(null);
  readonly actionError = signal<string | null>(null);

  loadFaqs(): Promise<Faq[] | null> {
    return this.faqs.run(this.repo.faqs(this.i18n.locale()));
  }

  loadManual(): Promise<ManualEntry[] | null> {
    return this.manual.run(this.repo.manual(this.i18n.locale()));
  }

  loadArticle(slug: string): Promise<ManualArticle | null> {
    return this.article.run(this.repo.article(slug, this.i18n.locale()));
  }

  // [saveFaq]: id null = crear · si no, editar | devuelve true para que el formulario se cierre
  saveFaq(id: string | null, input: FaqInput): Promise<boolean> {
    return this.act(this.saving, async () => {
      await firstValueFrom(id ? this.repo.updateFaq(id, input) : this.repo.createFaq(input));
      await this.loadFaqs();
    });
  }

  archiveFaq(id: string): Promise<boolean> {
    return this.act(this.saving, async () => {
      await firstValueFrom(this.repo.archiveFaq(id));
      this.faqs.set((this.faqs.data() ?? []).filter((f) => f.id !== id)); // Archivada = deja de verse
    });
  }

  reindex(): Promise<boolean> {
    return this.act(this.reindexing, async () => {
      this.reindexResult.set(await firstValueFrom(this.repo.reindex()));
      await this.loadManual();
    });
  }

  // [act]: plantilla común de las acciones (bandera de ocupado + error visible) | [Patrón]: Template Method · [Principio]: DRY
  private async act(busy: { set(v: boolean): void }, run: () => Promise<void>): Promise<boolean> {
    busy.set(true);
    this.actionError.set(null);
    try {
      await run();
      return true;
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      busy.set(false);
    }
  }
}
