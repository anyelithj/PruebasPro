import { DraftCourseUseCase } from './application/use-cases/draft-course.use-case';
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './domain/entities/course.entity';
import { CourseEnrollment } from './domain/entities/course-enrollment.entity';
import { COURSE_REPOSITORY } from './domain/interfaces/course.repository.interface';
import { CourseRepository } from './infrastructure/repositories/course.repository';
import { ListCoursesUseCase } from './application/use-cases/list-courses.use-case';
import { AdminListCoursesUseCase } from './application/use-cases/admin-list-courses.use-case';
import { GetCourseUseCase } from './application/use-cases/get-course.use-case';
import { ToggleFavoriteUseCase } from './application/use-cases/toggle-favorite.use-case';
import { ToggleReactionUseCase } from './application/use-cases/toggle-reaction.use-case';
import { CreateCourseUseCase } from './application/use-cases/create-course.use-case';
import { UpdateCourseUseCase } from './application/use-cases/update-course.use-case';
import { DeleteCourseUseCase } from './application/use-cases/delete-course.use-case';
import { SetPublishedUseCase } from './application/use-cases/set-published.use-case';
import { PurchaseCourseUseCase } from './application/use-cases/purchase-course.use-case';
import { CoursesController } from './presentation/courses.controller';
import { CourseMaterialsController } from './presentation/course-materials.controller';
import { CourseMaterial } from './domain/entities/course-material.entity';
import { CourseMaterialsUseCase } from './application/use-cases/course-materials.use-case';
import { FILE_STORAGE } from './domain/interfaces/file-storage.interface';
import type { FileStorage } from './domain/interfaces/file-storage.interface';
import { LocalFileStorage } from './infrastructure/storage/local-file.storage';
import { S3FileStorage } from './infrastructure/storage/s3-file.storage';
import { resolve } from 'node:path';
import { storageConfig } from '../../shared/config/storage.config';
import { createObjectStore } from '../../shared/storage/object-store';
// [CoursesModule]: Bounded Context Courses | [Patrón]: Module + DI Container | [Principio]: ISP + DIP

// [Wire-up Port → Adapter]: el resto del módulo depende solo del Symbol token | [Patrón]: Service Locator (Nest DI) | [Principio]: DIP
const courseRepositoryProvider = {
  provide: COURSE_REPOSITORY,
  useClass: CourseRepository,
};

// [CoursesStorageModule]: expone el puerto FileStorage para que MulterModule y los casos de uso usen la MISMA carpeta | [Patrón]: Module + DI | [Principio]: SSOT
@Module({
  imports: [ConfigModule],
  // [Sprint 6.7 · Factory por configuración]: STORAGE_PROVIDER=s3 → S3FileStorage (MinIO o R2); local → disco | los casos de uso solo ven FILE_STORAGE (sin if)
  providers: [
    {
      provide: FILE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): FileStorage => {
        const cfg = storageConfig();
        return cfg.provider === 's3'
          ? new S3FileStorage(
              createObjectStore('course-materials'),
              resolve(cfg.uploadsDir, 'tmp-materials'),
            )
          : new LocalFileStorage(config);
      },
    },
  ],
  exports: [FILE_STORAGE],
})
class CoursesStorageModule {}

@Module({
  imports: [
    TypeOrmModule.forFeature([Course, CourseEnrollment, CourseMaterial]),
    // [Multer a disco]: la carpeta la decide el Adapter de almacenamiento (una sola fuente de verdad) | `registerAsync` + useFactory: DI en la configuración
    MulterModule.registerAsync({
      imports: [CoursesStorageModule],
      inject: [FILE_STORAGE],
      // [Sprint 6.7]: multer nombra cada archivo con 16 bytes aleatorios (128 bits, no adivinable) · el tope MAX_UPLOAD_MB corta la subida mientras llega
      useFactory: (storage: FileStorage) => ({
        dest: storage.directory,
        limits: { fileSize: storageConfig().maxUploadBytes, files: 1 },
      }),
    }),
    CoursesStorageModule,
  ],
  controllers: [CoursesController, CourseMaterialsController],
  providers: [
    courseRepositoryProvider,
    ListCoursesUseCase,
    AdminListCoursesUseCase,
    GetCourseUseCase,
    ToggleFavoriteUseCase,
    ToggleReactionUseCase,
    CreateCourseUseCase,
    UpdateCourseUseCase,
    DeleteCourseUseCase,
    SetPublishedUseCase,
    PurchaseCourseUseCase, // Compra / inscripción → acceso al material
    CourseMaterialsUseCase, // Videos, audio, PDF, documentos y enlaces del curso
    DraftCourseUseCase, // [2026-10-23]: borrador IA (OllamaClient del AIModule @Global)
  ],
  exports: [courseRepositoryProvider],
})
export class CoursesModule {}
