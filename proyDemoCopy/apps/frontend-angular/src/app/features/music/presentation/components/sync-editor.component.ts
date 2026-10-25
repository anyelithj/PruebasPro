import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  fmtTime,
  tapTimings,
  type LinePatch,
  type LineTiming,
  type SongLine,
} from '../../domain/models/music';
import { ModeSwitchComponent } from '@shared/ui/molecules/mode-switch/mode-switch.component';
// [SyncEditorComponent · Presentacional · Sprint 9.9 · RF-119]: tocar al ritmo para marcar el inicio de cada verso (botón o barra espaciadora) o aceptar la propuesta de FastAPI Alignment y revisarla | [Patrón]: Presentational Component + State (marcas de inicio) | [Principio]: SRP + verificación humana (en canciones la alineación automática solo propone) | [Paradigma]: Declarativo + Reactivo
// [A11y]: el siguiente verso a marcar se anuncia (aria-live) y se resalta con texto «→»; todo se maneja con teclado

export interface SyncLabels {
  help: string;
  mode: string;
  modeAuto: string;
  modeAutoHint: string;
  modeManual: string;
  modeManualHint: string;
  mark: string;
  undo: string;
  restart: string;
  propose: string;
  proposed: string;
  confidence: string;
  save: string;
  marked: string;
  start: string;
  end: string;
}

@Component({
  selector: 'aula-sync-editor',
  imports: [IconComponent, ModeSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let lb = labels();
    <div class="space-y-3">
      <!-- [Modo · 2026-10-19]: automático (faster-whisper propone) o manual (tocar al ritmo); el resultado siempre se revisa antes de guardar -->
      <aula-mode-switch
        name="sync-mode"
        [legend]="lb.mode"
        [options]="[
          { value: 'auto', label: lb.modeAuto, hint: lb.modeAutoHint },
          { value: 'manual', label: lb.modeManual, hint: lb.modeManualHint },
        ]"
        [(value)]="mode"
      />
      @if (mode() === 'manual') {
        <p class="text-sm text-muted-foreground">{{ lb.help }}</p>
      }
      <audio #player class="w-full" controls preload="metadata" [src]="audioUrl()"></audio>
      <div class="flex flex-wrap gap-2">
        @if (mode() === 'manual') {
          <button
            type="button"
            class="btn btn-primary btn-lg"
            [disabled]="next() >= lines().length"
            (click)="mark()"
          >
            <aula-icon name="timer" /> {{ lb.mark }}
          </button>
          <button type="button" class="btn btn-outline" [disabled]="next() === 0" (click)="undo()">
            ↶ {{ lb.undo }}
          </button>
          <button type="button" class="btn btn-ghost" (click)="restart()">⟲ {{ lb.restart }}</button>
        } @else {
          <button type="button" class="btn btn-primary btn-lg" [disabled]="busy()" (click)="propose.emit()">
            <aula-icon name="sparkles" /> {{ lb.propose }}
          </button>
        }
      </div>
      <p class="text-xs font-semibold" aria-live="polite">{{ progress() }}</p>
      @if (fromProposal()) {
        <p class="rounded-lg bg-tone-info-soft p-2 text-xs text-tone-info">ℹ {{ lb.proposed }}</p>
      }
      <ol
        class="max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border text-sm"
      >
        @for (l of lines(); track l.id; let i = $index) {
          <li class="flex items-center gap-3 p-2" [class.bg-tone-brand-soft]="i === next()">
            <span class="w-4 text-tone-brand" aria-hidden="true">{{
              i === next() ? '→' : ''
            }}</span>
            <span class="flex-1" [attr.lang]="language()">{{ l.text }}</span>
            <span class="font-mono text-xs tabular-nums text-muted-foreground"
              >{{ lb.start }} {{ fmt(starts()[i]) }}</span
            >
            @if (confidence()[i] !== null) {
              <span
                class="badge"
                [class]="
                  confidence()[i]! < 0.5 ? 'bg-tone-warning-soft text-tone-warning' : 'bg-muted'
                "
                >{{ pct(i) }}</span
              >
            }
          </li>
        }
      </ol>
      <button
        type="button"
        class="btn btn-primary"
        [disabled]="next() === 0 || busy()"
        (click)="emitSave()"
      >
        <aula-icon name="save" /> {{ lb.save }}
      </button>
    </div>
  `,
})
export class SyncEditorComponent {
  readonly lines = input<readonly SongLine[]>([]);
  readonly audioUrl = input.required<string>();
  readonly language = input('en');
  readonly busy = input(false);
  readonly proposal = input<readonly LineTiming[] | null>(null); // Tiempos sugeridos por Alignment
  readonly labels = input.required<SyncLabels>();
  readonly propose = output<void>();
  protected readonly mode = signal<string>('auto'); // Automático por defecto: lo más rápido para el docente
  readonly save = output<{ lines: LinePatch[]; source: 'manual' | 'auto' }>();
  private readonly player = viewChild<ElementRef<HTMLAudioElement>>('player');
  protected readonly starts = signal<(number | null)[]>([]);
  protected readonly confidence = signal<(number | null)[]>([]);
  protected readonly fromProposal = signal(false);
  protected readonly next = computed(() => {
    const i = this.starts().findIndex((s) => s == null);
    return i < 0 ? this.starts().length : i;
  });
  protected readonly progress = computed(() =>
    this.labels()
      .marked.replace('{done}', String(this.next()))
      .replace('{total}', String(this.lines().length)),
  );
  protected readonly fmt = fmtTime;

  constructor() {
    // Líneas nuevas → marcas guardadas · propuesta nueva → se aplica para revisarla
    effect(() => {
      this.starts.set(this.lines().map((l) => l.startS));
      this.confidence.set(this.lines().map(() => null));
      this.fromProposal.set(false);
    });
    effect(() => {
      const p = this.proposal();
      if (!p) return;
      this.starts.set(this.lines().map((_, i) => p[i]?.start ?? null));
      this.confidence.set(this.lines().map((_, i) => p[i]?.confidence ?? null));
      this.fromProposal.set(true);
    });
  }

  protected pct(i: number): string {
    return this.labels().confidence.replace(
      '{pct}',
      String(Math.round((this.confidence()[i] ?? 0) * 100)),
    );
  }

  protected mark(): void {
    const i = this.next();
    if (i >= this.lines().length) return;
    const t = this.player()?.nativeElement.currentTime ?? 0;
    this.starts.update((s) => s.map((x, j) => (j === i ? t : x)));
    this.fromProposal.set(false);
  }

  protected undo(): void {
    const i = this.next() - 1;
    if (i >= 0) this.starts.update((s) => s.map((x, j) => (j >= i ? null : x)));
  }

  protected restart(): void {
    this.starts.set(this.lines().map(() => null));
    this.confidence.set(this.lines().map(() => null));
    const el = this.player()?.nativeElement;
    if (el) el.currentTime = 0;
  }

  protected emitSave(): void {
    const duration = this.player()?.nativeElement.duration || (this.starts().at(-1) ?? 0) + 4;
    const timings = tapTimings(this.starts(), duration);
    const ids = this.lines()
      .filter((_, i) => this.starts()[i] != null)
      .map((l) => l.id);
    this.save.emit({
      lines: timings.map((t, k) => ({ id: ids[k], ...t })),
      source: this.fromProposal() ? 'auto' : 'manual',
    });
  }
}
