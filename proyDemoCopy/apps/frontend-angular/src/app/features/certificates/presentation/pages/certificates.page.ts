import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CEFR_LEVELS } from '@aula/shared-schemas';
import { explorerTxUrl } from '@core/web3/chains';
import { I18nService } from '@core/i18n/i18n.service';
import { BadgeComponent } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { LevelTintDirective } from '@shared/ui/atoms/level-tint/level-tint.directive';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { CertificatesFacade } from '../../application/certificates.facade';
import type { Certificate } from '../../domain/models/certificates';
// [CertificatesPage · Presentación]: /certificados — cifras, filtro por nivel MCER, cursos listos para certificar («Solicitar») y tarjetas-diploma teñidas con el color de su nivel (código, anclaje en Sepolia y PDF) | [Patrón]: Container + Máquina de estados + Lookup Table (color por nivel vía [aulaLevel]) | [Principio]: SRP + DIP (fachada) + DRY (LevelTint, Badge y explorerTxUrl compartidos) | [Paradigma]: Declarativo + Reactivo
// [Diseño]: inspirado en «Mis Certificados» de NeuroLearning (cabecera degradada por tipo → aquí por nivel A1–C2), sin copiarlo · [A11y]: nivel y estado siempre en texto (no solo color), filtros con aria-pressed, lista semántica, botones con el nombre del curso · [Responsive]: 1 columna en móvil, 2 desde sm, 3 desde lg

@Component({
  selector: 'aula-certificates-page',
  imports: [
    CardPageTemplate,
    BadgeComponent,
    ButtonComponent,
    IconComponent,
    LevelTintDirective,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().certificates;
    <aula-card-page [heading]="t.title" [subtitle]="t.subtitle">
      <a pageActions aulaButton variant="outline" size="sm" href="/verificar">{{
        t.verifyTitle
      }}</a>
      @if (facade.actionError(); as err) {
        <p role="alert" class="mb-3 text-sm text-tone-danger">{{ err }}</p>
      }
      @switch (facade.mine.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <div role="alert" class="space-y-2 text-sm text-tone-danger">
            <p>{{ facade.mine.error() }}</p>
            <button aulaButton variant="outline" size="sm" type="button" (click)="facade.load()">
              {{ i18n.t().common.retry }}
            </button>
          </div>
        }
        @case ('empty') {
          <p class="text-sm text-muted-foreground">{{ t.empty }}</p>
        }
        @default {
          @let data = facade.mine.data();
          <!-- [Cifras]: total, anclados en Sepolia y listos para solicitar -->
          <dl class="mb-5 grid grid-cols-3 gap-2 text-center">
            @for (s of stats(); track s.label) {
              <div class="rounded-xl border border-border bg-muted/40 px-2 py-2">
                <dt class="text-[11px] text-muted-foreground">{{ s.label }}</dt>
                <dd class="text-xl font-extrabold">{{ s.value }}</dd>
              </div>
            }
          </dl>

          <!-- [Listos]: cursos al 100 % sin certificado → un botón por curso -->
          @if (data?.eligible?.length) {
            <section aria-labelledby="cert-ready" class="mb-6 space-y-2">
              <h2 id="cert-ready" class="text-base font-bold">{{ t.ready }}</h2>
              <ul class="grid gap-2 sm:grid-cols-2">
                @for (c of data!.eligible; track c.courseId) {
                  <li
                    class="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/40 p-3 text-sm"
                  >
                    <span class="flex min-w-0 items-center gap-2 font-semibold" [title]="c.title">
                      <aula-icon name="award" [size]="16" />
                      <span class="truncate">{{ c.title }}</span>
                    </span>
                    <button
                      aulaButton
                      size="sm"
                      type="button"
                      [loading]="facade.issuing() === c.courseId"
                      [disabled]="!!facade.issuing()"
                      [attr.aria-label]="t.request + ': ' + c.title"
                      (click)="facade.request(c.courseId)"
                    >
                      {{ t.request }}
                    </button>
                  </li>
                }
              </ul>
            </section>
          }

          <section aria-labelledby="cert-issued" class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 id="cert-issued" class="text-base font-bold">{{ t.issued }}</h2>
              <!-- [Filtro por nivel]: solo aparecen los niveles que el alumno tiene -->
              @if (levels().length > 1) {
                <div class="flex flex-wrap gap-1.5" role="group" [attr.aria-label]="t.level">
                  @for (l of levels(); track l) {
                    <button
                      type="button"
                      [aulaLevel]="l === 'all' ? null : l"
                      class="rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
                      [class]="
                        filter() === l
                          ? 'border-transparent bg-(--lvl-deep) text-white'
                          : 'border-border text-muted-foreground hover:border-(--lvl)'
                      "
                      [attr.aria-pressed]="filter() === l"
                      (click)="filter.set(l)"
                    >
                      {{ l === 'all' ? t.all : l === 'none' ? t.general : l }}
                    </button>
                  }
                </div>
              }
            </div>

            @if (visible().length) {
              <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                @for (c of visible(); track c.id) {
                  <li
                    [aulaLevel]="c.cefrLevel"
                    class="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition motion-safe:hover:-translate-y-1 hover:shadow-lg hover:border-(--lvl)"
                  >
                    <!-- [Cabecera-diploma]: degradado del color profundo al acento del nivel, texto blanco -->
                    <div class="relative bg-linear-135 from-(--lvl-deep) to-(--lvl) p-4 text-white">
                      <div
                        class="flex items-center justify-between gap-2 text-[10px] font-bold tracking-widest uppercase opacity-85"
                      >
                        <span>{{ t.certificate }}</span>
                        <span class="rounded-full bg-white/20 px-2 py-0.5 tracking-normal">{{
                          levelLabel(c)
                        }}</span>
                      </div>
                      <h3 class="mt-2 line-clamp-2 text-sm leading-snug font-bold">
                        {{ c.courseTitle }}
                      </h3>
                      <p class="text-xs opacity-80">{{ c.recipientName }}</p>
                      <div class="mt-3 flex items-end justify-between gap-3">
                        <span>
                          <span
                            class="block text-3xl leading-none font-extrabold"
                            aria-hidden="true"
                            >{{ c.cefrLevel ?? '★' }}</span
                          >
                          <span class="mt-1 block text-[11px] leading-tight opacity-85">
                            <time [attr.datetime]="c.issuedAt">{{ date(c.issuedAt) }}</time> ·
                            {{ t.date }}
                          </span>
                        </span>
                        <!-- [QR]: SVG de NestJS (librería qrcode) con el color del nivel · enlaza a la verificación pública -->
                        <a
                          [href]="'/verificar/' + c.code"
                          class="shrink-0 rounded-lg bg-white p-1 shadow-sm ring-2 ring-white/40"
                        >
                          <img
                            [src]="facade.qrUrl(c.code)"
                            width="64"
                            height="64"
                            loading="lazy"
                            [alt]="t.qrAlt + ' ' + c.code"
                            class="block size-16"
                          />
                        </a>
                      </div>
                    </div>

                    <!-- [Sellos]: estado y anclaje con texto -->
                    <div
                      class="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5 text-xs"
                    >
                      <aula-badge
                        [tone]="c.status === 'issued' ? 'info' : 'danger'"
                        [icon]="c.status === 'issued' ? 'check' : 'x'"
                        >{{ t.status[c.status] }}</aula-badge
                      >
                      @if (c.anchorTxHash) {
                        <a
                          class="font-semibold text-primary hover:underline"
                          [href]="explorer(c.anchorTxHash)"
                          target="_blank"
                          rel="noopener noreferrer"
                          >◎ {{ t.anchored }}</a
                        >
                      } @else {
                        <span class="text-muted-foreground">{{ t.notAnchored }}</span>
                      }
                      <a
                        class="eeg-mono ml-auto text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                        [href]="'/verificar/' + c.code"
                        [attr.aria-label]="t.code + ' ' + c.code"
                        >{{ c.code }}</a
                      >
                    </div>

                    <div class="mt-auto flex flex-wrap gap-2 p-3">
                      <a aulaButton size="sm" [href]="'/verificar/' + c.code" class="flex-1">{{
                        t.viewDiploma
                      }}</a>
                      <a
                        aulaButton
                        variant="outline"
                        size="sm"
                        [href]="facade.pdfUrl(c.id)"
                        download
                        [attr.aria-label]="t.download + ' ' + c.code"
                      >
                        <aula-icon name="download" [size]="14" />
                        {{ t.pdf }}
                      </a>
                    </div>
                  </li>
                }
              </ul>
            } @else {
              <p class="text-sm text-muted-foreground">{{ t.noIssued }}</p>
            }
          </section>
        }
      }
    </aula-card-page>
  `,
})
export default class CertificatesPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(CertificatesFacade);
  protected readonly explorer = explorerTxUrl;
  protected readonly filter = signal<string>('all'); // 'all' | 'none' (sin nivel) | 'A1'…'C2'

  private readonly items = computed(() => this.facade.mine.data()?.items ?? []);
  private readonly key = (c: Certificate) => c.cefrLevel ?? 'none';

  // [levels]: 'all' + niveles presentes en orden MCER (A1 → C2) + 'none' al final
  protected readonly levels = computed(() => {
    const present = new Set(this.items().map(this.key));
    return ['all', ...[...CEFR_LEVELS, 'none'].filter((l) => present.has(l))];
  });
  protected readonly visible = computed(() =>
    this.filter() === 'all'
      ? this.items()
      : this.items().filter((c) => this.key(c) === this.filter()),
  );

  protected readonly stats = computed(() => {
    const t = this.i18n.t().certificates;
    const items = this.items();
    return [
      { label: t.total, value: items.length },
      { label: t.anchoredCount, value: items.filter((c) => c.anchorTxHash).length },
      { label: t.readyCount, value: this.facade.mine.data()?.eligible.length ?? 0 },
    ];
  });

  constructor() {
    void this.facade.load();
  }

  protected levelLabel(c: Certificate): string {
    const t = this.i18n.t().certificates;
    return c.cefrLevel ? `${t.level} ${c.cefrLevel}` : t.general;
  }

  protected date(iso: string): string {
    return new Date(iso).toLocaleDateString(this.i18n.intl());
  }
}
