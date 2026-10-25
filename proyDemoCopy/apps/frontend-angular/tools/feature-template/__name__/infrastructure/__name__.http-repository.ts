import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { z } from 'zod';
import { API_URL } from '@core/http/api-url.token';
import { __Name__Repository } from '../domain/__name__.repository.port';
import { __Name__Schema, type __Name__ } from '../domain/models/__name__';
// [Plantilla · Repositorio HTTP]: único lugar con HttpClient de __name__ (hacia /api/* del BFF; registrar el prefijo en apps/frontend-next/src/lib/bff/forward.ts) | [Patrón]: Adapter + Repository | [Principio]: SRP + DIP

@Injectable()
export class __Name__HttpRepository extends __Name__Repository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL)}/__name__`;

  list(): Observable<__Name__[]> {
    return this.http.get<unknown>(this.base).pipe(map((r) => z.array(__Name__Schema).parse(r)));
  }
}
