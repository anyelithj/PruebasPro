// [TDD][SRP] prueba AuthService con repos fake en memoria + TokenService real
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from 'src/module/auth/service/auth.service';
import { TokenService } from 'src/module/auth/service/token.service';
import { ConflictException, UnauthorizedException } from 'src/common/exceptions/validation.exception';
import { UserRepository } from 'src/module/user/repository/user.repository';
import { AuthRepository } from 'src/module/auth/repository/auth.repository';
import { FakeAuthRepository, FakeUserRepository } from '../../helpers/test-database.helper';

const CONFIG: Record<string, string> = {
  'jwt.accessSecret': 'access-secret-32-bytes-minimum-length',
  'jwt.accessTtl': '15m',
  'jwt.refreshSecret': 'refresh-secret-32-bytes-minimum-length',
  'jwt.refreshTtl': '7d',
};

function makeService() {
  const users = new FakeUserRepository() as unknown as UserRepository;
  const sessions = new FakeAuthRepository() as unknown as AuthRepository;
  const config = { get: (k: string) => CONFIG[k] } as unknown as ConfigService;
  const tokens = new TokenService(new JwtService(), config);
  return { service: new AuthService(users, sessions, tokens) };
}

describe('AuthService', () => {
  it('registers then logs in', async () => {
    const { service } = makeService();
    const reg = await service.register({
      name: 'Ana',
      email: 'ana@test.dev',
      password: 'supersecret',
    });
    expect(reg.accessToken).toBeTruthy();
    expect(reg.user.email).toBe('ana@test.dev');

    const login = await service.login({ email: 'ana@test.dev', password: 'supersecret' });
    expect(login.accessToken).toBeTruthy();
    expect(login.user.id).toBe(reg.user.id);
  });

  it('rejects duplicate email', async () => {
    const { service } = makeService();
    await service.register({ name: 'Ana', email: 'dup@test.dev', password: 'supersecret' });
    await expect(
      service.register({ name: 'Bob', email: 'dup@test.dev', password: 'supersecret' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects wrong password', async () => {
    const { service } = makeService();
    await service.register({ name: 'Ana', email: 'ana@test.dev', password: 'supersecret' });
    await expect(
      service.login({ email: 'ana@test.dev', password: 'wrongpassword' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotates refresh token and revokes the old one', async () => {
    const { service } = makeService();
    const reg = await service.register({
      name: 'Ana',
      email: 'ana@test.dev',
      password: 'supersecret',
    });
    const refreshed = await service.refresh(reg.refreshToken);
    expect(refreshed.refreshToken).not.toEqual(reg.refreshToken);

    await expect(service.refresh(reg.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
