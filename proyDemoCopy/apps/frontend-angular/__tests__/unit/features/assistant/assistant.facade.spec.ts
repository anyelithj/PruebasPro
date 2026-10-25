import { TestBed } from '@angular/core/testing';
import { from, throwError } from 'rxjs';
import { AssistantRepository } from '@features/assistant/domain/assistant.repository.port';
import type { ChatChunk } from '@features/assistant/domain/models/assistant';
import { AssistantFacade } from '@features/assistant/application/assistant.facade';
// [Spec AssistantFacade]: enviar → turno del usuario + turno del tutor que crece token a token, sesión recordada, error que quita el turno vacío | [Patrón]: Test Double (repositorio falso)

function setup(stream: AssistantRepository['stream']) {
  TestBed.configureTestingModule({ providers: [AssistantFacade, { provide: AssistantRepository, useValue: { stream } }] });
  return TestBed.inject(AssistantFacade);
}

describe('AssistantFacade', () => {
  it('construye la respuesta con los tokens y guarda la sesión', () => {
    const chunks: ChatChunk[] = [{ type: 'session', sessionId: 's-1' }, { type: 'token', text: 'Hola ' }, { type: 'token', text: 'Ana' }, { type: 'done' }];
    const calls: unknown[] = [];
    const facade = setup((input) => (calls.push(input), from(chunks)));
    facade.send('  ¿Qué es el present perfect?  ');
    expect(facade.turns()).toEqual([
      { role: 'user', content: '¿Qué es el present perfect?' },
      { role: 'assistant', content: 'Hola Ana' },
    ]);
    expect(facade.sessionId()).toBe('s-1');
    expect(facade.streaming()).toBe(false);
    facade.send('Otra');
    expect(calls[1]).toMatchObject({ sessionId: 's-1', language: 'en' });
  });

  it('un error quita el turno vacío del tutor y lo informa', () => {
    const facade = setup(() => throwError(() => new Error('El tutor no está disponible')));
    facade.send('Hola');
    expect(facade.turns()).toEqual([{ role: 'user', content: 'Hola' }]);
    expect(facade.error()).toBe('El tutor no está disponible');
  });

  it('mensaje vacío no se envía; reset limpia todo', () => {
    const facade = setup(() => from([]));
    facade.send('   ');
    expect(facade.isEmpty()).toBe(true);
    facade.send('x');
    facade.reset();
    expect(facade.isEmpty()).toBe(true);
    expect(facade.sessionId()).toBeUndefined();
  });
});
