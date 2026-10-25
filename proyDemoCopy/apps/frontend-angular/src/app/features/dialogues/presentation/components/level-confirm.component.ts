import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { CEFR_LEVELS } from '@aula/shared-schemas';
import type { LevelEstimate } from '../../domain/models/dialogues';
// [LevelConfirmComponent · Presentacional · Sprint 9.13 · RF-126]: nivel estimado por FastAPI con sus indicadores medidos y el método; el docente confirma o cambia | [Patrón]: Presentational Component | [Principio]: verificación humana + transparencia (se ve por qué) | [Paradigma]: Declarativo + Reactivo

export interface LevelConfirmLabels {
  title: string;
  estimated: string;
  method: Record<'measures' | 'rubric', string>;
  indicators: Record<string, string>;
  note: string;
  choose: string;
  confirm: string;
  confirmed: string;
  unavailable: string;
}

@Component({
  selector: 'aula-level-confirm',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let lb = labels();
    <section
      class="space-y-3 rounded-xl border border-border p-4"
      aria-labelledby="level-confirm-title"
    >
      <h2 id="level-confirm-title" class="text-base font-extrabold">{{ lb.title }}</h2>
      @if (estimate(); as e) {
        <p class="text-sm font-semibold">
          {{ lb.estimated.replace('{level}', e.level).replace('{pct}', pct(e.confidence)) }}
        </p>
        <p class="text-xs text-muted-foreground">
          {{ lb.method[e.method] }}{{ e.explanation ? ' · ' + e.explanation : '' }}
        </p>
        <dl class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
          @for (k of keys(e); track k) {
            <div class="rounded-lg bg-muted p-2">
              <dt class="text-muted-foreground">{{ lb.indicators[k] ?? k }}</dt>
              <dd class="font-mono font-bold tabular-nums">{{ e.indicators[k] }}</dd>
            </div>
          }
        </dl>
      } @else {
        <p class="text-sm text-tone-warning"><aula-icon name="triangle-alert" /> {{ lb.unavailable }}</p>
      }
      <p class="text-xs text-muted-foreground">{{ lb.note }}</p>
      @if (confirmed()) {
        <p class="text-sm font-semibold text-tone-brand" role="status">✓ {{ lb.confirmed }}</p>
      } @else {
        <div class="flex flex-wrap items-end gap-2">
          <label class="text-xs font-semibold text-muted-foreground">
            {{ lb.choose }}
            <select
              class="control mt-1 w-28"
              [value]="choice()"
              (change)="choice.set($any($event.target).value)"
            >
              @for (l of levels; track l) {
                <option [value]="l">{{ l }}</option>
              }
            </select>
          </label>
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="busy()"
            (click)="confirm.emit(choice())"
          >
            ✓ {{ lb.confirm }}
          </button>
        </div>
      }
    </section>
  `,
})
export class LevelConfirmComponent {
  readonly estimate = input<LevelEstimate | null>(null);
  readonly current = input<string | null>(null);
  readonly confirmed = input(false);
  readonly busy = input(false);
  readonly labels = input.required<LevelConfirmLabels>();
  readonly confirm = output<string>();
  protected readonly levels = CEFR_LEVELS;
  protected readonly choice = signal<string>('A2');

  constructor() {
    effect(() => this.choice.set(this.current() ?? this.estimate()?.level ?? 'A2')); // Propuesta inicial = nivel estimado
  }

  protected keys(e: LevelEstimate): string[] {
    return Object.keys(e.indicators);
  }

  protected pct(c: number): string {
    return String(Math.round(c * 100));
  }
}
