import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · Sprint 7.15]: email_outbox — bandeja de salida de correos (pending → sent | failed) | [Patrón]: Migration (up/down reversible) + Transactional Outbox

export class EmailOutbox1791991100000 implements MigrationInterface {
    name = 'EmailOutbox1791991100000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "email_outbox" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "to_address" character varying(254) NOT NULL, "subject" character varying(255) NOT NULL, "text" text NOT NULL, "html" text NOT NULL, "status" character varying(12) NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT 0, "last_error" text, "sent_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_email_outbox" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_email_outbox_status" ON "email_outbox" ("status", "created_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "email_outbox"`);
    }
}
