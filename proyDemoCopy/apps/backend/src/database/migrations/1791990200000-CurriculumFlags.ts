import { MigrationInterface, QueryRunner } from 'typeorm';

export class CurriculumFlags1791990200000 implements MigrationInterface {
  name = 'CurriculumFlags1791990200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "curriculum_items" ADD "flags" text array NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "curriculum_items" DROP COLUMN "flags"`,
    );
  }
}
