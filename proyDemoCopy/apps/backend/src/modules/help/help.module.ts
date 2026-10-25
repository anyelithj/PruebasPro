import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AskGuideUseCase } from './application/use-cases/ask-guide.use-case';
import {
  CreateFaqUseCase,
  FaqIndexSync,
} from './application/use-cases/create-faq.use-case';
import {
  DeleteConversationUseCase,
  GetGuideConversationUseCase,
} from './application/use-cases/delete-conversation.use-case';
import {
  GetManualArticleUseCase,
  GetManualAssetUseCase,
} from './application/use-cases/get-manual-article.use-case';
import {
  GetFaqUseCase,
  ListFaqsUseCase,
} from './application/use-cases/list-faqs.use-case';
import { ListManualUseCase } from './application/use-cases/list-manual.use-case';
import { RateGuideAnswerUseCase } from './application/use-cases/rate-guide-answer.use-case';
import { ReindexManualUseCase } from './application/use-cases/reindex-manual.use-case';
import {
  ArchiveFaqUseCase,
  UpdateFaqUseCase,
} from './application/use-cases/update-faq.use-case';
import { Faq } from './domain/entities/faq.entity';
import { GuideFeedback } from './domain/entities/guide-feedback.entity';
import { ManualArticle } from './domain/entities/manual-article.entity';
import { FaqsController } from './presentation/faqs.controller';
import { GuideController } from './presentation/guide.controller';
import { ManualArticlesController } from './presentation/manual-articles.controller';
// [HelpModule · Sprints 7.10/7.12]: Centro de ayuda — FAQ, manual de usuario y proxy del Agente Guía (persona «guide» de FastAPI) | [Patrón]: Module + DI Container + CQRS ligero (lecturas públicas, escrituras ADMIN) | [Principio]: SRP + DRY (AssistantClientService global de AIModule; no hay un segundo cliente HTTP) + SSOT (docs/manual-usuario)

@Module({
  imports: [TypeOrmModule.forFeature([Faq, ManualArticle, GuideFeedback])],
  controllers: [FaqsController, ManualArticlesController, GuideController],
  providers: [
    FaqIndexSync,
    CreateFaqUseCase,
    ListFaqsUseCase,
    GetFaqUseCase,
    UpdateFaqUseCase,
    ArchiveFaqUseCase,
    ReindexManualUseCase,
    ListManualUseCase,
    GetManualArticleUseCase,
    GetManualAssetUseCase,
    AskGuideUseCase,
    GetGuideConversationUseCase,
    DeleteConversationUseCase,
    RateGuideAnswerUseCase,
  ],
})
export class HelpModule {}
