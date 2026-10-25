import { NotFoundException } from '@nestjs/common';
import { UpdateProfileUseCase } from '../../../../src/modules/users/application/use-cases/update-profile.use-case';
import { Role } from '../../../../src/modules/users/domain/value-objects/role.vo';

// [Suite UpdateProfileUseCase]: actualiza nombre, apellido y sección | [Patrón]: Command | [Principio]: SRP

describe('UpdateProfileUseCase', () => {
  let useCase: UpdateProfileUseCase;
  let repo: { findById: jest.Mock; update: jest.Mock };

  const existingUser = {
    id: 'u1',
    email: 'test@neuroedu.ia',
    firstName: 'Juan',
    lastName: 'Pérez',
    role: Role.USER,
    section: '11-1',
    isActive: true,
    createdAt: new Date(),
  };

  beforeEach(() => {
    repo = { findById: jest.fn(), update: jest.fn() };
    useCase = new UpdateProfileUseCase(repo as any);
  });

  it('actualiza firstName y lastName', async () => {
    repo.findById.mockResolvedValue(existingUser);
    repo.update.mockResolvedValue({
      ...existingUser,
      firstName: 'Carlos',
      lastName: 'López',
    });

    const result = await useCase.execute('u1', {
      firstName: 'Carlos',
      lastName: 'López',
    });
    expect(result.firstName).toBe('Carlos');
    expect(result.lastName).toBe('López');
    expect(repo.update).toHaveBeenCalledWith('u1', {
      firstName: 'Carlos',
      lastName: 'López',
    });
  });

  it('actualiza section', async () => {
    repo.findById.mockResolvedValue(existingUser);
    repo.update.mockResolvedValue({ ...existingUser, section: '11-2' });

    const result = await useCase.execute('u1', { section: '11-2' });
    expect(result.section).toBe('11-2');
  });

  it('lanza NotFoundException si usuario no existe', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('u404', { firstName: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('sanea espacios en firstName y lastName', async () => {
    repo.findById.mockResolvedValue(existingUser);
    repo.update.mockResolvedValue({
      ...existingUser,
      firstName: 'Ana',
      lastName: 'Ríos',
    });

    await useCase.execute('u1', { firstName: '  Ana  ', lastName: '  Ríos  ' });
    expect(repo.update).toHaveBeenCalledWith('u1', {
      firstName: 'Ana',
      lastName: 'Ríos',
    });
  });

  it('convierte section vacía a null', async () => {
    repo.findById.mockResolvedValue(existingUser);
    repo.update.mockResolvedValue({ ...existingUser, section: null });

    await useCase.execute('u1', { section: '' });
    expect(repo.update).toHaveBeenCalledWith('u1', { section: null });
  });
});
