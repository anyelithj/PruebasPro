import { firstValueFrom, of, toArray } from 'rxjs';
import { IdlePreloadingStrategy } from '@core/routing/idle-preloading.strategy';
// [Spec IdlePreloadingStrategy · 2026-10-24]: precarga en tiempo ocioso, respeta `data: { preload: false }` y «Ahorro de datos» | [Patrón]: Test Double (`load` falso) | [Principio]: comportamiento observable, no detalles de implementación

// [setConnection]: simula la Network Information API (jsdom no la trae) | `configurable`: cada prueba la redefine
function setConnection(value: object | undefined): void {
  Object.defineProperty(navigator, 'connection', { value, configurable: true });
}

describe('IdlePreloadingStrategy', () => {
  const strategy = new IdlePreloadingStrategy();
  afterEach(() => setConnection(undefined));

  it('carga la ruta cuando el navegador queda ocioso', async () => {
    const load = jest.fn(() => of('chunk'));
    await expect(firstValueFrom(strategy.preload({ path: 'tutor' }, load))).resolves.toBe('chunk');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('omite las rutas marcadas con data.preload = false', async () => {
    const load = jest.fn(() => of('chunk'));
    const values = await firstValueFrom(strategy.preload({ path: 'wallet', data: { preload: false } }, load).pipe(toArray()));
    expect(values).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });

  it('no precarga con «Ahorro de datos» ni en 2G', async () => {
    const load = jest.fn(() => of('chunk'));
    setConnection({ saveData: true });
    expect(await firstValueFrom(strategy.preload({ path: 'tutor' }, load).pipe(toArray()))).toEqual([]);
    setConnection({ effectiveType: 'slow-2g' });
    expect(await firstValueFrom(strategy.preload({ path: 'tutor' }, load).pipe(toArray()))).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });
});
