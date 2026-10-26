import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-10-25]: game_decks = juegos de vocabulario con material propio (Gestión → Actividades → Juegos → Crear) | `IF NOT EXISTS`: idempotente

export class GameDecks1791992700000 implements MigrationInterface {
    name = 'GameDecks1791992700000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "game_decks" (
            "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "game_type" varchar(40) NOT NULL,
            "title" varchar(160) NOT NULL,
            "language" varchar(5) NOT NULL,
            "level" varchar(4),
            "items" jsonb NOT NULL DEFAULT '[]',
            "status" varchar(10) NOT NULL DEFAULT 'draft',
            "created_by" uuid NOT NULL,
            "archived_at" timestamptz,
            "created_at" timestamptz NOT NULL DEFAULT now(),
            "updated_at" timestamptz NOT NULL DEFAULT now()
        )`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_game_decks_created_by" ON "game_decks" ("created_by")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "game_decks"`);
    }
}
