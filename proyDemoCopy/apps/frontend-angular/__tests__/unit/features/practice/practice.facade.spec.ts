import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivityBuilderFacade } from '@features/practice/application/activity-builder.facade';
import { PracticeFacade } from '@features/practice/application/practice.facade';
import { PracticeRepository } from '@features/practice/domain/practice.repository.port';
import { blanksOf, itemProblem, leftItems, words } from '@features/practice/domain/models/practice';
import { toInput, toText } from '@features/practice/presentation/components/practice-item-form.component';
// [Spec PracticeFacade + ActivityBuilderFacade · Sprints 8.14/8.15]: resolver → corrección → siguiente → resultado, borrador de IA marcado, reglas puras (espejo de NestJS) y conversión texto ⇄ contrato del editor | [Patrón]: Test Double

const item = (id: string) => ({ id, position: 0, itemType: 'fill_blank' as const, skill: 'grammar' as const, prompt: 'She ___ to school', options: [], blanks: 1 });
const activity = { id: 'a1', title: 'Presente', description: '', language: 'en', level: 'A2', skill: 'grammar' as const, status: 'published' as const, aiDraft: false, createdBy: 't1', items: [item('i1'), item('i2')] };
const attempt = (score: number) => ({ id: 'at', itemId: 'i1', activityId: 'a1', answer: ['goes'], correct: score === 1, score, createdAt: '', feedback: { correct: score === 1, score, findings: [], correct_answer: 'goes', explanation: '', tip: '', method: 'deterministic' } });

function setup() {
  const repo = {
    activity: jest.fn(() => of(activity)),
    submit: jest.fn().mockReturnValueOnce(of(attempt(1))).mockReturnValueOnce(of(attempt(0))),
    createActivity: jest.fn(() => of({ ...activity, id: 'a2', status: 'draft', aiDraft: true })),
  } as unknown as PracticeRepository;
  TestBed.configureTestingModule({ providers: [PracticeFacade, ActivityBuilderFacade, { provide: PracticeRepository, useValue: repo }] });
  return { player: TestBed.inject(PracticeFacade), builder: TestBed.inject(ActivityBuilderFacade), repo };
}

describe('PracticeFacade', () => {
  it('corrige cada ítem, bloquea la doble respuesta y calcula el resultado final', async () => {
    const { player, repo } = setup();
    await player.open('a1');
    await player.check(['goes']);
    expect(await player.check(['go'])).toBeNull(); // Ya corregido: no se reenvía
    expect(repo.submit).toHaveBeenCalledTimes(1);
    player.next();
    await player.check(['go']);
    player.next();
    expect(player.done()).toBe(true);
    expect(player.score()).toBe(50);
  });
});

describe('ActivityBuilderFacade', () => {
  it('crear desde un borrador de IA envía aiDraft y los ítems', async () => {
    const { builder, repo } = setup();
    const items = [{ itemType: 'open_answer' as const, skill: 'grammar' as const, prompt: 'Describe your day', options: [], accepted: [['I get up']], explanation: '', tip: '' }];
    const a = await builder.create({ title: 'Mi día', description: '', language: 'en', level: 'A2', skill: 'grammar' }, items, true);
    expect(a?.id).toBe('a2');
    expect(repo.createActivity).toHaveBeenCalledWith(expect.objectContaining({ aiDraft: true, items }));
  });
});

describe('Reglas puras de práctica', () => {
  it('huecos, izquierdas y palabras', () => {
    expect(blanksOf('I ___ to the ___')).toHaveLength(3);
    expect(leftItems('dog\n cat \n\n')).toEqual(['dog', 'cat']);
    expect(words('She go  to school')).toEqual(['She', 'go', 'to', 'school']);
  });

  it('itemProblem es espejo de la Specification de NestJS', () => {
    expect(itemProblem({ itemType: 'multiple_choice', prompt: '?', options: ['a'], accepted: [['a']] })).toContain('dos opciones');
    expect(itemProblem({ itemType: 'multiple_choice', prompt: '?', options: ['a', 'b'], accepted: [['c']] })).toContain('una de las opciones');
    expect(itemProblem({ itemType: 'drag_order', prompt: '', options: ['a', 'b'], accepted: [['b', 'a']] })).toBeNull();
    expect(itemProblem({ itemType: 'mark_errors', prompt: 'She go home', options: [], accepted: [['1']] })).toBeNull();
    expect(itemProblem({ itemType: 'mark_errors', prompt: 'She go home', options: [], accepted: [['7']] })).toContain('índices');
  });

  it('editor: texto ⇄ contrato (huecos con variantes «|», marcar errores con correcciones)', () => {
    const fb = toInput({ itemType: 'fill_blank', skill: 'grammar', prompt: 'She ___ (go)', options: '', accepted: 'goes | is going', corrections: '', explanation: '', tip: '' });
    expect(fb.accepted).toEqual([['goes', 'is going']]);
    const me = toInput({ itemType: 'mark_errors', skill: 'grammar', prompt: 'She go home', options: '', accepted: '1', corrections: '1=goes', explanation: '', tip: '' });
    expect(me.accepted).toEqual([['1']]);
    expect(me.corrections).toEqual({ '1': 'goes' });
    expect(toText({ ...me, id: 'i', position: 0, corrections: { '1': 'goes' } }).corrections).toBe('1=goes');
  });
});
