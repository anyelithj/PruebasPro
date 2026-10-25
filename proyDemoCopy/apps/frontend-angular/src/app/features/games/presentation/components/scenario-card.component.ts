import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LevelTintDirective } from '@shared/ui/atoms/level-tint/level-tint.directive';
import type { Scenario } from '../../domain/models/games';
// [ScenarioCardComponent · Presentacional · Sprint 8.9]: escenario de role-play (restaurante, entrevista, aeropuerto, médico, hotel, reunión) con nivel y objetivos | [Patrón]: Presentational Component | [Principio]: SRP | [Paradigma]: Declarativo
// [Identidad]: el nivel MCER tiñe la tarjeta con su color (mismo SSOT que certificados y tutor) · [A11y]: enlace único con el título del escenario

@Component({
  selector: 'aula-scenario-card',
  imports: [RouterLink, LevelTintDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let s = scenario();
    <a
      [routerLink]="['/juegos/role-play', s.id]"
      [aulaLevel]="s.level"
      class="surface group flex h-full flex-col gap-2 border-t-4 border-t-[var(--lvl)] p-4 text-foreground no-underline hover:-translate-y-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span class="flex items-center justify-between">
        <span class="text-3xl" aria-hidden="true">{{ s.emoji || '🎭' }}</span>
        <span class="badge bg-[var(--lvl)] text-white">{{ s.level }}</span>
      </span>
      <span class="text-base font-bold">{{ s.title }}</span>
      <span class="text-xs text-muted-foreground">{{ roleLabel() }}</span>
      <ul class="mt-1 list-inside list-disc text-sm text-muted-foreground">
        @for (o of s.objectives; track o.id) {
          <li>{{ o.text }}</li>
        }
      </ul>
    </a>
  `,
})
export class ScenarioCardComponent {
  readonly scenario = input.required<Scenario>();
  readonly roleLabel = input('');
}
