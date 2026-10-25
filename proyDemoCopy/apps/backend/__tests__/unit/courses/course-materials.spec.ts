import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../../src/modules/users/domain/value-objects/role.vo';
import { LocalFileStorage } from '../../../src/modules/courses/infrastructure/storage/local-file.storage';
import { CourseMaterialsUseCase, materialMime } from '../../../src/modules/courses/application/use-cases/course-materials.use-case';
import { FakeFileStorage } from './fake-file.storage';
// [Suite materiales de curso]: seguridad de rutas + compensación si la subida no es válida | [Patrón]: Test Double (Stub)

const storage = new LocalFileStorage(new ConfigService({ UPLOADS_DIR: join(tmpdir(), 'qa-uploads') }));

describe('LocalFileStorage', () => {
  it('rechaza path traversal al abrir o borrar', async () => {
    expect(storage.directory).toContain('course-materials');
    await expect(storage.open('../../etc/passwd')).rejects.toThrow(/inválida/);
    await expect(storage.remove('../../etc/passwd')).rejects.toThrow(/inválida/);
  });
});

describe('CourseMaterialsUseCase.upload', () => {
  // `as never` (TS): stubs mínimos de Repository (solo lo que usa el caso de uso)
  const materials = { count: jest.fn(), save: jest.fn(), create: jest.fn((x) => x) } as never;
  const courses = { exists: jest.fn().mockResolvedValue(true) } as never;
  const fakeStorage = new FakeFileStorage();
  const useCase = new CourseMaterialsUseCase(materials, courses, {} as never, fakeStorage);

  it('rechaza tipos no permitidos y borra el archivo subido', async () => {
    fakeStorage.pending.set('f1', Buffer.from('MZ'));
    await expect(useCase.upload('c1', { filename: 'f1', originalname: 'virus.exe', mimetype: 'application/x-msdownload', size: 10 }, undefined)).rejects.toThrow(/no permitido/);
    expect(fakeStorage.pending.has('f1')).toBe(false); // [Compensación]: no quedan binarios huérfanos
  });

  it('guarda el binario con su tipo y el registro con la misma clave', async () => {
    fakeStorage.pending.set('f2', Buffer.from('%PDF-1.4'));
    await useCase.upload('c1', { filename: 'f2', originalname: 'guia.pdf', mimetype: 'application/pdf', size: 8 }, 'Guía');
    expect(fakeStorage.objects.get('f2')?.contentType).toBe('application/pdf');
  });
});

describe('CourseMaterialsUseCase.download (Sprint 6.7)', () => {
  const material = { id: 'm1', courseId: 'c1', storageKey: 'k1', originalName: 'clase 1.mp4', mimeType: 'video/mp4', sizeBytes: '10' };
  const make = (storage: FakeFileStorage) =>
    new CourseMaterialsUseCase({ findOne: jest.fn().mockResolvedValue(material) } as never, {} as never, { findOne: jest.fn().mockResolvedValue(null) } as never, storage);
  const admin = { id: 'a', role: Role.ADMIN };

  it('S3/R2 → URL firmada inline (el navegador descarga del bucket)', async () => {
    const { source } = await make(new FakeFileStorage(true)).download('c1', 'm1', admin);
    expect(source!.signedUrl).toContain('disposition=inline');
  });

  it('disco → sin URL firmada, se sirve el rango pedido', async () => {
    const storage = new FakeFileStorage(false);
    storage.objects.set('k1', { data: Buffer.from('0123456789'), contentType: 'video/mp4' });
    const { source } = await make(storage).download('c1', 'm1', admin);
    expect(source!.signedUrl).toBeNull();
    const chunks: Buffer[] = [];
    for await (const c of await source!.open({ start: 2, end: 4 })) chunks.push(c as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe('234');
  });
});

describe('materialMime', () => {
  it('deduce el PDF por extensión cuando el navegador lo envía sin tipo', () => {
    expect(materialMime('application/octet-stream', 'guia.PDF')).toBe('application/pdf');
    expect(materialMime('video/mp4', 'x.bin')).toBe('video/mp4');
    expect(materialMime('application/octet-stream', 'virus.exe')).toBeUndefined();
  });
});

describe('CourseMaterialsUseCase.assertAccess', () => {
  // [Stubs]: curso existente y matrícula configurable
  const courses = { exists: jest.fn().mockResolvedValue(true) } as never;
  const enrollments = { findOne: jest.fn() };
  const useCase = new CourseMaterialsUseCase({} as never, courses, enrollments as never, {} as never);

  it('ADMIN siempre accede', async () => {
    enrollments.findOne.mockResolvedValueOnce(null);
    await expect(useCase.assertAccess('c1', { id: 'a', role: Role.ADMIN })).resolves.toBeNull();
  });
  it('sin compra ni inscripción → 403 (también en cursos gratis)', async () => {
    enrollments.findOne.mockResolvedValueOnce(null);
    await expect(useCase.assertAccess('c1', { id: 'u', role: Role.USER })).rejects.toThrow(/inscríbete/);
  });
  it('comprado o inscrito → acceso', async () => {
    enrollments.findOne.mockResolvedValueOnce({ id: 'e', purchasedAt: new Date() });
    await expect(useCase.assertAccess('c1', { id: 'u', role: Role.USER })).resolves.toMatchObject({ id: 'e' });
  });
});

describe('CourseMaterialsUseCase.complete', () => {
  it('marca el material y recalcula el progreso (1 de 2 → 50%, idempotente)', async () => {
    const enrollment = { id: 'e', purchasedAt: new Date(), completedMaterialIds: [] as string[], progress: 0, completedAt: null };
    const save = jest.fn();
    const materials = { find: jest.fn().mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]) } as never;
    const courses = { exists: jest.fn().mockResolvedValue(true) } as never;
    const enrollments = { findOne: jest.fn().mockResolvedValue(enrollment), save } as never;
    const useCase = new CourseMaterialsUseCase(materials, courses, enrollments, {} as never);
    await expect(useCase.complete('c1', 'm1', { id: 'u', role: Role.USER })).resolves.toEqual({ completedMaterialIds: ['m1'], progress: 50 });
    await expect(useCase.complete('c1', 'm1', { id: 'u', role: Role.USER })).resolves.toEqual({ completedMaterialIds: ['m1'], progress: 50 });
    await expect(useCase.complete('c1', 'm2', { id: 'u', role: Role.USER })).resolves.toMatchObject({ progress: 100 });
    expect(save).toHaveBeenCalledTimes(3);
  });
});
