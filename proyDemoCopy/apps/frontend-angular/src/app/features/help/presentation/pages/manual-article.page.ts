import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { HelpFacade } from '../../application/help.facade';
import { anchor } from '../../domain/models/help';
import { MarkdownPipe } from '../pipes/markdown.pipe';
// [ManualArticlePage · Presentación]: /ayuda/manual/:slug — artículo del manual en Markdown saneado (marked + DOMPurify) con índice de secciones | [Patrón]: Container + Máquina de estados | [Principio]: SRP + DIP + Seguridad por defecto | [Paradigma]: Declarativo + Reactivo
// [SEO/A11y]: el título del artículo es el único <h1> (el `# ` del Markdown se omite) · índice en <nav> con nombre · anclas = las que cita el Agente Guía
// [Tipografía]: utilidades Tailwind sobre el HTML generado (sin plugin extra): encabezados, listas numeradas, enlaces e imágenes adaptables

@Component({
  selector: 'aula-manual-article-page',
  imports: [
    BackLinkComponent,RouterLink, CardPageTemplate, SpinnerComponent, MarkdownPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().help;
    @switch (facade.article.status()) {
      @case ('loading') {
        <aula-spinner [label]="i18n.t().common.loading" />
      }
      @case ('error') {
        <aula-card-page [heading]="t.manualTitle">
          <div role="alert" class="space-y-2 text-sm text-tone-danger">
            <p>{{ facade.article.error() }}</p>
            <a aulaBackLink routerLink="/ayuda/manual">{{ t.backToManual }}</a>
          </div>
        </aula-card-page>
      }
      @case ('success') {
        @let a = facade.article.data()!;
        <aula-card-page [heading]="a.title" [subtitle]="t.roles[a.role]">
          <a aulaBackLink pageBack routerLink="/ayuda/manual">{{ t.backToManual }}</a>
          @if (sections().length) {
            <nav [attr.aria-label]="t.toc" class="mb-4 rounded-xl bg-muted/40 p-3 text-sm">
              <p class="mb-1 font-semibold">{{ t.toc }}</p>
              <ol class="list-inside list-decimal space-y-0.5">
                @for (s of sections(); track s) {
                  <li><a class="text-primary hover:underline" [routerLink]="[]" [fragment]="anchor(s)">{{ s }}</a></li>
                }
              </ol>
            </nav>
          }
          <article
            class="space-y-3 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_h2]:mt-6 [&_h2]:scroll-mt-20 [&_h2]:text-lg [&_h2]:font-bold [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
            [innerHTML]="body() | aulaMarkdown"
          ></article>
        </aula-card-page>
      }
    }
  `,
})
export default class ManualArticlePage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(HelpFacade);
  readonly slug = input<string>(); // /ayuda/manual/:slug (withComponentInputBinding) · opcional: el router lo da siempre, las pruebas lo fijan después
  protected readonly anchor = anchor;
  // [body]: sin el `# Título` inicial (ya es el <h1> de la plantilla) → un solo h1 por página
  protected readonly body = computed(() => (this.facade.article.data()?.body ?? '').replace(/^#\s+.+\r?\n?/, ''));
  protected readonly sections = computed(() => [...this.body().matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1]));

  constructor() {
    // `effect`: cambiar de artículo (o de idioma) recarga
    effect(() => {
      const slug = this.slug();
      this.i18n.locale();
      if (slug) void this.facade.loadArticle(slug);
    });
  }
}
