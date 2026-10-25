import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PROFILE_REPOSITORY,
  type IProfileRepository,
} from '../../domain/interfaces/profile.repository.interface';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../../users/domain/interfaces/user.repository.interface';
import { ProfileResponseDto } from '../dtos/profile-response.dto';
// [UseCase GetFullProfile]: lee el perfil completo del usuario autenticado | [Patrón]: UseCase | [Principio]: SRP

@Injectable()
export class GetFullProfileUseCase {
  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepo: IProfileRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  // [execute]: devuelve null si no existe perfil aún (caller decide qué hacer)
  async execute(userId: string): Promise<ProfileResponseDto | null> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) return null;
    return ProfileResponseDto.fromDomain(profile, user);
  }
}
