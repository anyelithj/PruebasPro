import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenUseCase } from '../../../../src/modules/auth/application/use-cases/refresh-token.use-case';
import { Role } from '../../../../src/modules/users/domain/value-objects/role.vo';

// [Suite RefreshTokenUseCase]: rota refresh (one-time use), valida sesión y usuario activo

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  let users: { findById: jest.Mock };
  let authRepo: {
    findActiveByHash: jest.Mock;
    revoke: jest.Mock;
    createSession: jest.Mock;
  };
  let tokens: {
    verifyRefresh: jest.Mock;
    hashRefresh: jest.Mock;
    issuePair: jest.Mock;
  };

  const user = {
    id: 'u1',
    email: 'user@test.io',
    firstName: 'Ana',
    lastName: 'Lopez',
    role: Role.USER,
    isActive: true,
    isEmailVerified: true,
  };

  const activeSession = {
    id: 's1',
    isRevoked: false,
    expiresAt: new Date(Date.now() + 100000),
  };

  const pair = {
    accessToken: 'acc2',
    refreshToken: 'ref2',
    accessExpiresIn: 900,
    tokenType: 'Bearer',
  };

  beforeEach(() => {
    users = { findById: jest.fn() };
    authRepo = {
      findActiveByHash: jest.fn(),
      revoke: jest.fn(),
      createSession: jest.fn(),
    };
    tokens = {
      verifyRefresh: jest.fn(),
      hashRefresh: jest.fn(),
      issuePair: jest.fn(),
    };

    useCase = new RefreshTokenUseCase(users as any, authRepo as any, tokens);

    tokens.verifyRefresh.mockResolvedValue({ userId: 'u1', exp: 2000000000 });
    tokens.hashRefresh.mockReturnValue('refhash');
    tokens.issuePair.mockResolvedValue(pair);
    authRepo.findActiveByHash.mockResolvedValue(activeSession);
    authRepo.createSession.mockResolvedValue({ id: 's2' });
    users.findById.mockResolvedValue(user);
  });

  it('rota correctamente: revoca la sesión actual y crea una nueva', async () => {
    const res = await useCase.execute(
      { refreshToken: 'ref' },
      { ipAddress: '2.2.2.2' },
    );

    expect(authRepo.revoke).toHaveBeenCalledWith('s1');
    expect(authRepo.createSession).toHaveBeenCalled();
    expect(res.accessToken).toBe('acc2');
    expect(res.user.id).toBe('u1');
  });

  it('lanza Unauthorized si la verificación del refresh token falla', async () => {
    tokens.verifyRefresh.mockRejectedValueOnce(new Error('bad sig'));
    await expect(useCase.execute({ refreshToken: 'bad' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza Unauthorized si la sesión no existe', async () => {
    authRepo.findActiveByHash.mockResolvedValue(null);
    await expect(useCase.execute({ refreshToken: 'ref' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza Unauthorized si la sesión está revocada', async () => {
    authRepo.findActiveByHash.mockResolvedValue({
      ...activeSession,
      isRevoked: true,
    });
    await expect(useCase.execute({ refreshToken: 'ref' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza Unauthorized si la sesión está expirada', async () => {
    authRepo.findActiveByHash.mockResolvedValue({
      ...activeSession,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(useCase.execute({ refreshToken: 'ref' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza Unauthorized si el usuario está inactivo', async () => {
    users.findById.mockResolvedValue({ ...user, isActive: false });
    await expect(useCase.execute({ refreshToken: 'ref' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(authRepo.revoke).not.toHaveBeenCalled();
  });
});
