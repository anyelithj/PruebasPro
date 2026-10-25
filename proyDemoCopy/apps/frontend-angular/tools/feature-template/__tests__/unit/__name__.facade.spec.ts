import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { __Name__Repository } from '../../__name__/domain/__name__.repository.port';
import { __Name__Facade } from '../../__name__/application/__name__.facade';
// [Plantilla · Spec de la fachada]: transición carga → vacío/éxito con un repositorio falso | [Patrón]: Test Double

describe('__Name__Facade', () => {
  it('sin elementos queda en «empty»', async () => {
    TestBed.configureTestingModule({ providers: [__Name__Facade, { provide: __Name__Repository, useValue: { list: () => of([]) } }] });
    const facade = TestBed.inject(__Name__Facade);
    await facade.load();
    expect(facade.items.status()).toBe('empty');
  });
});
