import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { IssueCertificateUseCase } from '../src/modules/certificates/application/use-cases/issue-certificate.use-case';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../src/modules/courses/domain/interfaces/course.repository.interface';
import type { CourseCategory } from '../src/modules/courses/domain/value-objects/course-category.vo';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../src/modules/users/domain/interfaces/user.repository.interface';
import { CEFR_LEVELS } from '../src/shared/domain/cefr-level.vo';
// [Script demo · Sprint 7.8]: emite un certificado por nivel MCER (A1–C2) al usuario indicado para ver diploma, color y QR por nivel | [Patrón]: Batch Job idempotente (usa el caso de uso real: PDF + qrcode + hash + anclaje) | [Principio]: DRY (nada de SQL a mano) + KISS
// [Uso]: pnpm seed:certificates                       (admin@neuroedu.ia)
//        pnpm seed:certificates ana@aula.test         (otro usuario)
// [Solo desarrollo]: marca la inscripción como comprada y al 100 %; repetirlo devuelve los mismos certificados

for (const file of ['.env.local', '.env'])
  if (existsSync(file)) process.loadEnvFile(file); // `process.loadEnvFile` (Node ≥ 20.12)

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('seed:certificates es solo para desarrollo'); // [Fail Fast]: nunca regalar certificados en producción
  const email = process.argv[2] ?? 'admin@neuroedu.ia';
  // `createApplicationContext` (NestJS): contenedor DI sin servidor HTTP
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const users = app.get<IUserRepository>(USER_REPOSITORY);
    const courses = app.get<ICourseRepository>(COURSE_REPOSITORY);
    const issue = app.get(IssueCertificateUseCase);
    const user = await users.findByEmail(email);
    if (!user) throw new Error(`No existe el usuario ${email}`);

    for (const level of CEFR_LEVELS) {
      const { data } = await courses.findAll({
        category: level as unknown as CourseCategory, // Cursos de idiomas: category = 'A1'…'C2'
        limit: 1,
      });
      const course = data[0];
      if (!course) {
        console.warn(`· ${level}: sin cursos`);
        continue;
      }
      await courses.upsertEnrollment(user.id, course.id, {
        purchasedAt: new Date(),
        progress: 100,
      });
      const cert = await issue.execute(user.id, course.id);
      console.log(`✓ ${level} · ${cert.code} · ${course.title}`);
    }
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
