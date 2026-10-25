-- [SRP] script DB aislado del ORM
-- Extensiones requeridas antes de las migraciones Alembic.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
