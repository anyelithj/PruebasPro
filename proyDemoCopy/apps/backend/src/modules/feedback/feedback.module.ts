import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackIA } from './domain/entities/feedback-ia.entity';
import { FEEDBACK_REPOSITORY } from './domain/interfaces/feedback.repository.interface';
import { TypeOrmFeedbackRepository } from './infrastructure/repositories/feedback.repository';
import { SaveFeedbackUseCase } from './application/use-cases/save-feedback.use-case';
// [Módulo Feedback]: Bounded Context para persistencia de feedback IA (revisión docente + analytics + cache) | [Patrón]: Module + DI Container

const feedbackRepoProvider = {
  provide: FEEDBACK_REPOSITORY,
  useClass: TypeOrmFeedbackRepository,
};

@Module({
  imports: [TypeOrmModule.forFeature([FeedbackIA])],
  controllers: [],
  providers: [feedbackRepoProvider, SaveFeedbackUseCase],
  exports: [feedbackRepoProvider, SaveFeedbackUseCase],
})
export class FeedbackModule {}
