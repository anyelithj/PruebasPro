import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
// [DTO SetPublished]: alterna publicación del curso | [Patrón]: DTO | [Principio]: SRP

export class SetPublishedDto {
  @ApiProperty({ description: 'true = activar (publicar), false = desactivar' })
  @IsBoolean()
  isPublished!: boolean;
}
