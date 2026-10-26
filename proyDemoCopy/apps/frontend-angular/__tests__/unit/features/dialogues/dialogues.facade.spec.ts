import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { ApiError } from '@core/http/error.interceptor';
import { DialogueAgentFacade } from '@features/dialogues/application/dialogue-agent.facade';
import { DialoguesFacade } from '@features/dialogues/application/dialogues.facade';
import { DialoguesRepository } from '@features/dialogues/domain/dialogues.repository.port';
import { similarity } from '@features/dialogues/domain/models/dialogues';
import { dialogue, session, topic, turn } from '@testing/music-dialogues';
// [Spec DialoguesFacade + DialogueAgentFacade · Sprints 9.11–9.13]: confirmar el nivel saca de pendientes; conversación — apertura que habla el avatar, SSE (user → token → avatar) con corrección y vocabulario, voz → texto, error visible | [Patrón]: Test Double (repositorio y voz falsos)

const speech = { speak: jest.fn((_t: string, _l: string, _r: number, h: { end?: () => void } = {}) => h.end?.()), stop: jest.fn(), hasVoice: jest.fn(() => true), hasNaturalVoice: () => true, speaking: () => false, accent: () => 'uk' };

function setup(overrides: Partial<DialoguesRepository> = {}) {
  const repo = {
    listDialogues: jest.fn(() => of([dialogue({ levelStatus: 'estimated' })])),
    confirmLevel: jest.fn(() => of(dialogue({ level: 'B1', levelStatus: 'confirmed' }))),
    startSession: jest.fn(() => of({ session: session(), topic, turns: [turn(0, 'avatar', 'What is your favourite food?')] })),
    streamTurn: jest.fn(() =>
      of(
        { type: 'user', data: turn(1, 'user', 'I likes pasta', 'Se dice «I like».') },
        { type: 'token', data: { text: 'Pasta ' } },
        { type: 'avatar', data: { ...turn(2, 'avatar', 'Pasta is great!'), vocabularyUsed: ['pasta'] } },
        { type: 'done', data: {} },
      ),
    ),
    transcribe: jest.fn(() => of('I like pasta')),
    ...overrides,
  } as unknown as DialoguesRepository;
  TestBed.configureTestingModule({
    providers: [DialoguesFacade, DialogueAgentFacade, { provide: DialoguesRepository, useValue: repo }, { provide: SpeechSynthesisService, useValue: speech }],
  });
  return { dialogues: TestBed.inject(DialoguesFacade), agent: TestBed.inject(DialogueAgentFacade), repo };
}

describe('DialoguesFacade', () => {
  it('confirmar el nivel lo quita de pendientes', async () => {
    const { dialogues, repo } = setup();
    await dialogues.loadPending();
    expect(await dialogues.confirmLevel('d1', 'B1')).toBe(true);
    expect(repo.confirmLevel).toHaveBeenCalledWith('d1', 'B1');
    expect(dialogues.pending.data()).toEqual([]);
  });

  it('error al confirmar (licencia) → visible', async () => {
    const { dialogues } = setup({ confirmLevel: () => throwError(() => new ApiError(400, 'Confirma que tienes derecho')) } as never);
    expect(await dialogues.confirmLevel('d1', 'A2')).toBe(false);
    expect(dialogues.actionError()).toContain('derecho');
  });
});

describe('DialogueAgentFacade', () => {
  beforeEach(() => speech.speak.mockClear());

  it('al empezar el avatar dice la apertura', async () => {
    const { agent } = setup();
    expect(await agent.start('tp1', 'en', 'A2')).toBe(true);
    expect(speech.speak).toHaveBeenCalledWith('What is your favourite food?', 'en', 0.9, expect.any(Object));
    expect(agent.state()).toBe('idle'); // `end` del habla falsa → vuelve a reposo
  });

  it('SSE: turno del usuario con corrección, respuesta del avatar y vocabulario usado', async () => {
    const { agent } = setup();
    await agent.start('tp1', 'en', 'A2');
    agent.send('I likes pasta');
    expect(agent.turns().map((t) => t.speaker)).toEqual(['avatar', 'user', 'avatar']);
    expect(agent.lastCorrection()).toBe('Se dice «I like».');
    expect(agent.vocabularyUsed()).toEqual(['pasta']);
    expect(agent.session()?.userTurns).toBe(1);
    expect(speech.speak).toHaveBeenLastCalledWith('Pasta is great!', 'en', 0.9, expect.any(Object));
  });

  it('voz → texto para revisar (no se envía solo); al enviar, el error del servidor es visible', async () => {
    const { agent, repo } = setup({ streamTurn: () => of({ type: 'error', data: { message: 'El tutor no está disponible' } }) } as never);
    await agent.start('tp1', 'en', 'A2');
    const text = await agent.transcribe({ blob: new Blob(['x']), durationMs: 900 });
    expect(repo.transcribe).toHaveBeenCalled();
    expect(text).toBeTruthy();
    expect(agent.turns().map((t) => t.speaker)).toEqual(['avatar']); // Nada enviado aún: el alumno revisa el texto
    agent.send(text!);
    expect(agent.error()).toContain('no está disponible');
  });

  it('similarity: palabras de la frase dichas (sin tildes ni mayúsculas)', () => {
    expect(similarity('¿Cómo estás, Ana?', 'como estas ana')).toBe(1);
    expect(similarity('I would like a coffee', 'I like coffee')).toBe(0.6);
    expect(similarity('', 'algo')).toBe(0);
  });
});
