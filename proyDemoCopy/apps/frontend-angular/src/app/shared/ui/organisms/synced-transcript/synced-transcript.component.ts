import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { AccentSwitchComponent } from '@shared/ui/molecules/accent-switch/accent-switch.component';
import { TranscriptLineComponent } from '@shared/ui/molecules/transcript-line/transcript-line.component';
import type { TranscriptLine } from './transcript-line.model';
// [SyncedTranscriptComponent · Organismo · Sprint 9.7 · RF-117/RF-119/RF-123/RF-124]: texto original con IPA a un lado y traducción al español al otro, con la línea que suena resaltada y desplazada a la vista | [Patrón]: Atomic Design (organismo) + Observer (línea actual por input) | [Principio]: DRY (canciones, diálogos y conversación) + SRP (calcular la línea es de CurrentLineService) | [Paradigma]: Declarativo + Reactivo
// [Reglas]: contenido en español → sin columna de traducción · inglés → interruptor UK/US (aula:accent-changed); otros idiomas, un solo IPA · el seguimiento automático se puede desactivar (WCAG 2.2.2)

export interface TranscriptLabels {
  original: string;
  translation: string;
  follow: string; // «Seguir la línea que suena»
}

@Component({
  selector: 'aula-synced-transcript',
  imports: [TranscriptLineComponent, AccentSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div
        class="hidden flex-1 grid-cols-2 gap-6 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground md:grid"
      >
        <span>{{ labels().original }}</span>
        @if (showTranslation()) {
          <span>{{ labels().translation }}</span>
        }
      </div>
      <div class="flex items-center gap-3">
        <label class="flex min-h-11 items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            class="size-4 accent-violet-600"
            [checked]="follow()"
            (change)="followChange.emit($any($event.target).checked)"
          />
          {{ labels().follow }}
        </label>
        @if (language() === 'en') {
          <aula-accent-switch />
        }
      </div>
    </div>
    <ol
      class="max-h-[28rem] space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-2"
      [attr.aria-label]="labels().original"
    >
      @for (l of lines(); track l.id; let i = $index) {
        <li [attr.data-line]="i">
          <aula-transcript-line
            [line]="l"
            [language]="language()"
            [accent]="speech.accent()"
            [current]="i === current()"
            [progress]="i === current() ? progress() : null"
            [showTranslation]="showTranslation()"
            [seekable]="seekable()"
            (seek)="seek.emit(i)"
          />
        </li>
      }
    </ol>
  `,
})
export class SyncedTranscriptComponent {
  protected readonly speech = inject(SpeechSynthesisService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly lines = input.required<readonly TranscriptLine[]>();
  readonly language = input('en');
  readonly current = input(-1);
  readonly progress = input<number | null>(null); // [2026-10-23]: avance dentro de la línea actual → marcador de karaoke
  readonly follow = input(true);
  readonly seekable = input(false); // true si hay audio con tiempos (clic → saltar a la línea)
  readonly labels = input.required<TranscriptLabels>();
  readonly seek = output<number>();
  readonly followChange = output<boolean>();
  protected readonly showTranslation = computed(() => this.language() !== 'es');

  constructor() {
    // `afterRenderEffect` (Angular 19+): tras pintar, centra la línea actual en su lista (sin mover la página entera)
    afterRenderEffect(() => {
      const i = this.current();
      if (!this.follow() || i < 0) return;
      const row = this.host.nativeElement.querySelector<HTMLElement>(`[data-line="${i}"]`);
      row?.scrollIntoView?.({
        block: 'nearest',
        behavior: matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
  }
}
