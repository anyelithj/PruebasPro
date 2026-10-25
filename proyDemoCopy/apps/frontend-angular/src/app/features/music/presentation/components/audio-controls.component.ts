import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { fmtTime } from '../../domain/models/music';
// [AudioControlsComponent · Presentacional · Sprint 9.8 · RF-119]: reproducir/pausar, repetir el verso actual y velocidad 0,75x/1x con el tiempo visible | [Patrón]: Presentational Component (eventos hacia SongPlayerFacade) | [Principio]: SRP | [Paradigma]: Declarativo
// [A11y]: botones con nombre que cambia según el estado, `aria-pressed` en los conmutadores, velocidad como grupo de radio · objetivos táctiles ≥ 44 px

export interface AudioControlsLabels {
  play: string;
  pause: string;
  repeat: string;
  repeatOff: string;
  speed: string;
}

@Component({
  selector: 'aula-audio-controls',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let lb = labels();
    <div class="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
      <button
        type="button"
        class="btn btn-primary btn-lg min-w-36"
        [disabled]="disabled()"
        (click)="playToggle.emit()"
      >
        <aula-icon [name]="playing() ? 'pause' : 'play'" /> {{ playing() ? lb.pause : lb.play }}
      </button>
      <button
        type="button"
        class="btn btn-outline min-h-11"
        [disabled]="disabled() || !canRepeat()"
        [attr.aria-pressed]="looping()"
        (click)="repeat.emit()"
      >
        <aula-icon name="repeat" /> {{ looping() ? lb.repeatOff : lb.repeat }}
      </button>
      <div
        role="radiogroup"
        [attr.aria-label]="lb.speed"
        class="inline-flex rounded-full border border-border bg-muted p-1 text-xs font-bold"
      >
        @for (r of rates; track r) {
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="rate() === r"
            class="min-h-9 rounded-full px-3 transition-colors"
            [class]="rate() === r ? 'bg-gradient-brand text-white' : 'text-muted-foreground'"
            (click)="rateChange.emit(r)"
          >
            {{ r === 1 ? '1x' : '0,75x' }}
          </button>
        }
      </div>
      <span class="ml-auto font-mono text-sm tabular-nums text-muted-foreground" aria-hidden="true"
        >{{ fmt(time()) }} / {{ fmt(duration()) }}</span
      >
    </div>
  `,
})
export class AudioControlsComponent {
  readonly labels = input.required<AudioControlsLabels>();
  readonly playing = input(false);
  readonly looping = input(false);
  readonly canRepeat = input(true);
  readonly disabled = input(false);
  readonly rate = input<0.75 | 1>(1);
  readonly time = input(0);
  readonly duration = input(0);
  readonly playToggle = output<void>();
  readonly repeat = output<void>();
  readonly rateChange = output<0.75 | 1>();
  protected readonly rates = [0.75, 1] as const;
  protected readonly fmt = fmtTime;
}
