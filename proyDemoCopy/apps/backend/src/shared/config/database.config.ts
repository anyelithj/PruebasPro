import { registerAs } from '@nestjs/config';
// [Configuración tipada]: namespace 'database' del ConfigService | [Patrón]: Configuration Object | [Principio]: SSOT | [Paradigma]: Funcional

// [Factoría de config]: lee env vars y devuelve objeto inmutable | [Patrón]: Factory | [Principio]: SRP
export default registerAs('database', () => ({
  // [Host PostgreSQL]: default 'localhost' si no hay env
  host: process.env.DATABASE_HOST ?? 'localhost',
  // [Puerto]: parseInt para garantizar number, no string
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres',
  database: process.env.DATABASE_NAME ?? 'languageproject',
  // [Sync schema]: true solo en desarrollo; en prod usar migrations
  synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
  // [Migraciones al arrancar]: true en producción (con synchronize=false) → aplica las pendientes de src/database/migrations
  migrationsRun: process.env.DATABASE_MIGRATIONS_RUN === 'true',
  logging: process.env.DATABASE_LOGGING === 'true',
}));
