import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { testProviders } from '@testing/render';
import { __Name__HttpRepository } from '../../__name__/infrastructure/__name__.http-repository';
// [Plantilla · Spec con msw]: petición, envelope de NestJS y mapeo DTO → modelo | [Herramienta]: msw 2

describe('__Name__HttpRepository', () => {
  it('lista y valida con Zod', async () => {
    server.use(http.get(`${API}/__name__`, () => HttpResponse.json(envelope([{ id: '1', title: 'x' }]))));
    TestBed.configureTestingModule({ providers: [...testProviders(), __Name__HttpRepository] });
    expect(await firstValueFrom(TestBed.inject(__Name__HttpRepository).list())).toEqual([{ id: '1', title: 'x' }]);
  });
});
