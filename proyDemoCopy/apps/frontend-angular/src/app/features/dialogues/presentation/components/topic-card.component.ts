import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
// [TopicCardComponent · Presentacional · Sprint 9.11 · RF-121]: tema de conversación (presentarse, hobbies, familia, comida, viajes, cultura…) con niveles recomendados y «Conversar» | [Patrón]: Presentational Component | [Principio]: SRP + DRY (estilo `surface` de las tarjetas del portal) | [Paradigma]: Declarativo
// [UX]: toda la tarjeta es el enlace (área táctil grande) · [A11y]: un solo enlace con el nombre del tema

@Component({
  selector: 'aula-topic-card',
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <a
      [routerLink]="['/dialogos/conversar', id()]"
      [queryParams]="query()"
      class="surface group flex h-full flex-col gap-2 p-4 text-foreground no-underline hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        class="grid size-12 place-items-center rounded-xl bg-gradient-soft text-2xl"
        aria-hidden="true"
        >{{ emoji() }}</span
      >
      <span class="text-base font-bold">{{ title() }}</span>
      @if (levels().length) {
        <span class="flex flex-wrap gap-1 text-xs">
          @for (l of levels(); track l) {
            <span class="badge bg-muted font-bold">{{ l }}</span>
          }
        </span>
      }
      @if (objectives().length) {
        <ul class="list-inside list-disc text-sm text-muted-foreground">
          @for (o of objectives().slice(0, 2); track o) {
            <li>{{ o }}</li>
          }
        </ul>
      }
      <span class="mt-auto pt-1 text-sm font-semibold text-primary group-hover:underline"
        ><aula-icon name="message-circle" /> {{ action() }} →</span
      >
    </a>
  `,
})
export class TopicCardComponent {
  readonly id = input.required<string>();
  readonly title = input.required<string>();
  readonly emoji = input('💬');
  readonly levels = input<readonly string[]>([]);
  readonly objectives = input<readonly string[]>([]);
  readonly action = input('Conversar');
  readonly query = input<Record<string, string>>({}); // ?lang=&level= elegidos en el selector
}
