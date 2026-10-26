import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
import { SessionService } from '@core/auth/session.service';
import { I18nService } from '@core/i18n/i18n.service';
import { AvatarSvgComponent } from '@shared/ui/atoms/avatar-svg/avatar-svg.component';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { GuideFacade } from '../../application/guide.facade';
import { BOT_MODES } from '../../domain/models/help';
import { HELP_PROVIDERS } from '../../help.routes';
import { GuideChatComponent } from './guide-chat.component';
// [GuideWidgetElement · Angular Element <aula-guia-widget>]: asistente flotante «Aula» con AVATAR y TRES MODOS — Tutor (idiomas), Soporte (problemas y cuenta) y Guía (uso de la plataforma) | [Patrón]: Container autónomo (trae sus providers) + Modal nativo + Strategy (modo → persona de FastAPI) | [Principio]: SRP + DRY (mismo GuideChatComponent que /ayuda) | [Paradigma]: Declarativo
// [2026-10-19]: antes era un botón «?» que solo abría el Agente Guía; ahora el avatar de la marca abre el asistente y se elige el modo (como el avatar de ../mi-proyecto-neuro, sin copiarlo)
// [A11y]: <dialog> con `showModal()` → foco atrapado, Escape cierra y el foco vuelve al botón · modos como radiogroup con aria-checked · [Sin sesión]: no se pinta (el agente exige JWT)
// [Responsive]: diálogo a pantalla casi completa en móvil y panel de 26rem en escritorio
// [2026-10-23]: barra de ventana — Minimizar (queda una barra acoplada abajo que conserva la conversación), Maximizar/Restaurar (panel grande) y ✕ Cerrar
// [SEO/Semántica]: <aside> para el lanzador y la barra minimizada, <header> con el <h2> y los controles, <section> para el panel de la pestaña

@Component({
  selector: 'aula-guide-widget',
  imports: [GuideChatComponent, IconComponent, AvatarSvgComponent],
  providers: HELP_PROVIDERS,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().help;
    @if (session.isAuthenticated()) {
      @if (view() === 'min') {
        <!-- [Minimizado]: barra acoplada (no modal → se puede seguir usando la página) con restaurar y cerrar -->
        <aside class="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-gradient-brand py-1.5 pl-1.5 pr-2 text-white shadow-lg" [attr.aria-label]="t.botTitle">
          <button type="button" class="flex items-center gap-2 rounded-full pr-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" [attr.aria-label]="t.botRestore" [title]="t.botRestore" (click)="open()">
            <aula-avatar-svg [size]="32" /> {{ t.botTitle }}
          </button>
          <button type="button" class="grid size-8 place-items-center rounded-full hover:bg-white/15" [attr.aria-label]="i18n.t().common.close" [title]="i18n.t().common.close" (click)="close()">
            <aula-icon name="x" [size]="16" />
          </button>
        </aside>
      } @else {
      <button
        type="button"
        class="fixed bottom-4 right-4 z-40 grid size-14 place-items-center rounded-full bg-card shadow-lg ring-2 ring-primary/40 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
        [attr.aria-label]="t.botOpen"
        [title]="t.botOpen"
        aria-haspopup="dialog"
        (click)="open()"
      >
        <aula-avatar-svg [size]="52" />
      </button>
      }
      <!-- (close): Escape o ✕ → cerrado; al minimizar el estado ya es 'min' y se respeta -->
      <dialog
        #dlg
        class="m-0 ml-auto mt-auto w-full max-w-full rounded-t-2xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-slate-900/40 sm:m-4 sm:ml-auto sm:mt-auto sm:rounded-2xl"
        [class]="max() ? 'h-[96dvh] sm:w-[min(64rem,94vw)]' : 'h-[min(88dvh,44rem)] sm:w-[26rem]'"
        aria-labelledby="guide-title"
        (close)="view() === 'open' && view.set('closed')"
      >
        <div class="flex h-full flex-col gap-3 p-4">
          <!-- [Cabecera]: avatar + nombre sobre el degradado de marca + controles de ventana -->
          <header class="-m-4 mb-0 flex items-center justify-between gap-2 rounded-t-2xl bg-gradient-brand px-4 py-3 text-white">
            <div class="flex items-center gap-2">
              <aula-avatar-svg [size]="36" />
              <h2 id="guide-title" class="text-base font-bold">{{ t.botTitle }}</h2>
            </div>
            <div class="flex items-center gap-1" role="group" [attr.aria-label]="t.botWindow">
              <button type="button" class="grid size-8 place-items-center rounded-lg text-white/90 hover:bg-white/15" [attr.aria-label]="t.botMinimize" [title]="t.botMinimize" (click)="minimize()">
                <aula-icon name="minus" [size]="18" />
              </button>
              <button type="button" class="hidden size-8 place-items-center rounded-lg text-white/90 hover:bg-white/15 sm:grid" [attr.aria-label]="max() ? t.botRestore : t.botMaximize" [title]="max() ? t.botRestore : t.botMaximize" [attr.aria-pressed]="max()" (click)="max.set(!max())">
                <aula-icon [name]="max() ? 'minimize-2' : 'maximize-2'" [size]="16" />
              </button>
              <button type="button" class="grid size-8 place-items-center rounded-lg text-white/90 hover:bg-white/15" [attr.aria-label]="i18n.t().common.close" [title]="i18n.t().common.close" (click)="close()">
                <aula-icon name="x" [size]="18" />
              </button>
            </div>
          </header>
          <!-- [Modos · 2026-10-23]: Tutor · Soporte · Guía como PESTAÑAS (Tab Headers) — antes tarjetas de radio | [A11y]: WAI-ARIA Tabs Pattern
               (role tablist/tab/tabpanel, aria-selected, tabindex itinerante y flechas ← → Inicio Fin) | cada pestaña conserva su conversación -->
          <div role="tablist" [attr.aria-label]="t.modesLabel" class="-mx-4 flex border-b border-border px-2" (keydown)="onTabKey($event)">
            @for (mode of modes; track mode) {
              <button
                type="button"
                role="tab"
                [id]="'guide-tab-' + mode"
                aria-controls="guide-panel"
                [attr.aria-selected]="guide.mode() === mode"
                [attr.tabindex]="guide.mode() === mode ? 0 : -1"
                class="-mb-px inline-flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                [class]="guide.mode() === mode ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
                (click)="guide.setMode(mode)"
              >
                <aula-icon [name]="icons[mode]" /> {{ t.modes[mode].label }}
              </button>
            }
          </div>
          <section id="guide-panel" role="tabpanel" [attr.aria-labelledby]="'guide-tab-' + guide.mode()" class="flex min-h-0 flex-1 flex-col gap-3">
            @if (guide.mode() !== 'tutor') { <!-- [2026-10-26]: el tutor abre SOLO con su saludo -->
              <p class="text-xs text-muted-foreground">{{ t.modes[guide.mode()].hint }}</p>
            }
            @if (guide.mode() === 'tutor') {
              <!-- [2026-10-25]: idioma y nivel en la MISMA fila -->
              <div class="flex flex-wrap items-center gap-3">
              <label class="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                {{ t.tutorLanguage }}
                <select class="control h-9 min-h-9 py-1 text-xs" [value]="guide.language()" (change)="guide.language.set($any($event.target).value)">
                  @for (l of languages; track l) {
                    <option [value]="l">{{ i18n.languageName(l) }}</option>
                  }
                </select>
              </label>
              <!-- [2026-10-25]: nivel MCER → el tutor adapta las reglas y los ejemplos -->
              <label class="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                {{ t.tutorLevel }}
                <select class="control h-9 min-h-9 py-1 text-xs" [value]="guide.level()" (change)="guide.level.set($any($event.target).value)">
                  @for (l of levels; track l) {
                    <option [value]="l">{{ l }}</option>
                  }
                </select>
              </label>
              </div>
            }
            <aula-guide-chat class="min-h-0 flex-1" maxHeight="none" />
          </section>
        </div>
      </dialog>
    }
  `,
})
export class GuideWidgetElement {
  protected readonly i18n = inject(I18nService);
  protected readonly session = inject(SessionService);
  protected readonly guide = inject(GuideFacade);
  protected readonly modes = BOT_MODES;
  protected readonly languages = LANGUAGES;
  protected readonly levels = CEFR_LEVELS;
  protected readonly icons = { tutor: 'graduation-cap', support: 'wrench', guide: 'compass' } as const; // [2026-10-23]: iconos SVG (antes emojis)
  // [Estado de la ventana · 2026-10-23]: closed → open ⇄ min | max = panel grande | [Patrón]: State (signals)
  protected readonly view = signal<'closed' | 'open' | 'min'>('closed');
  protected readonly max = signal(false);
  private readonly dlg = viewChild<ElementRef<HTMLDialogElement>>('dlg'); // `viewChild` (Angular 17+): referencia al <dialog>

  protected open(): void {
    this.view.set('open');
    queueMicrotask(() => this.dlg()?.nativeElement.showModal()); // Tras pintar el <dialog> (puede venir de la barra minimizada)
  }

  // [minimize]: cierra el modal pero conserva la conversación (GuideFacade) y deja la barra acoplada
  protected minimize(): void {
    this.view.set('min');
    this.dlg()?.nativeElement.close();
  }

  protected close(): void {
    this.view.set('closed');
    this.max.set(false);
    this.dlg()?.nativeElement.close();
  }

  // [onTabKey]: flechas ← → (circular), Inicio y Fin cambian de pestaña y mueven el foco (WAI-ARIA Tabs) | `KeyboardEvent` (DOM)
  protected onTabKey(e: KeyboardEvent): void {
    const i = this.modes.indexOf(this.guide.mode());
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: this.modes.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const mode = this.modes[(next + this.modes.length) % this.modes.length];
    this.guide.setMode(mode);
    queueMicrotask(() => document.getElementById('guide-tab-' + mode)?.focus()); // Tras pintar la pestaña activa
  }

  constructor() {
    void this.session.load(); // Como Angular Element (páginas de Next.js) no hay provideAuth: la sesión se carga aquí (memoizada)
  }
}
