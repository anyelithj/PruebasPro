import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AvatarSvgComponent } from '@shared/ui/atoms/avatar-svg/avatar-svg.component';
import { moves, type AvatarState, type AvatarStateLabels } from './avatar-state';
// [AvatarStageComponent · Organismo · Sprint 9.7 · RF-118/RF-122]: escenario del avatar (voz, canto o escucha) — personaje, anillo de estado y estado en texto | [Patrón]: Atomic Design (organismo) + State Machine (AvatarState) | [Principio]: DRY (reproductor de canciones, conversación y diálogos guionados) + SRP | [Paradigma]: Declarativo + Reactivo (signals)
// [A11y]: el estado se anuncia en texto con aria-live (no solo con la animación) · prefers-reduced-motion → la boca no se mueve y el anillo no late

@Component({
  selector: 'aula-avatar-stage',
  imports: [IconComponent, AvatarSvgComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <figure class="flex flex-col items-center gap-3 rounded-2xl bg-gradient-soft p-4 sm:p-6">
      <div class="relative grid place-items-center">
        <!-- [Anillo]: escuchando = cian, pensando = ámbar, hablando o cantando = violeta -->
        <span
          class="absolute inset-0 rounded-full border-4 transition-colors"
          [class]="ring()"
          [class.motion-safe:animate-ping]="state() === 'listening'"
          aria-hidden="true"
        ></span>
        <aula-avatar-svg [mouth]="mouth()" [size]="size()" [variant]="variant()" />
        @if (state() === 'singing') {
          <span
            class="absolute -right-2 -top-1 text-2xl motion-safe:animate-bounce"
            aria-hidden="true"
            ><aula-icon name="music" /></span
          >
        }
      </div>
      <figcaption class="text-center">
        @if (name()) {
          <span class="block text-sm font-bold">{{ name() }}</span>
        }
        <span
          class="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"
          aria-live="polite"
        >
          <span class="size-2 rounded-full" [class]="dot()" aria-hidden="true"></span
          >{{ labels()[state()] }}
        </span>
      </figcaption>
    </figure>
  `,
})
export class AvatarStageComponent {
  readonly state = input<AvatarState>('idle');
  readonly level = input(0); // Volumen 0..1 (LipSyncService.level())
  readonly labels = input.required<AvatarStateLabels>();
  readonly name = input('');
  readonly size = input(132);
  readonly variant = input<'brand' | 'alt'>('brand');
  // [Movimiento reducido]: se respeta la preferencia del sistema operativo (WCAG 2.3.3)
  private readonly reduced =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  protected readonly mouth = computed(() =>
    moves(this.state()) && !this.reduced ? this.level() : 0,
  );
  protected readonly ring = computed(
    () =>
      ({
        idle: 'border-transparent',
        listening: 'border-sky-400/70',
        thinking: 'border-amber-400/70',
        speaking: 'border-violet-500/70',
        singing: 'border-fuchsia-500/70',
      })[this.state()],
  );
  protected readonly dot = computed(
    () =>
      ({
        idle: 'bg-muted-foreground',
        listening: 'bg-sky-500',
        thinking: 'bg-amber-500',
        speaking: 'bg-violet-600',
        singing: 'bg-fuchsia-600',
      })[this.state()],
  );
}
