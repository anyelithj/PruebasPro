import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { DeleteAccountUseCase } from '../../../../src/modules/users/application/use-cases/delete-account.use-case';
import { Role } from '../../../../src/modules/users/domain/value-objects/role.vo';

// [Suite DeleteAccountUseCase]: soft-delete de cuenta propia | [Patrón]: Command | [Principio]: SRP

describe('DeleteAccountUseCase', () => {
  let useCase: DeleteAccountUseCase;
  let repo: { findById: jest.Mock; deactivate: jest.Mock };

  const activeUser = {
    id: 'u1',
    email: 'del@neuroedu.ia',
    firstName: 'Del',
    lastName: 'User',
    role: Role.USER,
    isActive: true,
  };

  const inactiveUser = { ...activeUser, isActive: false };

  beforeEach(() => {
    repo = { findById: jest.fn(), deactivate: jest.fn() };
    useCase = new DeleteAccountUseCase(repo as any);
  });

  it('desactiva usuario activo', async () => {
    repo.findById.mockResolvedValue(activeUser);
    await useCase.execute('u1');
    expect(repo.deactivate).toHaveBeenCalledWith('u1');
  });

  it('lanza NotFoundException si usuario no existe', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('u404')).rejects.toThrow(NotFoundException);
    expect(repo.deactivate).not.toHaveBeenCalled();
  });

  it('lanza ForbiddenException si ya está desactivado', async () => {
    repo.findById.mockResolvedValue(inactiveUser);
    await expect(useCase.execute('u1')).rejects.toThrow(ForbiddenException);
    expect(repo.deactivate).not.toHaveBeenCalled();
  });
});
