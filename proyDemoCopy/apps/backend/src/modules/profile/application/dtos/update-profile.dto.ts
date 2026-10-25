import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EducationLevel } from '../../domain/entities/user-profile.entity';
// [DTO UpdateProfile]: input para PATCH /profile/me | [Patrón]: DTO | [Principio]: SRP

export class UpdateProfileDto {
  // [fullName]: requerido (campo principal del formulario)
  @ApiProperty({ minLength: 2, maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  // [dateOfBirth]: opcional — se valida con @Type para hidratar Date desde ISO string
  @ApiProperty({ required: false, type: String, format: 'date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOfBirth?: Date;

  @ApiProperty({ required: false, enum: EducationLevel })
  @IsOptional()
  @IsEnum(EducationLevel)
  educationLevel?: EducationLevel;

  @ApiProperty({ required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  productiveActivity?: string;
}
