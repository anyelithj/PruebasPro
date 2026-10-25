import { of, throwError } from 'rxjs';
import { render } from '@testing/render';
import { __Name__Facade } from '../../__name__/application/__name__.facade';
import { __Name__Repository } from '../../__name__/domain/__name__.repository.port';
import __Name__Page from '../../__name__/presentation/pages/__name__.page';
// [Plantilla · Spec del contenedor]: carga, vacío y error | [Patrón]: Test Double del puerto

const providers = (list: __Name__Repository['list']) => [__Name__Facade, { provide: __Name__Repository, useValue: { list } }];

describe('__Name__Page', () => {
  it('lista los elementos', async () => {
    const { el } = await render(__Name__Page, providers(() => of([{ id: '1', title: 'Uno' }])));
    expect(el.textContent).toContain('Uno');
  });

  it('error', async () => {
    const { el } = await render(__Name__Page, providers(() => throwError(() => new Error('x'))));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('x');
  });
});
