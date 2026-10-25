import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WordLookupComponent } from './word-lookup.component';
// [WordLookupElement · Angular Element <aula-word-lookup> · Sprints 10.3/10.4 · RF-136]: el texto con diccionario como Web Component → Next.js lo monta en recursos, lecciones y lecturas con <WordLookupHost> | [Patrón]: Adapter (componente → Custom Element) | [Principio]: bajo acoplamiento (Next solo pasa atributos) + DRY (mismo organismo que Angular) | [Paradigma]: Declarativo
// [Uso]: <aula-word-lookup text="I run every day" language="en"></aula-word-lookup> · `language` y no `lang` → no pisa la propiedad nativa de HTMLElement

@Component({
  selector: 'aula-word-lookup-element',
  imports: [WordLookupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // [Atributo, no etiqueta]: <span aulaWordText> evita crear otro <aula-word-lookup> (sería el propio Custom Element → recursión)
  template: `<span aulaWordText [text]="text()" [language]="language()"></span>`,
})
export class WordLookupElement {
  readonly text = input(''); // Atributo `text`
  readonly language = input('en'); // Atributo `language` (ISO 639-1)
}
