import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AvatarStageComponent } from '@shared/ui/organisms/avatar-stage/avatar-stage.component';
import type {
  AvatarState,
  AvatarStateLabels,
} from '@shared/ui/organisms/avatar-stage/avatar-state';
// [SpeakerAvatarsComponent · Presentacional · Sprint 9.13 · RF-127]: un avatar por hablante del diálogo; el que habla mueve la boca y el del usuario «escucha» | [Patrón]: Presentational Component + Composite (dos AvatarStage) | [Principio]: DRY (reutiliza el organismo compartido) | [Paradigma]: Declarativo

@Component({
  selector: 'aula-speaker-avatars',
  imports: [AvatarStageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="grid grid-cols-2 gap-3">
      <aula-avatar-stage
        [state]="stateOf('A')"
        [level]="level()"
        [labels]="labels()"
        [name]="names()[0] + (userRole() === 'A' ? ' · ' + youLabel() : '')"
        [size]="96"
      />
      <aula-avatar-stage
        [state]="stateOf('B')"
        [level]="level()"
        [labels]="labels()"
        [name]="names()[1] + (userRole() === 'B' ? ' · ' + youLabel() : '')"
        [size]="96"
        variant="alt"
      />
    </div>
  `,
})
export class SpeakerAvatarsComponent {
  readonly names = input<readonly string[]>(['A', 'B']);
  readonly active = input<'A' | 'B' | null>(null); // Hablante del turno actual
  readonly speaking = input(false); // El turno actual está sonando
  readonly userRole = input<'A' | 'B'>('A');
  readonly level = input(0);
  readonly labels = input.required<AvatarStateLabels>();
  readonly youLabel = input('Tú');
  private readonly states = computed(() => ({
    active: this.active(),
    speaking: this.speaking(),
    user: this.userRole(),
  }));

  protected stateOf(side: 'A' | 'B'): AvatarState {
    const s = this.states();
    if (s.active !== side) return 'idle';
    if (side === s.user && !s.speaking) return 'listening'; // Turno del usuario: el avatar de su rol espera su voz
    return s.speaking ? 'speaking' : 'idle';
  }
}
