import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Plain reset token received by email' })
  @IsString()
  @MinLength(16, { message: 'Reset token is invalid' })
  @MaxLength(256)
  token!: string;

  @ApiProperty({ example: 'StrongP@ss123', description: 'New password' })
  @IsString()
  @MinLength(8, { message: 'Password too short (min 8)' })
  @MaxLength(128, { message: 'Password too long (max 128)' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must contain uppercase, lowercase, and digit',
  })
  newPassword!: string;
}
