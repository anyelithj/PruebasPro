import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal } from '@angular/core';
// [DropdownComponent · Molécula]: botón + panel flotante del topbar (tema, idioma, notificaciones, carrito, perfil) — réplica de Dropdown.tsx de Next.js | [Patrón]: Atomic Design (molécula) + Content Projection (slots `[trigger]`, `[badge]` y panel) + Observer (eventos del documento) | [Principio]: DRY + SRP | [Paradigma]: Declarativo + Reactivo
// [A11y]: aria-haspopup/aria-expanded/aria-controls en el disparador, cierre con Escape y con clic fuera (WAI-ARIA APG «menu button»)
// [Uso]: `<aula-dropdown #dd label="…"><span trigger>…</span> … <button (click)="dd.close()">…</button></aula-dropdown>`

let nextId = 0; // `let` (ES2015): contador de ids únicos para `aria-controls`

@Component({
  selector: 'aula-dropdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block',
    // `(document:…)` (Angular host listeners): se registran una vez y se quitan al destruir el componente
    '(document:pointerdown)': 'onPointer($event)',
    '(document:keydown.escape)': 'close()',
  },
  template: `
    <button
      type="button"
      (click)="toggle()"
      [attr.aria-haspopup]="panelRole()"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="panelId"
      [attr.aria-label]="label()"
      [title]="label()"
      class="relative flex items-center gap-1.5 rounded-full border border-border bg-muted text-xs font-semibold text-foreground transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      [class]="triggerClass()"
    >
      <ng-content select="[trigger]" />
      <ng-content select="[badge]" />
    </button>
    <!-- [hidden] y no un bloque condicional: el contenido proyectado se crea una vez (Angular no permite <ng-content> condicional) -->
    <div
      [id]="panelId"
      [attr.role]="panelRole()"
      [attr.aria-label]="label()"
      [hidden]="!open()"
      class="absolute right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
      [class]="panelClass()"
    >
      <ng-content />
    </div>
  `,
})
export class DropdownComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly label = input.required<string>(); // Nombre accesible del disparador
  readonly triggerClass = input('px-2.5 py-1.5');
  readonly panelClass = input('min-w-40 py-1');
  readonly panelRole = input<'menu' | 'dialog'>('menu'); // «menu» = opciones · «dialog» = panel con contenido
  readonly opened = output<void>(); // `output` (Angular): avisa al abrir (p. ej. recargar notificaciones)
  protected readonly open = signal(false);
  protected readonly panelId = `aula-dropdown-${++nextId}`;

  toggle(): void {
    if (!this.open()) this.opened.emit();
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }

  // [Clic fuera]: `contains` (DOM) → solo cierra si el puntero cayó fuera del componente
  protected onPointer(e: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
