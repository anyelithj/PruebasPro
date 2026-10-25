import { Component, signal } from '@angular/core';
import { render, settle } from '@testing/render';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
// [Spec ButtonComponent]: variantes, foco visible (elemento <button> real) y aria-disabled/aria-busy bloqueando el clic | [Patrón]: Test Host (componente anfitrión) | [Herramienta]: Jest + TestBed zoneless

@Component({
  imports: [ButtonComponent],
  template: `<button aulaButton [variant]="variant()" [loading]="loading()" [disabled]="disabled()" (click)="clicks = clicks + 1">Guardar</button>`,
})
class HostComponent {
  readonly variant = signal<'primary' | 'outline'>('primary');
  readonly loading = signal(false);
  readonly disabled = signal(false);
  clicks = 0;
}

describe('ButtonComponent', () => {
  it('aplica la variante y sigue siendo un <button> enfocable', async () => {
    const { fixture, el } = await render(HostComponent);
    const btn = el.querySelector('button')!;
    expect(btn.className).toContain('btn-primary');
    fixture.componentInstance.variant.set('outline');
    await settle(fixture);
    expect(btn.className).toContain('btn-outline');
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('con aria-disabled o cargando no ejecuta el clic', async () => {
    const { fixture, el } = await render(HostComponent);
    const host = fixture.componentInstance;
    const btn = el.querySelector('button')!;
    btn.click();
    expect(host.clicks).toBe(1);

    host.disabled.set(true);
    await settle(fixture);
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    btn.click();
    expect(host.clicks).toBe(1);

    host.disabled.set(false);
    host.loading.set(true);
    await settle(fixture);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    btn.click();
    expect(host.clicks).toBe(1);
  });
});
