import { ConflictException } from '@nestjs/common';
import { RegisterUseCase } from '../../../../src/modules/auth/application/use-cases/register.use-case';
import { Role } from '../../../../src/modules/users/domain/value-objects/role.vo';
import { USER_REGISTERED_EVENT } from '../../../../src/modules/auth/domain/events/user-registered.event';

// [Suite RegisterUseCase]: delega el alta en CreateUserUseCase, crea sesión y emite evento

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let createUser: { execute: jest.Mock };
  let authRepo: { createSession: jest.Mock };
  let tokens: {
    issuePair: jest.Mock;
    verifyRefresh: jest.Mock;
    hashRefresh: jest.Mock;
  };
  let events: { emit: jest.Mock };

  const dto = {
    email: 'NEW@Test.IO',
    password: 'StrongP@ss123',
    firstName: '  Ana  ',
    lastName: '  Lopez  ',
  };

  const createdUser = {
    id: 'u1',
    email: 'new@test.io',
    firstName: 'Ana',
    lastName: 'Lopez',
    role: Role.USER,
    isEmailVerified: false,
  };

  const pair = {
    accessToken: 'acc',
    refreshToken: 'ref',
    accessExpiresIn: 900,
    tokenType: 'Bearer',
  };

  beforeEach(() => {
    createUser = { execute: jest.fn() };
    authRepo = { createSession: jest.fn() };
    tokens = {
      issuePair: jest.fn(),
      verifyRefresh: jest.fn(),
      hashRefresh: jest.fn(),
    };
    events = { emit: jest.fn() };

    useCase = new RegisterUseCase(
      createUser as any,
      authRepo as any,
      tokens,
      events as any,
    );

    createUser.execute.mockResolvedValue(createdUser);
    tokens.issuePair.mockResolvedValue(pair);
    tokens.hashRefresh.mockReturnValue('refhash');
    tokens.verifyRefresh.mockResolvedValue({ exp: 2000000000 });
    authRepo.createSession.mockResolvedValue({ id: 's1' });
  });

  it('registro exitoso: delega el alta con rol USER, crea sesión y emite evento', async () => {
    const res = await useCase.execute(dto, { userAgent: 'jest' });

    // [Rol seguro]: el registro público siempre crea USER
    expect(createUser.execute).toHaveBeenCalledWith({
      ...dto,
      role: Role.USER,
    });
    expect(authRepo.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        refreshTokenHash: 'refhash',
        userAgent: 'jest',
      }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      USER_REGISTERED_EVENT,
      expect.objectContaining({ userId: 'u1', email: 'new@test.io' }),
    );
    expect(res.accessToken).toBe('acc');
    expect(res.user.isEmailVerified).toBe(false);
  });

  it('propaga Conflict si el email ya está registrado y no crea sesión', async () => {
    createUser.execute.mockRejectedValue(
      new ConflictException('Email already registered'),
    );
    await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
    expect(authRepo.createSession).not.toHaveBeenCalled();
  });
});
