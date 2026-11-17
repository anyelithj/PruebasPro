import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { GuideFacade } from '../../application/guide.facade';
import { sourceHref, transcript, type AnsweredBy } from '../../domain/models/help';
// [GuideChatComponent · Presentación]: chat accesible de «Soporte y Guía» — turnos en streaming, fuentes citadas, valoración, temas rápidos, escalado y borrado | [Patrón]: Container ligero (usa GuideFacade) + Observer (effect de autoscroll) | [Principio]: SRP + DIP (sin HTTP) + DRY (lo usan la página y el widget) | [Paradigma]: Declarativo + Reactivo
// [A11y]: role="log" + aria-live="polite" (el lector anuncia la respuesta) · quién habla en texto · fuentes como enlaces con nombre · valoración con aria-pressed · temas rápidos en un <nav> con nombre
// [2026-10-28 · NO es tutor]: saludo y temas rápidos PROPIOS de cada modo (cuenta, pagos, cursos, problemas técnicos) — antes saludaba con «¿Qué tema te gustaría practicar hoy?» del tutor

const ORIGIN: Record<AnsweredBy, 'fromFaq' | 'fromManual' | 'fromLlm' | null> = { faq: 'fromFaq', manual: 'fromManual', llm: 'fromLlm', none: null };
const SUPPORT_EMAIL = 'soporte@example.com'; // ponytail: mismo valor por defecto que NEXT_PUBLIC_SUPPORT_EMAIL (frontend-next/src/config/brand.ts); inyectarlo por token cuando exista uno común

@Component({
  selector: 'aula-guide-chat',
  imports: [IconComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 min-w-0 flex-col' }, // [2026-11-09]: columna flexible → el registro se desplaza por dentro y el campo queda siempre visible // [Layout]: el host es inline por defecto → sin esto el formulario se salía del recuadro del manual
  template: `
    @let t = i18n.t().help;
    <div class="flex min-h-0 flex-1 flex-col gap-3">
      @let m = t.modes[facade.mode()];
      @let a = i18n.t().assistant;
      <!-- [2026-11-09]: mismas acciones, mismo texto y mismo lugar (arriba) que en el Tutor -->
      @if (!facade.isEmpty()) {
        <div class="flex flex-wrap items-center justify-end gap-2">
          <button type="button" class="btn btn-ghost btn-sm" [disabled]="facade.streaming()" (click)="newChat()"><aula-icon name="plus" /> {{ a.newChat }}</button>
          <button type="button" class="btn btn-ghost btn-sm text-tone-danger" [disabled]="facade.streaming()" (click)="removeChat()">
            <aula-icon name="trash-2" /> {{ confirming() ? a.deleteChat + '?' : a.deleteChat }}
          </button>
        </div>
      }
      <div #scroller role="log" aria-live="polite" [attr.aria-busy]="facade.streaming()" [attr.aria-label]="t.botTitle" tabindex="0" class="min-h-40 flex-1 space-y-3 overflow-y-auto overscroll-contain rounded-xl border border-border bg-background p-3" [style.max-height]="maxHeight()">
        <!-- [Saludo · 2026-10-28]: burbuja del agente con el saludo DEL MODO (soporte / guía) | i18n ES/EN · no se envía al servidor (no se valora) -->
        <div class="flex">
          <article class="max-w-[90%] rounded-2xl bg-muted px-3 py-2 text-sm">
            <span class="mb-0.5 block text-[11px] font-bold opacity-80">Aula · {{ m.label }}</span>
            <p>{{ m.greeting }}</p>
            <p class="mt-1">{{ m.greetingFollowUp }}</p>
          </article>
        </div>
        <!-- [Temas rápidos]: chips de un clic con las dudas más comunes del modo (solo con la conversación vacía) -->
        @if (facade.isEmpty()) {
          <nav class="flex flex-wrap gap-1.5" [attr.aria-label]="t.quickRepliesLabel">
            @for (q of m.quickReplies; track q) {
              <button type="button" class="chip" [disabled]="facade.streaming()" (click)="facade.ask(q)">{{ q }}</button>
            }
          </nav>
        }
        @for (turn of facade.turns(); track $index; let i = $index) {
          <div class="flex" [class.justify-end]="turn.role === 'user'">
            <!-- [Semántica · 2026-10-23]: cada mensaje es un <article> dentro del registro (role="log") -->
            <article class="max-w-[90%] rounded-2xl px-3 py-2 text-sm" [class.bg-primary]="turn.role === 'user'" [class.text-primary-foreground]="turn.role === 'user'" [class.bg-muted]="turn.role === 'assistant'">
              <span class="mb-0.5 block text-[11px] font-bold opacity-80">{{ turn.role === 'user' ? t.you : 'Aula · ' + m.label }}</span>
              <p class="whitespace-pre-line break-words">{{ turn.content }}</p>
              <!-- [Aviso suave · 2026-10-27]: respuesta SIN IA (FAQ/manual) → role="note" (informativo, no alerta) -->
              @if (turn.role === 'assistant' && turn.degraded && !turn.offline) {
                <p role="note" class="mt-1 flex items-start gap-1 type-meta text-tone-warning"><aula-icon name="info" [size]="12" /> {{ t.degradedNotice }}</p>
              }
              @if (turn.role === 'assistant' && turn.answeredBy && origin(turn.answeredBy); as key) {
                <p class="mt-1 type-meta text-muted-foreground">{{ t[key] }}</p>
              }
              @if (turn.sources?.length) {
                <p class="mt-2 type-meta font-bold">{{ t.sources }}</p>
                <ul class="list-inside list-disc type-meta">
                  @for (s of turn.sources; track s.id) {
                    <li><a class="text-primary hover:underline" [href]="href(s)">{{ s.title }}</a></li>
                  }
                </ul>
              }
              @if (turn.role === 'assistant' && turn.content && !turn.offline && !(facade.streaming() && $last)) {
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
        <p role="alert" class="type-meta text-tone-danger">{{ err }}</p>
      }
      <form class="flex gap-2" (submit)="$event.preventDefault(); send()">
        <label for="guide-input" class="sr-only">{{ t.botTitle }}</label>
        <input id="guide-input" class="control min-w-0 flex-1" maxlength="1000" autocomplete="off" [placeholder]="m.placeholder" [value]="draft()" (input)="draft.set($any($event.target).value)" />
        <button aulaButton size="sm" type="submit" [loading]="facade.streaming()" [disabled]="draft().trim().length < 2">{{ facade.streaming() ? t.asking : t.ask }}</button>
      </form>
      <!-- [Escalado · 2026-10-28]: tras la primera respuesta → manual, FAQ y correo a soporte con la conversación (no hay tickets en la plataforma) -->
      @if (!facade.isEmpty()) {
        <footer class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" [attr.aria-label]="t.escalateTitle">
          <span class="font-semibold text-muted-foreground">{{ t.escalateTitle }}</span>
          <a class="text-primary hover:underline" href="/ayuda/manual">{{ t.escalateManual }}</a>
          <a class="text-primary hover:underline" href="/ayuda/faq">{{ t.escalateFaq }}</a>
          <a class="inline-flex items-center gap-1 font-semibold text-primary hover:underline" [href]="contactHref()"><aula-icon name="message-circle" [size]="12" /> {{ t.escalateContact }}</a>
        </footer>
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

  // [contactHref]: `mailto:` con asunto y la conversación en el cuerpo | `encodeURIComponent` (ECMAScript): sin inyección de cabeceras en el enlace
  protected readonly contactHref = computed(() => {
    const t = this.i18n.t().help;
    const body = this.i18n.fmt(t.escalateBody, { transcript: transcript(this.facade.turns(), t.you, 'Aula') });
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t.escalateSubject)}&body=${encodeURIComponent(body)}`;
  });

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
    this.confirming.set(false);
  }

  protected readonly confirming = signal(false);
  protected newChat(): void {
    this.facade.reset();
    this.confirming.set(false);
  }
  // [removeChat]: primer clic pide confirmar · segundo borra (igual que el Tutor)
  protected async removeChat(): Promise<void> {
    if (!this.confirming()) return this.confirming.set(true);
    await this.facade.clear();
    this.confirming.set(false);
  }
}
