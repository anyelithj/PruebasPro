import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { IconComponent, type IconName } from '@shared/ui/atoms/icon/icon.component';
// [PillNavComponent · Molécula · 2026-10-23]: navegación en pills (chips) entre pantallas hermanas — secciones de Actividades y vistas de una sección (Diálogos: temas | biblioteca)
// [Patrón]: Atomic Design (molécula) + Configuration Object (items) | [Principio]: DRY (mismo .chip que Next.js) + SRP (solo navega) | [Paradigma]: Declarativo
// [A11y]: <nav> con aria-label + aria-current="page" en la activa (RouterLinkActive.ariaCurrentWhenActive) → no depende solo del color

export interface PillItem {
  label: string;
  link: string; // Ruta del remoto Angular (/dialogos, /dialogos/biblioteca…)
  icon?: IconName; // Nombre del icono lucide de <aula-icon> (tipado: solo iconos existentes)
}

@Component({
  selector: 'aula-pill-nav',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <nav [attr.aria-label]="label()" class="flex flex-wrap gap-1.5">
      @for (it of items(); track it.link) {
        <!-- routerLinkActive (Angular Router): marca la pill de la URL actual · exact → «/dialogos» no queda activa en «/dialogos/biblioteca» -->
        <a
          class="chip"
          [routerLink]="it.link"
          routerLinkActive
          ariaCurrentWhenActive="page"
          [routerLinkActiveOptions]="{ exact: exact() }"
        >
          @if (it.icon) {
            <aula-icon [name]="it.icon" />
          }
          {{ it.label }}
        </a>
      }
    </nav>
  `,
})
export class PillNavComponent {
  readonly items = input.required<readonly PillItem[]>();
  readonly label = input.required<string>(); // Nombre accesible del <nav>
  readonly exact = input(false); // true = vistas de una sección; false = secciones (activa también en sus subrutas)
}

// [ActivitySectionsComponent]: las 5 secciones de Actividades (las mismas pestañas que /actividades de Next.js) arriba de cada sección
// → entrar por el menú o por «Volver» lleva SIEMPRE a la misma pantalla con las mismas pills | [Principio]: DRY (un solo listado de secciones)
@Component({
  selector: 'aula-activity-sections',
  imports: [PillNavComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `<aula-pill-nav [items]="items()" [label]="i18n.t().common.activitySections.label" />`,
})
export class ActivitySectionsComponent {
  protected readonly i18n = inject(I18nService);
  // `computed` (Angular Signals): se recalcula al cambiar de idioma
  protected readonly items = computed<PillItem[]>(() => {
    const s = this.i18n.t().common.activitySections;
    return [
      { label: s.practice, link: '/practica', icon: 'puzzle' },
      { label: s.games, link: '/juegos', icon: 'gamepad-2' },
      { label: s.music, link: '/musica', icon: 'music' },
      { label: s.dialogues, link: '/dialogos', icon: 'messages-square' },
      { label: s.polyglot, link: '/poliglota', icon: 'globe' },
    ];
  });
}
