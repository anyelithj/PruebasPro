import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssistantClientService } from '../../../ai/assistant-client.service';
import {
  GuideFeedback,
  type GuideAnsweredBy,
} from '../../domain/entities/guide-feedback.entity';
// [UseCase RateGuideAnswer · Sprint 7.10]: «útil / no útil» sobre una respuesta del Agente Guía | [Patrón]: Use Case (Command) + Upsert (volver a votar reemplaza) | [Principio]: SRP + Zero Trust (pregunta y respuesta se leen de la conversación real, no del cliente) | [Paradigma]: POO + async/await

export interface RateGuideInput {
  messageIndex: number; // Posición de la respuesta del agente en la conversación
  helpful: boolean;
  answeredBy: GuideAnsweredBy;
  route?: string;
}

@Injectable()
export class RateGuideAnswerUseCase {
  constructor(
    @InjectRepository(GuideFeedback)
    private readonly feedback: Repository<GuideFeedback>,
    private readonly assistant: AssistantClientService,
  ) {}

  async execute(
    userId: string,
    sessionId: string,
    input: RateGuideInput,
    token: string,
  ): Promise<GuideFeedback> {
    // [Propiedad]: FastAPI responde 404 si la conversación es de otro usuario
    const conv = await this.assistant.conversation(sessionId, token);
    const answer = conv.messages[input.messageIndex];
    const question = conv.messages[input.messageIndex - 1];
    if (answer?.role !== 'assistant' || question?.role !== 'user')
      throw new BadRequestException(
        'Ese mensaje no es una respuesta del Agente Guía',
      );
    const row = this.feedback.create({
      userId,
      sessionId,
      messageIndex: input.messageIndex,
      question: question.content,
      answer: answer.content,
      answeredBy: input.answeredBy,
      helpful: input.helpful,
      route: input.route ?? null,
    });
    // `upsert` (TypeORM): ON CONFLICT (user, sesión, mensaje) DO UPDATE → cambiar el voto no duplica filas
    await this.feedback.upsert(row, ['userId', 'sessionId', 'messageIndex']);
    return row;
  }
}
