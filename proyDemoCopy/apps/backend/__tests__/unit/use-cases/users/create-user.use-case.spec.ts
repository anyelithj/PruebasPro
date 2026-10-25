import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
// [Mock bcrypt]: evita hashing real
jest.mock('bcrypt', () => ({ hash: jest.fn() }));
import { CreateUserUseCase } from '../../../../src/modules/users/application/use-cases/create-user.use-case';
import { Role } from '../../../../src/modules/users/domain/value-objects/role.vo';

// [Suite CreateUserUseCase]: único dueño del alta de User — email normalizado, unicidad, hash y rol por defecto

describe('CreateUserUseCase', () => {
  let repo: { findByEmail: jest.Mock; create: jest.Mock };
  let useCase: CreateUserUseCase;
  const cmd = {
    email: 'NEW@Test.IO',
    password: 'StrongP@ss123',
    firstName: '  Ana  ',
    lastName: '  Lopez  ',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repo = {
      findByEmail: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'u1' }),
    };
    useCase = new CreateUserUseCase(
      repo as any,
      { bcryptSaltRounds: 4 } as any,
    );
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
  });

  it('normaliza email y nombres, hashea con el saltRounds de la config y usa USER por defecto', async () => {
    repo.findByEmail.mockResolvedValue(null);

    await useCase.execute(cmd);

    expect(repo.findByEmail).toHaveBeenCalledWith('new@test.io');
    expect(bcrypt.hash).toHaveBeenCalledWith(cmd.password, 4);
    expect(repo.create).toHaveBeenCalledWith({
      email: 'new@test.io',
      passwordHash: 'hashed',
      firstName: 'Ana',
      lastName: 'Lopez',
      role: Role.USER,
      section: null,
      phone: null, // [2026-10-24]: teléfono opcional
    });
  });

  it('lanza Conflict si el email ya existe y no hashea', async () => {
    repo.findByEmail.mockResolvedValue({ id: 'u0' });
    await expect(useCase.execute(cmd)).rejects.toThrow(ConflictException);
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });
});
