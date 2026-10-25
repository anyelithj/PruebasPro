import { ConflictException, ForbiddenException } from '@nestjs/common';
import { CefrLevel } from '../../../src/shared/domain/cefr-level.vo';
import { Language } from '../../../src/shared/domain/language.vo';
import { LanguageSkill } from '../../../src/shared/domain/language-skill.vo';
import { Role } from '../../../src/modules/users/domain/value-objects/role.vo';
import { buildTree, flattenOutline, nextLessonId, summarize, withProgress } from '../../../src/modules/curriculum/domain/course-outline';
import { CourseNodeType, childTypeOf } from '../../../src/modules/curriculum/domain/value-objects/course-node-type.vo';
import { CurriculumItemKind } from '../../../src/modules/curriculum/domain/value-objects/curriculum-item-kind.vo';
import { ReviewStatus } from '../../../src/modules/curriculum/domain/value-objects/review-status.vo';
import { Provenance } from '../../../src/modules/curriculum/domain/value-objects/provenance.vo';
import { SaveCourseOutlineCommand } from '../../../src/modules/curriculum/application/commands/save-course-outline.command';
import { FillLessonGapCommand } from '../../../src/modules/curriculum/application/commands/fill-lesson-gap.command';
import { CompleteLessonCommand } from '../../../src/modules/curriculum/application/commands/complete-lesson.command';
import { GetCourseOutlineQuery } from '../../../src/modules/curriculum/application/queries/get-course-outline.query';

// [Suite Etapa 3 · Jerarquía de curso]: estructura primero, reutilizar lo existente y generar solo huecos

const teacher = { id: 't1', role: Role.TEACHER };
const student = { id: 's1', role: Role.USER };
const lesson = (title: string, topic: string) => ({ title, topic, kind: CurriculumItemKind.VOCABULARY, skill: LanguageSkill.VOCABULARY });
const outline = [
  { level: CefrLevel.A1, modules: [{ title: 'Primeros pasos', units: [{ title: 'Saludos', lessons: [lesson('Hola', 'saludos'), lesson('Familia', 'familia')] }] }] },
];

describe('Esquema del curso (dominio)', () => {
  it('la jerarquía es nivel → módulo → unidad → lección', () => {
    expect(childTypeOf(CourseNodeType.LEVEL)).toBe(CourseNodeType.MODULE);
    expect(childTypeOf(CourseNodeType.UNIT)).toBe(CourseNodeType.LESSON);
    expect(childTypeOf(CourseNodeType.LESSON)).toBeNull();
  });

  it('aplana padre antes que hijos y copia el nivel MCER a toda la rama', () => {
    const nodes = flattenOutline(outline);
    expect(nodes.map((n) => n.type)).toEqual(['level', 'module', 'unit', 'lesson', 'lesson']);
    expect(nodes[0]).toMatchObject({ ref: '0', parentRef: null, title: 'Nivel A1' });
    expect(nodes[4]).toMatchObject({ ref: '0.0.0.1', parentRef: '0.0.0', level: CefrLevel.A1, topic: 'familia' });
  });

  it('arma el árbol ordenado y marca como hueco la lección sin recursos', () => {
    const stored = flattenOutline(outline).map((n) => ({ ...n, id: n.ref, parentId: n.parentRef, items: n.ref === '0.0.0.0' ? [{ id: 'i1', key: 'hola', kind: CurriculumItemKind.VOCABULARY, reviewStatus: ReviewStatus.APPROVED }] : [] }));
    const tree = buildTree(stored);
    const lessons = tree[0].children[0].children[0].children;
    expect(lessons.map((l) => [l.title, l.gap])).toEqual([['Hola', false], ['Familia', true]]);
    expect(summarize(tree)).toEqual({ lessons: 2, gaps: 1, completed: 0 });
  });
});

// [Dobles de prueba]: puertos con jest.fn → la capa de aplicación se prueba sin BD ni LLM | [Patrón]: Test Double
function makePorts() {
  const outlines = {
    findCourse: jest.fn().mockResolvedValue({ id: 'c1', language: Language.EN }),
    saveOutline: jest.fn().mockResolvedValue(undefined),
    findLessonItems: jest.fn().mockResolvedValue([]),
    completedLessonIds: jest.fn().mockResolvedValue([]),
    completeLesson: jest.fn().mockResolvedValue(undefined),
    findOutline: jest.fn().mockResolvedValue([]),
    findLesson: jest.fn(),
    addLessonItems: jest.fn().mockResolvedValue(undefined),
  };
  const items = { search: jest.fn() };
  return { outlines, items };
}

describe('Línea de tiempo (progreso)', () => {
  const stored = flattenOutline(outline).map((n) => ({ ...n, id: n.ref, parentId: n.parentRef, items: [] }));

  it('la siguiente lección es la primera sin completar, en el orden del curso', () => {
    const tree = buildTree(stored);
    expect(nextLessonId(withProgress(tree, new Set()))).toBe('0.0.0.0');
    expect(nextLessonId(withProgress(tree, new Set(['0.0.0.0'])))).toBe('0.0.0.1');
    expect(nextLessonId(withProgress(tree, new Set(['0.0.0.0', '0.0.0.1'])))).toBeNull(); // Curso terminado
    expect(summarize(withProgress(tree, new Set(['0.0.0.0'])))).toMatchObject({ completed: 1 });
  });

  it('conserva el id de un nodo existente para no perder el progreso al editar', () => {
    const withIds = flattenOutline([{ ...outline[0], id: 'lv-1' }]);
    expect(withIds[0]).toMatchObject({ id: 'lv-1', ref: '0' });
    expect(withIds[1].id).toBeNull(); // Nodo nuevo
  });

  it('la vista de lección trae ruta, posición y navegación; completar devuelve la siguiente', async () => {
    const { outlines } = makePorts();
    outlines.findOutline.mockResolvedValue(stored);
    const query = new GetCourseOutlineQuery(outlines as never);
    const view = await query.lesson('c1', '0.0.0.1', student);
    expect(view).toMatchObject({ path: ['Nivel A1', 'Primeros pasos', 'Saludos'], position: { index: 2, total: 2 }, prevLessonId: '0.0.0.0', nextLessonId: null });

    outlines.completedLessonIds.mockResolvedValueOnce([]).mockResolvedValueOnce(['0.0.0.0']); // antes y después de completar
    const res = await new CompleteLessonCommand(outlines as never, query).execute('c1', '0.0.0.0', student);
    expect(outlines.completeLesson).toHaveBeenCalledWith('s1', '0.0.0.0');
    expect(res).toEqual({ lessonId: '0.0.0.0', nextLessonId: '0.0.0.1' });
  });
});

describe('SaveCourseOutlineCommand', () => {
  it('reutiliza los recursos existentes del mismo idioma, nivel, tipo y tema (sin archivados)', async () => {
    const { outlines, items } = makePorts();
    items.search.mockImplementation(({ topic }: { topic: string }) => Promise.resolve({ data: topic === 'saludos' ? [{ id: 'i1' }] : [] }));
    const cmd = new SaveCourseOutlineCommand(outlines as never, items as never, new GetCourseOutlineQuery(outlines as never));
    await cmd.execute('c1', { levels: outline }, teacher);

    expect(items.search).toHaveBeenCalledWith(expect.objectContaining({ language: Language.EN, level: CefrLevel.A1, topic: 'saludos', kind: CurriculumItemKind.VOCABULARY }));
    expect(items.search.mock.calls[0][0].statuses).not.toContain(ReviewStatus.ARCHIVED);
    const links: Map<string, string[]> = outlines.saveOutline.mock.calls[0][2];
    expect(links.get('0.0.0.0')).toEqual(['i1']); // «Hola» reutiliza
    expect(links.get('0.0.0.1')).toEqual([]); // «Familia» queda como hueco
  });

  it('un estudiante no puede editar la estructura', async () => {
    const { outlines, items } = makePorts();
    await expect(new SaveCourseOutlineCommand(outlines as never, items as never, {} as never).execute('c1', { levels: outline }, student)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('FillLessonGapCommand', () => {
  const emptyLesson = { id: 'l1', parentId: 'u1', type: CourseNodeType.LESSON, title: 'Familia', position: 1, level: CefrLevel.A1, topic: 'familia', kind: CurriculumItemKind.VOCABULARY, skill: LanguageSkill.VOCABULARY, items: [] };

  it('no genera nada si la lección ya tiene recursos (solo huecos)', async () => {
    const { outlines } = makePorts();
    outlines.findLesson.mockResolvedValue({ ...emptyLesson, items: [{ id: 'i9' }] });
    const drafts = { execute: jest.fn() };
    const res = await new FillLessonGapCommand(outlines as never, drafts as never, {} as never).execute('c1', 'l1', {}, teacher);
    expect(res).toEqual({ lessonId: 'l1', reused: 1, created: 0 });
    expect(drafts.execute).not.toHaveBeenCalled();
  });

  it('lección vacía: genera con el pipeline, crea en estado GENERATED (provenance IA) y omite claves repetidas', async () => {
    const { outlines } = makePorts();
    outlines.findLesson.mockResolvedValue(emptyLesson);
    const drafts = { execute: jest.fn().mockResolvedValue({ strategy: 'llm', llmRequired: true, generationId: 'g1', drafts: [{ content: { word: 'mother' } }, { content: { word: 'father' } }] }) };
    const createItem = { execute: jest.fn().mockResolvedValueOnce({ id: 'n1' }).mockRejectedValueOnce(new ConflictException('dup')) };
    const res = await new FillLessonGapCommand(outlines as never, drafts as never, createItem as never).execute('c1', 'l1', { count: 2 }, teacher);

    expect(drafts.execute).toHaveBeenCalledWith(expect.objectContaining({ language: Language.EN, level: CefrLevel.A1, topic: 'familia', count: 2 }), 't1');
    expect(createItem.execute.mock.calls[0][0]).toMatchObject({ provenance: Provenance.GENERATED, generationId: 'g1', topic: 'familia' });
    expect(createItem.execute.mock.calls[0][0].key).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/); // Clave válida para el DTO
    expect(outlines.addLessonItems).toHaveBeenCalledWith('l1', ['n1']);
    expect(res).toMatchObject({ created: 1, strategy: 'llm', llmRequired: true });
  });

  it('si el pipeline encuentra un recurso existente, lo enlaza sin crear nada', async () => {
    const { outlines } = makePorts();
    outlines.findLesson.mockResolvedValue(emptyLesson);
    const drafts = { execute: jest.fn().mockResolvedValue({ strategy: 'existing', llmRequired: false, existingItemId: 'old', drafts: [] }) };
    const createItem = { execute: jest.fn() };
    const res = await new FillLessonGapCommand(outlines as never, drafts as never, createItem as never).execute('c1', 'l1', {}, teacher);
    expect(outlines.addLessonItems).toHaveBeenCalledWith('l1', ['old']);
    expect(createItem.execute).not.toHaveBeenCalled();
    expect(res).toMatchObject({ reused: 1, created: 0 });
  });
});
