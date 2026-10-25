import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsUUID, Min } from 'class-validator';
// [DTO Submit Score]: input para registrar score manualmente (admin/tests) | [Patron]: DTO | [Principio]: SRP

export class SubmitScoreDto {
  @ApiProperty() @IsUUID() quizId!: string;
  @ApiProperty() @IsUUID() sessionId!: string;
  @ApiProperty() @IsNumber() @Min(0) points!: number;
  @ApiProperty() @IsInt() @Min(0) correctCount!: number;
  @ApiProperty() @IsInt() @Min(1) totalQuestions!: number;
}
