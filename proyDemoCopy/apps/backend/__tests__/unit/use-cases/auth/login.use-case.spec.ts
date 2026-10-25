import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
// [Mock bcrypt]: evita hashing real y permite controlar compare por test
jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));
import { LoginUseCase } from '../../../../src/modules/auth/application/use-cases/login.use-case';
import { Role } from '../../../../src/modules/users/domain/value-objects/role.vo';
import { USER_LOGGED_IN_EVENT } from '../../../../src/modules/auth/domain/events/user-logged-in.event';

// [Suite LoginUseCase]: valida credenciales, emite tokens, crea sesión y dispara evento

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let users: { findByEmail: jest.Mock; findById: jest.Mock };
  let authRepo: {
    createSession: jest.Mock;
    findActiveByHash: jest.Mock;
    revoke: jest.Mock;
  };
  let tokens: {
    issuePair: jest.Mock;
    verifyRefresh: jest.Mock;
    hashRefresh: jest.Mock;
  };
  let events: { emit: jest.Mock };

  const activeUser = {
    id: 'u1',
    email: 'user@test.io',
    passwordHash: 'hashed',
    firstName: 'Ana',
    lastName: 'Lopez',
    role: Role.USER,
    isActive: true,
    isEmailVerified: true,
  };

  const pair = {
    accessToken: 'acc',
    refreshToken: 'ref',
    accessExpiresIn: 900,
    tokenType: 'Bearer',
  };

  beforeEach(() => {
    users = { findByEmail: jest.fn(), findById: jest.fn() };
    authRepo = {
      createSession: jest.fn(),
      findActiveByHash: jest.fn(),
      revoke: jest.fn(),
    };
    tokens = {
      issuePair: jest.fn(),
      verifyRefresh: jest.fn(),
      hashRefresh: jest.fn(),
    };
    events = { emit: jest.fn() };

    useCase = new LoginUseCase(
      users as any,
      authRepo as any,
      tokens,
      events as any,
    );

    tokens.issuePair.mockResolvedValue(pair);
    tokens.hashRefresh.mockReturnValue('refhash');
    tokens.verifyRefresh.mockResolvedValue({ exp: 2000000000 });
    authRepo.createSession.mockResolvedValue({ id: 's1' });
  });

  it('login exitoso: emite tokens, crea sesión y dispara evento', async () => {
    users.findByEmail.mockResolvedValue(activeUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const res = await useCase.execute(
      { email: activeUser.email, password: 'plain' },
      { ipAddress: '1.1.1.1', userAgent: 'jest' },
    );

    expect(res.accessToken).toBe('acc');
    expect(res.user.email).toBe(activeUser.email);
    expect(tokens.issuePair).toHaveBeenCalledWith({
      userId: activeUser.id,
      email: activeUser.email,
      role: activeUser.role,
    });
    expect(authRepo.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', refreshTokenHash: 'refhash' }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      USER_LOGGED_IN_EVENT,
      expect.objectContaining({ userId: 'u1', sessionId: 's1' }),
    );
  });

  it('lanza Unauthorized si el usuario no existe', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(
      useCase.execute({ email: 'x@x.io', password: 'p' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(tokens.issuePair).not.toHaveBeenCalled();
  });

  it('lanza Unauthorized si el usuario está inactivo', async () => {
    users.findByEmail.mockResolvedValue({ ...activeUser, isActive: false });
    await expect(
      useCase.execute({ email: activeUser.email, password: 'p' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('lanza Unauthorized si la contraseña no coincide', async () => {
    users.findByEmail.mockResolvedValue(activeUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(
      useCase.execute({ email: activeUser.email, password: 'bad' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(authRepo.createSession).not.toHaveBeenCalled();
  });
});
