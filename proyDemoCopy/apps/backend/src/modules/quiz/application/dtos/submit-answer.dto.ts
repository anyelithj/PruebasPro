import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
// [DTO Submit Answer]: input para registrar respuesta | [Patrón]: DTO | [Principio]: SRP

export class SubmitAnswerDto {
  @ApiProperty()
  @IsUUID()
  questionId!: string;

  @ApiProperty()
  @IsString()
  userAnswer!: string;

  // [Tiempo de respuesta]: medido por frontend en ms | [Patrón]: telemetría
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeTakenMs?: number;
}
