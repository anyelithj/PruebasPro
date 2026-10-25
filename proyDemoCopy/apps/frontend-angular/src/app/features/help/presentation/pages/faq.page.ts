import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { SessionService } from '@core/auth/session.service';
import { I18nService } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { FormFieldComponent } from '@shared/ui/molecules/form-field/form-field.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { HelpFacade } from '../../application/help.facade';
import { HELP_ROLES, type Faq, type FaqInput, type HelpRole } from '../../domain/models/help';
import { FaqFormComponent } from '../components/faq-form.component';
import { FaqListComponent } from '../components/faq-list.component';
// [FaqPage · Presentación]: /ayuda/faq y /ayuda/faq/:id — FAQ PÚBLICAS con búsqueda instantánea y filtros + gestión ADMIN (crear, editar, archivar) | [Patrón]: Container + Máquina de estados | [Principio]: SRP + DIP (fachada) + mínimo privilegio (acciones solo para ADMIN; NestJS vuelve a exigir el rol) | [Paradigma]: Declarativo + Reactivo
// [A11y]: filtros con <label>, conteo de resultados en role="status" (se anuncia al teclear) · [SEO]: un <h1>, contenido de texto indexable · [Responsive]: filtros en columna en móvil

@Component({
  selector: 'aula-faq-page',
  imports: [CardPageTemplate, FormFieldComponent, ButtonComponent, SpinnerComponent, FaqListComponent, FaqFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().help;
    <aula-card-page [heading]="t.faqTitle" [subtitle]="t.faqSubtitle">
      @if (isAdmin()) {
        <button pageActions aulaButton size="sm" type="button" (click)="openForm(null)">{{ t.newFaq }}</button>
      }
      @if (session.isAuthenticated()) {
        <a pageActions aulaButton variant="outline" size="sm" href="/ayuda/manual">{{ t.manualTitle }}</a>
      }
      <div class="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem_12rem]">
        <aula-form-field fieldId="faq-search" [label]="t.search">
          <input id="faq-search" type="search" class="control w-full" autocomplete="off" [value]="facade.query()" (input)="facade.query.set($any($event.target).value)" />
        </aula-form-field>
        <aula-form-field fieldId="faq-category-filter" [label]="t.category">
          <select id="faq-category-filter" class="control w-full" [value]="facade.category()" (change)="facade.category.set($any($event.target).value)">
            <option value="">{{ t.all }}</option>
            @for (c of facade.categories(); track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
        </aula-form-field>
        <aula-form-field fieldId="faq-role-filter" [label]="t.role">
          <select id="faq-role-filter" class="control w-full" [value]="facade.role()" (change)="setRole($any($event.target).value)">
            <option value="">{{ t.all }}</option>
            @for (r of roles; track r) {
              <option [value]="r">{{ t.roles[r] }}</option>
            }
          </select>
        </aula-form-field>
      </div>
      @if (facade.actionError(); as err) {
        <p role="alert" class="mb-3 text-sm text-tone-danger">{{ err }}</p>
      }
      @switch (facade.faqs.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <div role="alert" class="space-y-2 text-sm text-tone-danger">
            <p>{{ facade.faqs.error() }}</p>
            <button aulaButton variant="outline" size="sm" type="button" (click)="facade.loadFaqs()">{{ i18n.t().common.retry }}</button>
          </div>
        }
        @default {
          <p role="status" class="mb-2 text-xs text-muted-foreground">{{ i18n.fmt(t.results, { n: facade.visible().length }) }}</p>
          <aula-faq-list [faqs]="facade.visible()" [t]="t" [admin]="isAdmin()" [openId]="id()" [reviewedLabel]="reviewed" (edit)="openForm($event)" (archive)="archive($event)" />
        }
      }
      @if (isAdmin()) {
        <aula-faq-form [open]="formOpen()" [faq]="editing()" [locale]="i18n.locale()" [busy]="facade.saving()" [t]="t" (saved)="save($event)" (closed)="formOpen.set(false)" />
      }
    </aula-card-page>
  `,
})
export default class FaqPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(HelpFacade);
  protected readonly session = inject(SessionService);
  readonly id = input<string>(); // /ayuda/faq/:id (withComponentInputBinding) → esa pregunta se abre
  protected readonly roles = HELP_ROLES.filter((r) => r !== 'ALL');
  protected readonly isAdmin = computed(() => this.session.hasRole('ADMIN'));
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Faq | null>(null);
  // `Intl` (ECMA-402) en el idioma activo · arrow → se pasa como input sin perder `this`
  protected readonly reviewed = (iso: string) => this.i18n.fmt(this.i18n.t().help.reviewed, { date: new Date(iso).toLocaleDateString(this.i18n.intl()) });

  constructor() {
    void this.facade.loadFaqs();
  }

  protected setRole(v: string): void {
    this.facade.role.set(HELP_ROLES.find((r) => r === v) ?? ('' as HelpRole | ''));
  }

  protected openForm(faq: Faq | null): void {
    this.editing.set(faq);
    this.formOpen.set(true);
  }

  protected async save(input: FaqInput): Promise<void> {
    if (await this.facade.saveFaq(this.editing()?.id ?? null, input)) this.formOpen.set(false);
  }

  // `confirm` (DOM): confirmación nativa y accesible antes de archivar
  protected archive(faq: Faq): void {
    if (confirm(this.i18n.fmt(this.i18n.t().help.archiveConfirm, { q: faq.question }))) void this.facade.archiveFaq(faq.id);
  }
}
