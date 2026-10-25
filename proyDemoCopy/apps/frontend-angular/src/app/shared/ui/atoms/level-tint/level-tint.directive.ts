import { computed, Directive, input } from '@angular/core';
import { cefrColor } from '@aula/ui-tokens/cefr-colors';
// [LevelTintDirective · Átomo]: `[aulaLevel]="'B1'"` publica `--lvl` (acento) y `--lvl-deep` (fondo oscuro) del nivel MCER en el elemento → los hijos se tiñen con `border-(--lvl)`, `bg-(--lvl-deep)`… | [Patrón]: Attribute Directive + Lookup Table (@aula/ui-tokens) | [Principio]: DRY (certificados, Tutor IA y Corrector usan el mismo mapa) + OCP (solo CSS, sin ramas por nivel) | [Paradigma]: Declarativo + Reactivo (signals)
// [A11y]: el color es decorativo → quien la usa muestra siempre el nivel en texto

@Directive({
  selector: '[aulaLevel]',
  host: {
    '[style.--lvl]': 'tint().color', // `host` (Angular): enlaza propiedades CSS personalizadas sin ElementRef
    '[style.--lvl-deep]': 'tint().deep',
  },
})
export class LevelTintDirective {
  readonly aulaLevel = input<string | null | undefined>(null); // A1–C2 · null/otro → morado de marca
  protected readonly tint = computed(() => cefrColor(this.aulaLevel()));
}
