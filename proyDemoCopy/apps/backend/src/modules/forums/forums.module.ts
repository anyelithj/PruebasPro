import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesModule } from '../courses/courses.module';
import { CurriculumModule } from '../curriculum/curriculum.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { CreatePostUseCase } from './application/use-cases/create-post.use-case';
import { CreateThreadUseCase } from './application/use-cases/create-thread.use-case';
import { EditPostUseCase } from './application/use-cases/edit-post.use-case';
import {
  GetPostUseCase,
  ListPostsUseCase,
} from './application/use-cases/list-posts.use-case';
import {
  ForumAccess,
  GetThreadUseCase,
  ListThreadsUseCase,
} from './application/use-cases/list-threads.use-case';
import { ModerateThreadUseCase } from './application/use-cases/moderate-thread.use-case';
import { ForumPost } from './domain/entities/forum-post.entity';
import { ForumThread } from './domain/entities/forum-thread.entity';
import { ForumPostsController } from './presentation/forum-posts.controller';
import { ForumThreadsController } from './presentation/forum-threads.controller';
// [ForumsModule · Sprint 7.14 · RF-72]: foros por lección (hilos, respuestas y moderación) | [Patrón]: Module + DI Container + Observer (avisos por NotificationsModule) | [Principio]: SRP + DRY (lección por el puerto de Curriculum, inscripción por el de Courses, nombre por el de Users: ninguna entidad ajena registrada aquí)

@Module({
  imports: [
    TypeOrmModule.forFeature([ForumThread, ForumPost]),
    CurriculumModule, // COURSE_OUTLINE_REPOSITORY: la lección existe y a qué curso pertenece
    CoursesModule, // COURSE_REPOSITORY: inscripción del estudiante
    UsersModule, // USER_REPOSITORY: nombre visible del autor
    NotificationsModule, // PublishNotificationUseCase: «Nueva respuesta en tu hilo»
  ],
  controllers: [ForumThreadsController, ForumPostsController],
  providers: [
    ForumAccess,
    CreateThreadUseCase,
    ListThreadsUseCase,
    GetThreadUseCase,
    ModerateThreadUseCase,
    CreatePostUseCase,
    ListPostsUseCase,
    GetPostUseCase,
    EditPostUseCase,
  ],
})
export class ForumsModule {}
