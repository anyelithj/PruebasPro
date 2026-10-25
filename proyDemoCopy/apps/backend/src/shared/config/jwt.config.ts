import { registerAs } from '@nestjs/config';
// [Configuración JWT]: secrets y expiraciones de tokens | [Patrón]: Configuration Object | [Principio]: SSOT | [Paradigma]: Funcional

// [Factoría JWT config]: encapsula par access/refresh | [Patrón]: Factory | [Principio]: SRP
export default registerAs('jwt', () => ({
  // [Access token]: corta vida (15 min) — minimiza ventana de compromiso
  accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change-me-access',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  // [Refresh token]: vida más larga (7 días), rotación obligatoria en cada uso
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  // [Bcrypt rounds]: factor de coste para hash de passwords (12 = ~250ms)
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
}));
