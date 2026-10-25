import { ApiProperty } from '@nestjs/swagger';
import { Category } from '../../domain/value-objects/category.vo';
import { Difficulty } from '../../domain/value-objects/difficulty.vo';
import { QuestionType } from '../../domain/entities/question.entity';
import {
  SessionStatus,
  SessionAnswer,
} from '../../domain/entities/quiz-session.entity';
// [DTOs respuesta]: forma estable hacia frontend, sin filtraciones de columnas internas | [Patrón]: DTO | [Principio]: ISP

export class QuestionPublicDto {
  @ApiProperty() id!: string;
  @ApiProperty() text!: string;
  @ApiProperty({ enum: QuestionType }) type!: QuestionType;
  @ApiProperty({ type: [String], required: false }) options?: string[];
  @ApiProperty({ enum: Difficulty }) difficulty!: Difficulty;
  @ApiProperty() position!: number;
  @ApiProperty({ required: false }) timeLimitSeconds?: number;
  @ApiProperty({ required: false }) explanation?: string;
  @ApiProperty({ required: false }) feedback?: string;
}

// [Variante con respuesta correcta]: solo para author/admin o tras finalizar sesión
export class QuestionWithAnswerDto extends QuestionPublicDto {
  @ApiProperty() correctAnswer!: string;
}

export class QuizResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ required: false }) description?: string;
  @ApiProperty({ enum: Category }) category!: Category;
  @ApiProperty({ enum: Difficulty }) difficulty!: Difficulty;
  @ApiProperty() authorId!: string;
  @ApiProperty() source!: string;
  @ApiProperty() timePerQuestionSeconds!: number;
  @ApiProperty() isPublished!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ type: [QuestionPublicDto], required: false })
  questions?: QuestionPublicDto[];
}

export class QuizListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: Category }) category!: Category;
  @ApiProperty({ enum: Difficulty }) difficulty!: Difficulty;
  @ApiProperty() questionsCount!: number;
  @ApiProperty() timePerQuestionSeconds!: number;
  // [Estado publicación]: requerido para panel docente (mostrar publicar/despublicar) | [Principio]: ISP
  @ApiProperty() isPublished!: boolean;
}

export class PaginatedQuizzesDto {
  @ApiProperty({ type: [QuizListItemDto] }) data!: QuizListItemDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class SessionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() quizId!: string;
  @ApiProperty({ enum: SessionStatus }) status!: SessionStatus;
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  answers!: SessionAnswer[];
  @ApiProperty() totalScore!: number;
  @ApiProperty() correctCount!: number;
  @ApiProperty() startedAt!: Date;
  @ApiProperty({ required: false }) completedAt?: Date;
}
