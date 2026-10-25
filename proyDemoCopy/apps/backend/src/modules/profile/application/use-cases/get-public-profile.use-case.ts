import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PROFILE_REPOSITORY,
  type IProfileRepository,
} from '../../domain/interfaces/profile.repository.interface';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../../users/domain/interfaces/user.repository.interface';
import { EducationLevel } from '../../domain/entities/user-profile.entity';
// [UseCase GetPublicProfile]: subset seguro para mostrar a terceros | [Patrón]: UseCase | [Principio]: Least Privilege

export interface PublicProfileView {
  fullName: string;
  educationLevel: EducationLevel | null;
  productiveActivity: string | null;
}

@Injectable()
export class GetPublicProfileUseCase {
  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepo: IProfileRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  // [execute]: usa userId target — no expone email ni fecha de nacimiento
  async execute(targetUserId: string): Promise<PublicProfileView> {
    const user = await this.userRepo.findById(targetUserId);
    if (!user) throw new NotFoundException(`User ${targetUserId} not found`);
    const profile = await this.profileRepo.findByUserId(targetUserId);
    if (!profile) {
      // [Caso sin perfil aún]: devuelve forma mínima (nombre legacy desde User)
      return {
        fullName: `${user.firstName} ${user.lastName}`.trim(),
        educationLevel: null,
        productiveActivity: null,
      };
    }
    return {
      fullName: profile.fullName,
      educationLevel: profile.educationLevel,
      productiveActivity: profile.productiveActivity,
    };
  }
}
