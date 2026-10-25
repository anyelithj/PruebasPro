import { join } from 'path';
import { DataSource } from 'typeorm';
import databaseConfig from '../shared/config/database.config';
// [DataSource de la CLI de TypeORM]: generar, ejecutar y revertir migraciones fuera de Nest | [Patrón]: Singleton (export default) + Configuration Object | [Principio]: SSOT (misma config que AppModule) | [Paradigma]: POO

// `process.loadEnvFile` (Node ≥ 20.12, stdlib): lee apps/backend/.env sin depender de dotenv | try/catch → en CI/Docker no hay .env y las variables ya vienen del entorno
try {
  process.loadEnvFile();
} catch {
  // Sin archivo .env: se usan las variables del proceso
}

// [SSOT]: misma factoría que usa AppModule (registerAs devuelve la función) → host, puerto y credenciales no se duplican | [Principio]: DRY
const cfg = databaseConfig();

// `export default` (ES2015): la CLI (`-d src/database/data-source.ts`) espera una única instancia de DataSource
export default new DataSource({
  type: 'postgres',
  host: cfg.host,
  port: cfg.port,
  username: cfg.username,
  password: cfg.password,
  database: cfg.database,
  // [Entidades]: todas las tablas de los bounded contexts | glob `{.ts,.js}`: sirve con ts-node (src) y compilado (dist)
  entities: [join(__dirname, '..', 'modules', '**', '*.entity{.ts,.js}')],
  // [Migraciones versionadas]: una clase por cambio de esquema, en orden de timestamp | [Patrón]: Command (up/down)
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  migrationsTableName: 'typeorm_migrations', // Tabla donde TypeORM registra qué migraciones ya corrieron
  synchronize: false, // `false`: la CLI nunca altera el esquema por su cuenta; solo con migraciones explícitas
  logging: cfg.logging,
});
