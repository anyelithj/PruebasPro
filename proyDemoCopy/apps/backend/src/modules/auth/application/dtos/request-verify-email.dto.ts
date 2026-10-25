import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class RequestVerifyEmailDto {
  @ApiProperty({ example: 'student@neuroedu.ia' })
  @IsEmail({}, { message: 'Email format is invalid' })
  @MaxLength(320, { message: 'Email exceeds RFC max length (320)' })
  email!: string;
}
