import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { GuideFacade } from '../../application/guide.facade';
import { sourceHref, type AnsweredBy } from '../../domain/models/help';
// [GuideChatComponent · Presentación]: chat accesible del Agente Guía — turnos en streaming, fuentes citadas, valoración y borrado | [Patrón]: Container ligero (usa GuideFacade) + Observer (effect de autoscroll) | [Principio]: SRP + DIP (sin HTTP) + DRY (lo usan la página y el widget) | [Paradigma]: Declarativo + Reactivo
// [A11y]: role="log" + aria-live="polite" (el lector anuncia la respuesta) · quién habla en texto · fuentes como enlaces con nombre · valoración con aria-pressed

const ORIGIN: Record<AnsweredBy, 'fromFaq' | 'fromManual' | 'fromLlm' | null> = { faq: 'fromFaq', manual: 'fromManual', llm: 'fromLlm', none: null };

@Component({
  selector: 'aula-guide-chat',
  imports: [IconComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' }, // [Layout]: el host es inline por defecto → sin esto el formulario se salía del recuadro del manual
  template: `
    @let t = i18n.t().help;
    <div class="flex h-full flex-col gap-3">
      @let m = t.modes[facade.mode()];
      <!-- [2026-10-19]: la presentación y el ejemplo cambian con el modo (Tutor · Soporte · Guía) -->
      <p class="text-xs text-muted-foreground">{{ m.intro }}</p>
      <div #scroller role="log" aria-live="polite" [attr.aria-busy]="facade.streaming()" [attr.aria-label]="t.guideTitle" tabindex="0" class="min-h-40 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border bg-background p-3" [style.max-height]="maxHeight()">
        @for (turn of facade.turns(); track $index; let i = $index) {
          <div class="flex" [class.justify-end]="turn.role === 'user'">
            <!-- [Semántica · 2026-10-23]: cada mensaje es un <article> dentro del registro (role="log") -->
            <article class="max-w-[90%] rounded-2xl px-3 py-2 text-sm" [class.bg-primary]="turn.role === 'user'" [class.text-primary-foreground]="turn.role === 'user'" [class.bg-muted]="turn.role === 'assistant'">
              <span class="mb-0.5 block text-[11px] font-bold opacity-80">{{ turn.role === 'user' ? t.you : 'Aula · ' + m.label }}</span>
              <p class="whitespace-pre-line">{{ turn.content }}</p>
              @if (turn.role === 'assistant' && turn.answeredBy && origin(turn.answeredBy); as key) {
                <p class="mt-1 text-[11px] text-muted-foreground">{{ t[key] }}</p>
              }
              @if (turn.sources?.length) {
                <p class="mt-2 text-[11px] font-bold">{{ t.sources }}</p>
                <ul class="list-inside list-disc text-xs">
                  @for (s of turn.sources; track s.id) {
                    <li><a class="text-primary hover:underline" [href]="href(s)">{{ s.title }}</a></li>
                  }
                </ul>
              }
              @if (turn.role === 'assistant' && turn.content && !(facade.streaming() && $last)) {
                <div class="mt-2 flex items-center gap-1">
                  @if (turn.rating === undefined) {
                    <button type="button" class="rounded px-2 py-0.5 text-xs hover:bg-background" [attr.aria-pressed]="false" (click)="facade.rate(i, true)"><aula-icon name="thumbs-up" /> {{ t.helpful }}</button>
                    <button type="button" class="rounded px-2 py-0.5 text-xs hover:bg-background" [attr.aria-pressed]="false" (click)="facade.rate(i, false)"><aula-icon name="thumbs-down" /> {{ t.notHelpful }}</button>
                  } @else {
                    <span class="text-[11px] text-muted-foreground" role="status">{{ t.thanks }}</span>
                  }
                </div>
              }
            </article>
          </div>
        }
      </div>
      @if (facade.error(); as err) {
        <p role="alert" class="text-xs text-tone-danger">{{ err }}</p>
      }
      <form class="flex gap-2" (submit)="$event.preventDefault(); send()">
        <label for="guide-input" class="sr-only">{{ t.guideTitle }}</label>
        <input id="guide-input" class="control min-w-0 flex-1" maxlength="1000" autocomplete="off" [placeholder]="m.placeholder" [value]="draft()" (input)="draft.set($any($event.target).value)" />
        <button aulaButton size="sm" type="submit" [loading]="facade.streaming()" [disabled]="draft().trim().length < 2">{{ facade.streaming() ? t.asking : t.ask }}</button>
      </form>
      @if (!facade.isEmpty()) {
        <button type="button" class="self-start text-xs text-muted-foreground hover:underline" (click)="facade.clear()">{{ t.clear }}</button>
      }
    </div>
  `,
})
export class GuideChatComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(GuideFacade);
  readonly maxHeight = input('min(55dvh, 28rem)');
  protected readonly draft = signal('');
  protected readonly href = sourceHref;
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  constructor() {
    // `effect`: cada token nuevo baja el scroll al final
    effect(() => {
      this.facade.turns();
      const el = this.scroller().nativeElement;
      queueMicrotask(() => (el.scrollTop = el.scrollHeight));
    });
  }

  protected origin(by: AnsweredBy) {
    return ORIGIN[by];
  }

  protected send(): void {
    this.facade.ask(this.draft());
    this.draft.set('');
  }
}
