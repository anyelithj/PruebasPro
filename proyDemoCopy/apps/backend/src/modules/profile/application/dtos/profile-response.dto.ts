import { ApiProperty } from '@nestjs/swagger';
import {
  EducationLevel,
  UserProfile,
} from '../../domain/entities/user-profile.entity';
import { User } from '../../../users/domain/entities/user.entity';
// [DTO ProfileResponse]: forma uniforme para GET /profile/me | [Patrón]: DTO | [Principio]: SRP

export class ProfileResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  fullName!: string;

  // [email]: viene del agregado User (no se duplica en UserProfile)
  @ApiProperty()
  email!: string;

  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
    format: 'date',
  })
  dateOfBirth!: string | null;

  @ApiProperty({ required: false, nullable: true, enum: EducationLevel })
  educationLevel!: EducationLevel | null;

  @ApiProperty({ required: false, nullable: true })
  productiveActivity!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  // [Mapper]: profile + user → ProfileResponseDto | [Patrón]: Mapper | [Principio]: SRP
  static fromDomain(
    profile: UserProfile,
    user: Pick<User, 'email'>,
  ): ProfileResponseDto {
    const dto = new ProfileResponseDto();
    dto.userId = profile.userId;
    dto.fullName = profile.fullName;
    dto.email = user.email;
    dto.dateOfBirth = profile.dateOfBirth
      ? new Date(profile.dateOfBirth).toISOString().slice(0, 10)
      : null;
    dto.educationLevel = profile.educationLevel;
    dto.productiveActivity = profile.productiveActivity;
    dto.createdAt = profile.createdAt.toISOString();
    dto.updatedAt = profile.updatedAt.toISOString();
    return dto;
  }
}
