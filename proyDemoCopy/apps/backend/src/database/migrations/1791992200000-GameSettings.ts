import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-10-24]: game_settings = título, descripción y estado editables de cada juego del catálogo (Gestión → Actividades → Juegos)
// Sin filas = todos publicados con sus valores por defecto → no cambia nada para los datos existentes | `IF NOT EXISTS`: idempotente

export class GameSettings1791992200000 implements MigrationInterface {
    name = 'GameSettings1791992200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "game_settings" (
            "type" varchar(40) PRIMARY KEY,
            "title" varchar(80),
            "description" varchar(240),
            "status" varchar(10) NOT NULL DEFAULT 'published',
            "updated_by" uuid,
            "updated_at" timestamptz NOT NULL DEFAULT now()
        )`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "game_settings"`);
    }
}
