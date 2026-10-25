import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangeReviewStatusCommand } from './application/commands/change-review-status.command';
import { DeleteCurriculumItemCommand } from './application/commands/delete-curriculum-item.command';
import { CreateCurriculumItemCommand } from './application/commands/create-curriculum-item.command';
import { UpdateCurriculumItemCommand } from './application/commands/update-curriculum-item.command';
import { ExportCurriculumQuery } from './application/queries/export-curriculum.query';
import { GetCurriculumItemQuery } from './application/queries/get-curriculum-item.query';
import {
  ListCurriculumItemsQuery,
  ListTopicGroupsQuery,
} from './application/queries/list-curriculum-items.query';
import { CurriculumItem } from './domain/entities/curriculum-item.entity';
import { CurriculumItemRevision } from './domain/entities/curriculum-item-revision.entity';
import { CurriculumSource } from './domain/entities/curriculum-source.entity';
import { CurriculumTopic } from './domain/entities/curriculum-topic.entity';
import {
  CheckKeyQuery,
  SearchSourcesQuery,
  SearchTopicsQuery,
} from './application/queries/catalog.queries';
import { CreateTopicCommand } from './application/commands/create-topic.command';
import { CreateSourceCommand } from './application/commands/create-source.command';
import { CURRICULUM_REPOSITORY } from './domain/interfaces/curriculum.repository.interface';
import { CurriculumRepository } from './infrastructure/repositories/curriculum.repository';
import { CurriculumController } from './presentation/curriculum.controller';
import { CurriculumGeneration } from './domain/entities/curriculum-generation.entity';
import { CurriculumTopicLabel } from './domain/entities/curriculum-topic-label.entity';
import { TopicLabelService } from './application/topic-labels';
import { CURRICULUM_LLM } from './domain/interfaces/curriculum-llm.interface';
import { OllamaCurriculumLlm } from './infrastructure/ai/ollama-curriculum.llm';
import {
  GenerateContentDraftQuery,
  SuggestTopicsQuery,
} from './application/queries/ai-draft.queries';
import { CourseNode } from './domain/entities/course-node.entity';
import { COURSE_OUTLINE_REPOSITORY } from './domain/interfaces/course-outline.repository.interface';
import { CourseOutlineRepository } from './infrastructure/repositories/course-outline.repository';
import { CourseOutlineController } from './presentation/course-outline.controller';
import { GetCourseOutlineQuery } from './application/queries/get-course-outline.query';
import { SaveCourseOutlineCommand } from './application/commands/save-course-outline.command';
import { FillLessonGapCommand } from './application/commands/fill-lesson-gap.command';
import { CompleteLessonCommand } from './application/commands/complete-lesson.command';
import { LessonProgress } from './domain/entities/lesson-progress.entity';
import { ScanContradictionsCommand } from './application/commands/scan-contradictions.command';
import { CertificationPracticeQuery } from './application/queries/certification-practice.query';
// [CurriculumModule]: Bounded Context "Base de conocimiento curricular" (contenido manual, versionado y trazable) | [Patrón]: Module + DI Container + Composition Root del contexto | [Principio]: DIP + ISP | [Paradigma]: POO + Decoradores
// [Tecnología]: NestJS Modules + TypeORM (forFeature registra las entidades del contexto)

// [Wire-up Port → Adapter]: el dominio/aplicación solo conocen el token; aquí se decide la implementación | [Patrón]: Dependency Injection
const curriculumRepositoryProvider = {
  provide: CURRICULUM_REPOSITORY, // Token (Symbol) del puerto
  useClass: CurriculumRepository, // Adapter concreto; cambiarlo no afecta al resto del módulo (OCP)
};

// `@Module` (NestJS): declara controladores, proveedores y exportaciones del contexto
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CurriculumItem,
      CurriculumItemRevision,
      CurriculumTopic,
      CurriculumSource,
      CurriculumGeneration,
      CurriculumTopicLabel,
      CourseNode, // [Etapa 3]: estructura Curso → Nivel → Módulo → Unidad → Lección
      LessonProgress, // [Línea de tiempo]: lecciones completadas por estudiante
    ]), // Repositorios TypeORM disponibles para inyección
  ],
  controllers: [CurriculumController, CourseOutlineController],
  providers: [
    curriculumRepositoryProvider,
    // Lado escritura (Commands)
    CreateCurriculumItemCommand,
    UpdateCurriculumItemCommand,
    ChangeReviewStatusCommand,
    DeleteCurriculumItemCommand, // Baja definitiva (ADMIN)
    // Lado lectura (Queries)
    ListCurriculumItemsQuery,
    ListTopicGroupsQuery, // [Read Model]: recursos agrupados por tema
    ExportCurriculumQuery, // [2026-10-23]: descarga en PDF, Word, Excel o CSV
    TopicLabelService, // [Nombre del tema en el idioma]: leer, guardar y sugerir
    GetCurriculumItemQuery,
    // Catálogo de temas y fuentes
    SearchTopicsQuery,
    SearchSourcesQuery,
    CheckKeyQuery,
    CreateTopicCommand,
    CreateSourceCommand,
    // Borradores con IA: puerto → Adapter Ollama sobre OllamaClient compartido (cambiar de proveedor = cambiar useClass) | [Patrón]: Dependency Injection
    { provide: CURRICULUM_LLM, useClass: OllamaCurriculumLlm },
    GenerateContentDraftQuery,
    SuggestTopicsQuery,
    // [Etapa 3 · Jerarquía de curso]: puerto propio (ISP) → adapter TypeORM
    { provide: COURSE_OUTLINE_REPOSITORY, useClass: CourseOutlineRepository },
    GetCourseOutlineQuery,
    SaveCourseOutlineCommand,
    FillLessonGapCommand,
    CompleteLessonCommand,
    ScanContradictionsCommand, // [Etapa 4 · Multi-fuente]: comparación determinista entre fuentes
    CertificationPracticeQuery, // [Etapa 5 · Certificaciones]: práctica original sobre el mismo pipeline de IA
  ],
  // [Export del puerto]: futuros motores (ejercicios, feedback, repetición espaciada) consultan la base curricular ANTES de llamar al LLM
  // [Sprint 7.14]: COURSE_OUTLINE_REPOSITORY → Forums valida la lección de cada hilo (sin registrar CourseNode en otro módulo)
  exports: [curriculumRepositoryProvider, COURSE_OUTLINE_REPOSITORY],
})
export class CurriculumModule {}
