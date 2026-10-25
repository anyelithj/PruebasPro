import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · Sprints 1.5/7.18]: magic_link_tokens — acceso sin contraseña (hash único, 15 min, un solo uso) | [Patrón]: Migration (up/down reversible)

export class MagicLink1791991200000 implements MigrationInterface {
    name = 'MagicLink1791991200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "magic_link_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_magic_link_tokens" PRIMARY KEY ("id"), CONSTRAINT "UQ_magic_link_tokens_hash" UNIQUE ("token_hash"))`);
        await queryRunner.query(`CREATE INDEX "IDX_magic_link_tokens_user" ON "magic_link_tokens" ("user_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_magic_link_tokens_expires" ON "magic_link_tokens" ("expires_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "magic_link_tokens"`);
    }
}
