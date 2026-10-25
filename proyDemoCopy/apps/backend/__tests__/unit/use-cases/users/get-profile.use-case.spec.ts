import { NotFoundException } from '@nestjs/common';
import { GetProfileUseCase } from '../../../../src/modules/users/application/use-cases/get-profile.use-case';
import { Role } from '../../../../src/modules/users/domain/value-objects/role.vo';

// [Suite GetProfileUseCase]: retorna perfil del usuario autenticado | [Patrón]: Query | [Principio]: SRP

describe('GetProfileUseCase', () => {
  let useCase: GetProfileUseCase;
  let repo: { findById: jest.Mock };

  const existingUser = {
    id: 'u1',
    email: 'test@neuroedu.ia',
    firstName: 'Juan',
    lastName: 'Pérez',
    role: Role.USER,
    section: '11-1',
    isActive: true,
    createdAt: new Date('2025-01-01'),
  };

  beforeEach(() => {
    repo = { findById: jest.fn() };
    // [DataSource falso]: estadísticas (cursos inscritos + nivel MCER) | [Patrón]: Test Double
    const db = { query: jest.fn().mockResolvedValue([{ enrolled: '2', cert: null, course: 'B1' }]) };
    useCase = new GetProfileUseCase(repo as any, db as any);
  });

  it('retorna perfil cuando el usuario existe', async () => {
    repo.findById.mockResolvedValue(existingUser);
    const result = await useCase.execute('u1');
    expect(result).toMatchObject({
      id: 'u1',
      email: 'test@neuroedu.ia',
      firstName: 'Juan',
      lastName: 'Pérez',
      role: Role.USER,
      enrolledCourses: 2,
      level: 'B1',
    });
    expect(repo.findById).toHaveBeenCalledWith('u1');
  });

  it('lanza NotFoundException cuando el usuario no existe', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('u404')).rejects.toThrow(NotFoundException);
  });

  it('retorna section como null si no tiene sección', async () => {
    repo.findById.mockResolvedValue({ ...existingUser, section: null });
    const result = await useCase.execute('u1');
    expect(result.section).toBeNull();
  });
});
