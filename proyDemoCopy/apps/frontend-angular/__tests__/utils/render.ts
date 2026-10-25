import { provideZonelessChangeDetection, type EnvironmentProviders, type Provider, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_URL } from '@core/http/api-url.token';
import { provideHttp } from '@core/http/http.providers';
import { API } from './msw/handlers';
// [render]: monta un componente standalone con los providers reales de HTTP (interceptores incluidos) apuntando a msw | [Patrón]: Test Helper + Builder | [Principio]: DRY (todas las specs de páginas) | [Paradigma]: async/await

// [testProviders]: HTTP real + base absoluta de msw + router vacío
export const testProviders = (extra: (Provider | EnvironmentProviders)[] = []): (Provider | EnvironmentProviders)[] => [
  provideZonelessChangeDetection(),
  provideHttp(),
  provideRouter([]),
  { provide: API_URL, useValue: API },
  ...extra,
];

// [settle]: deja correr fetch de msw + promesas y repinta | `whenStable` (Angular zoneless) espera tareas pendientes
export async function settle<T>(fixture?: ComponentFixture<T>): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 0));
    if (fixture) await fixture.whenStable();
  }
}

// [render]: crea el componente, espera a que se estabilice (peticiones + signals) y devuelve fixture + DOM
export async function render<T>(
  component: Type<T>,
  providers: (Provider | EnvironmentProviders)[] = [],
): Promise<{ fixture: ComponentFixture<T>; el: HTMLElement }> {
  TestBed.configureTestingModule({ imports: [component], providers: testProviders(providers) });
  const fixture = TestBed.createComponent(component);
  await settle(fixture);
  return { fixture, el: fixture.nativeElement as HTMLElement };
}
