import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input } from '@angular/core';
// [ButtonComponent · Átomo]: botón con variantes y estados (disabled / loading) | [Patrón]: Atomic Design + Attribute Component (`button[aulaButton]` conserva el <button> nativo) | [Principio]: DRY (utilidades btn-* compartidas con Next.js) + OCP (variante nueva = entrada en el mapa)
// [A11y]: elemento <button> real (teclado y lector gratis) · `aria-disabled` en vez de `disabled` → sigue enfocable y anunciable · `aria-busy` mientras carga

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};
const SIZES: Record<ButtonSize, string> = { sm: 'btn-sm', md: '', lg: 'btn-lg' };

@Component({
  // Selector de atributo: `<button aulaButton variant="outline">` | `a[aulaButton]` para enlaces con aspecto de botón
  // eslint-disable-next-line @angular-eslint/component-selector -- componente de atributo a propósito: conserva el <button>/<a> nativo (a11y)
  selector: 'button[aulaButton], a[aulaButton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'classes()',
    '[attr.aria-disabled]': 'inactive() || null',
    '[attr.aria-busy]': 'loading() || null',
  },
  template: `
    @if (loading()) {
      <span class="size-3.5 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" aria-hidden="true"></span>
    }
    <ng-content />
  `,
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly loading = input(false);
  readonly disabled = input(false);

  protected readonly inactive = computed(() => this.disabled() || this.loading());
  protected readonly classes = computed(
    () => `btn ${VARIANTS[this.variant()]} ${SIZES[this.size()]} ${this.inactive() ? 'cursor-not-allowed opacity-60' : ''}`,
  );

  constructor() {
    // [guard]: con aria-disabled el navegador SÍ dispara click → se bloquea en fase de CAPTURA (corre antes que el `(click)` del consumidor) y también el submit del formulario
    // `addEventListener(..., { capture: true })` (DOM): un `host: {'(click)'}` llegaría tarde porque Angular registra antes el listener de la plantilla anfitriona
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.addEventListener(
      'click',
      (e) => {
        if (!this.inactive()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      { capture: true },
    );
  }
}
