// [SRP] configuración JWT aislada
import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_SECRET ?? 'change-me',
  accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh',
  refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
}));
