import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
// [PracticeLinkComponent · Presentacional · Sprint 9.10 · RF-120]: acceso a las prácticas de la canción desde el reproductor | [Patrón]: Presentational Component | [Principio]: bajo acoplamiento (solo navega; la práctica vive en la feature Practice) | [Paradigma]: Declarativo

@Component({
  selector: 'aula-practice-link',
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a [routerLink]="['/musica/cancion', songId(), 'practica']" class="btn btn-outline"
    ><aula-icon name="puzzle" /> {{ label() }}</a
  >`,
})
export class PracticeLinkComponent {
  readonly songId = input.required<string>();
  readonly label = input.required<string>();
}
