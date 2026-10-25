import { NotFoundException } from '@nestjs/common';
import { GetUserHistoryUseCase } from '../../../../src/modules/users/application/use-cases/get-user-history.use-case';
import { Role } from '../../../../src/modules/users/domain/value-objects/role.vo';

// [Suite GetUserHistoryUseCase]: perfil del usuario para historial | [Patrón]: Query | [Principio]: SRP

describe('GetUserHistoryUseCase', () => {
  let useCase: GetUserHistoryUseCase;
  let repo: { findById: jest.Mock };

  const existingUser = {
    id: 'u1',
    email: 'hist@neuroedu.ia',
    firstName: 'Hist',
    lastName: 'User',
    role: Role.USER,
    section: '11-1',
    isActive: true,
    createdAt: new Date('2025-06-01'),
  };

  beforeEach(() => {
    repo = { findById: jest.fn() };
    useCase = new GetUserHistoryUseCase(repo as any);
  });

  it('retorna perfil del usuario existente', async () => {
    repo.findById.mockResolvedValue(existingUser);
    const result = await useCase.execute('u1');
    expect(result).toMatchObject({
      id: 'u1',
      email: 'hist@neuroedu.ia',
      firstName: 'Hist',
      lastName: 'User',
      role: Role.USER,
    });
    expect(repo.findById).toHaveBeenCalledWith('u1');
  });

  it('lanza NotFoundException si el usuario no existe', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('u404')).rejects.toThrow(NotFoundException);
  });

  it('retorna isActive true para usuario activo', async () => {
    repo.findById.mockResolvedValue(existingUser);
    const result = await useCase.execute('u1');
    expect(result.isActive).toBe(true);
  });
});
