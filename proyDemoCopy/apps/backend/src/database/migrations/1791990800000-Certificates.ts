import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · Sprint 7.8]: tabla certificates (código público, SHA-256 del PDF y hash de la transacción de anclaje en Sepolia) | [Patrón]: Migration (up/down reversible)
// [Integridad]: un certificado por usuario y curso · código y anchor_tx_hash únicos

export class Certificates1791990800000 implements MigrationInterface {
    name = 'Certificates1791990800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "certificates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "course_id" uuid NOT NULL, "code" character varying(20) NOT NULL, "recipient_name" character varying(160) NOT NULL, "course_title" character varying(200) NOT NULL, "pdf_sha256" character(64) NOT NULL, "object_key" character varying(300) NOT NULL, "size_bytes" integer NOT NULL, "anchor_tx_hash" character varying(66), "status" character varying(16) NOT NULL DEFAULT 'issued', "revoke_reason" text, "revoked_at" TIMESTAMP WITH TIME ZONE, "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_certificates" PRIMARY KEY ("id"), CONSTRAINT "UQ_certificates_code" UNIQUE ("code"), CONSTRAINT "UQ_certificates_anchor" UNIQUE ("anchor_tx_hash"), CONSTRAINT "UQ_certificates_user_course" UNIQUE ("user_id", "course_id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "certificates"`);
    }

}
