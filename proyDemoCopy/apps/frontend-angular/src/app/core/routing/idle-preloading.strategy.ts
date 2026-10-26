import { Injectable } from '@angular/core';
import type { PreloadingStrategy, Route } from '@angular/router';
import { EMPTY, Observable, mergeMap } from 'rxjs';
// [IdlePreloadingStrategy · core/routing]: precarga las funcionalidades lazy cuando el navegador queda ocioso, no en cuanto se pinta la primera pantalla | [Patrón]: Strategy (PreloadingStrategy del router) | [Principio]: OCP (una ruta se excluye con `data: { preload: false }`, sin tocar esta clase) | [Paradigma]: Reactivo (RxJS)
// [Por qué · 2026-10-24]: con PreloadAllModules las ~150 descargas de chunks competían con las peticiones de la pantalla recién abierta (auth/me, datos de la sección) → la sección se veía lenta justo al entrar
// [Rendimiento]: respeta «Ahorro de datos» y redes 2G (no precarga) · las rutas pesadas (viem/web3) se cargan solo al visitarlas

// `NetworkInformation` (Network Information API): no está en lib.dom de TypeScript → tipo mínimo propio
interface NetworkHints {
  saveData?: boolean;
  effectiveType?: string;
}

// [whenIdle]: emite una vez cuando el hilo principal está libre | `requestIdleCallback` (DOM) con `timeout` → nunca espera más de 3 s · Safari no lo tiene → `setTimeout` como respaldo
const whenIdle = (): Observable<void> =>
  new Observable<void>((sub) => {
    const done = (): void => {
      sub.next();
      sub.complete();
    };
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(done, { timeout: 3000 });
      return () => cancelIdleCallback(id); // Teardown: si el router cancela la precarga, se libera el callback
    }
    const id = setTimeout(done, 1500);
    return () => clearTimeout(id);
  });

@Injectable({ providedIn: 'root' })
export class IdlePreloadingStrategy implements PreloadingStrategy {
  // [preload]: el router la llama por cada ruta lazy; `load()` descarga el chunk (y luego sus hijas pasan otra vez por aquí)
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (route.data?.['preload'] === false) return EMPTY; // Opt-out por ruta (data del Routes)
    const conn = (navigator as Navigator & { connection?: NetworkHints }).connection;
    if (conn?.saveData || conn?.effectiveType?.endsWith('2g')) return EMPTY; // `endsWith('2g')` cubre 'slow-2g' y '2g'
    // `mergeMap` (RxJS): al quedar ocioso, cambia al Observable de carga del router
    return whenIdle().pipe(mergeMap(() => load()));
  }
}
