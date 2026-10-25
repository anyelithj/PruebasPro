// [TDD][SRP] prueba solo TokenService — sin DB
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from 'src/module/auth/service/token.service';
import { UserModel } from 'src/module/user/model/user.model';

const CONFIG: Record<string, string> = {
  'jwt.accessSecret': 'access-secret-32-bytes-minimum-length',
  'jwt.accessTtl': '15m',
  'jwt.refreshSecret': 'refresh-secret-32-bytes-minimum-length',
  'jwt.refreshTtl': '7d',
};

const user = { id: 'u-1', role: 'user' } as UserModel;

function makeService(): TokenService {
  const config = { get: (k: string) => CONFIG[k] } as unknown as ConfigService;
  return new TokenService(new JwtService(), config);
}

describe('TokenService', () => {
  it('access token carries subject and type', async () => {
    const service = makeService();
    const token = await service.createAccessToken(user);
    const decoded = new JwtService().decode(token) as Record<string, unknown>;
    expect(decoded.sub).toBe('u-1');
    expect(decoded.type).toBe('access');
  });

  it('token pair has unique refresh jti', async () => {
    const service = makeService();
    const a = await service.createTokenPair(user);
    const b = await service.createTokenPair(user);
    expect(a.refreshJti).not.toEqual(b.refreshJti);
  });

  it('verifyRefresh accepts a freshly minted refresh token', async () => {
    const service = makeService();
    const pair = await service.createTokenPair(user);
    const payload = await service.verifyRefresh(pair.refreshToken);
    expect(payload.type).toBe('refresh');
    expect(payload.jti).toBe(pair.refreshJti);
  });
});
