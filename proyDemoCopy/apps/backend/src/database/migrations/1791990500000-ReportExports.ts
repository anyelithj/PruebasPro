import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · Sprint 6.4]: tabla report_exports (exportaciones PDF/Excel asíncronas) | [Patrón]: Migration (up/down reversible)

export class ReportExports1791990500000 implements MigrationInterface {
    name = 'ReportExports1791990500000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "report_exports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "format" character varying(8) NOT NULL, "period_months" integer, "status" character varying(16) NOT NULL DEFAULT 'pending', "object_key" character varying(300), "size_bytes" integer, "error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_report_exports" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_report_exports_user_created" ON "report_exports" ("user_id", "created_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."ix_report_exports_user_created"`);
        await queryRunner.query(`DROP TABLE "report_exports"`);
    }

}
