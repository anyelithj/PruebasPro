import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackModule } from '../feedback/feedback.module';
import { Quiz } from './domain/entities/quiz.entity';
import { Question } from './domain/entities/question.entity';
import { QuizSession } from './domain/entities/quiz-session.entity';
import { QUIZ_REPOSITORY } from './domain/interfaces/quiz.repository.interface';
import { QuizRepository } from './infrastructure/repositories/quiz.repository';
import { CreateQuizUseCase } from './application/use-cases/create-quiz.use-case';
import { GetQuizUseCase } from './application/use-cases/get-quiz.use-case';
import { ListQuizzesUseCase } from './application/use-cases/list-quizzes.use-case';
import { GenerateAIQuestionsUseCase } from './application/use-cases/generate-ai-questions.use-case';
import { StartSessionUseCase } from './application/use-cases/start-session.use-case';
import { SubmitAnswerUseCase } from './application/use-cases/submit-answer.use-case';
import { EndSessionUseCase } from './application/use-cases/end-session.use-case';
import { ListMyHistoryUseCase } from './application/use-cases/list-my-history.use-case';
import { QuizController } from './presentation/quiz.controller';
import { AyaProvider } from './infrastructure/clients/aya.provider';
import { QwenProvider } from './infrastructure/clients/qwen.provider';
import { MistralProvider } from './infrastructure/clients/mistral.provider';
import { AIProviderFactory } from './infrastructure/factories/ai-provider.factory';
// [Modulo Quiz]: Bounded Context | [Patron]: Module + DI Container | [Principio]: ISP + DIP | [Paradigma]: POO

// [Wire-up Ports → Adapters]: el resto del módulo depende solo del Symbol token | [Patrón]: Service Locator (Nest DI) | [Principio]: DIP
const quizRepoProvider = { provide: QUIZ_REPOSITORY, useClass: QuizRepository };

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Quiz, Question, QuizSession]),
    FeedbackModule,
  ],
  controllers: [QuizController],
  providers: [
    quizRepoProvider,
    // [AI Providers Ollama]: registrados como clases concretas → factory los resuelve por id; el HTTP lo pone OllamaClient (módulo AI global) | [Patrón]: Registry | [Principio]: OCP + DRY
    AyaProvider,
    QwenProvider,
    MistralProvider,
    AIProviderFactory,
    CreateQuizUseCase,
    GetQuizUseCase,
    ListQuizzesUseCase,
    GenerateAIQuestionsUseCase,
    StartSessionUseCase,
    SubmitAnswerUseCase,
    EndSessionUseCase,
    ListMyHistoryUseCase,
  ],
  exports: [quizRepoProvider],
})
export class QuizModule {}
