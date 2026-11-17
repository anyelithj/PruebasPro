import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-10-28]: conversaciones y mensajes del Tutor IA (renombrar/borrar conversación, editar/borrar mensaje, uso del idioma meta) | [Patrón]: Migration (up/down reversible)
// `IF NOT EXISTS` / `IF EXISTS`: idempotente (en dev con synchronize=true las tablas ya pueden existir) | FK a users con ON DELETE CASCADE → borrar la cuenta borra su historial

export class TutorConversations1791993400000 implements MigrationInterface {
    name = 'TutorConversations1791993400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "tutor_conversations" (
            "id" uuid NOT NULL,
            "user_id" uuid NOT NULL,
            "title" varchar(120) NOT NULL,
            "language" varchar(2) NOT NULL,
            "level" varchar(2) NOT NULL,
            "language_usage" jsonb,
            "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            CONSTRAINT "PK_tutor_conversations" PRIMARY KEY ("id"),
            CONSTRAINT "FK_tutor_conversations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
        )`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_tutor_conversations_user_updated" ON "tutor_conversations" ("user_id", "updated_at")`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "tutor_messages" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "conversation_id" uuid NOT NULL,
            "seq" integer NOT NULL,
            "role" varchar(10) NOT NULL,
            "content" text NOT NULL,
            "edited_at" TIMESTAMP WITH TIME ZONE,
            "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            CONSTRAINT "PK_tutor_messages" PRIMARY KEY ("id"),
            CONSTRAINT "CHK_tutor_messages_role" CHECK ("role" IN ('user', 'assistant')),
            CONSTRAINT "FK_tutor_messages_conversation" FOREIGN KEY ("conversation_id") REFERENCES "tutor_conversations"("id") ON DELETE CASCADE
        )`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tutor_messages_conversation_seq" ON "tutor_messages" ("conversation_id", "seq")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "tutor_messages"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "tutor_conversations"`);
    }
}
