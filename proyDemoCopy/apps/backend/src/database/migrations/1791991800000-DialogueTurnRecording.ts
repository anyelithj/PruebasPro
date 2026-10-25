import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · 2026-10-20]: dialogue_turns.audio_key/audio_mime — grabación de voz del usuario en la conversación con el avatar | [Patrón]: Migration (up/down reversible) · `IF NOT EXISTS`: en dev (synchronize=true) las columnas ya pueden existir

export class DialogueTurnRecording1791991800000 implements MigrationInterface {
    name = 'DialogueTurnRecording1791991800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dialogue_turns" ADD COLUMN IF NOT EXISTS "audio_key" character varying(300)`);
        await queryRunner.query(`ALTER TABLE "dialogue_turns" ADD COLUMN IF NOT EXISTS "audio_mime" character varying(60)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dialogue_turns" DROP COLUMN IF EXISTS "audio_mime"`);
        await queryRunner.query(`ALTER TABLE "dialogue_turns" DROP COLUMN IF EXISTS "audio_key"`);
    }
}
