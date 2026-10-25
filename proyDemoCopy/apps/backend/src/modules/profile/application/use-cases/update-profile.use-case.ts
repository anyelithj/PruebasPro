import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PROFILE_REPOSITORY,
  type IProfileRepository,
} from '../../domain/interfaces/profile.repository.interface';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../../users/domain/interfaces/user.repository.interface';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
import { ProfileResponseDto } from '../dtos/profile-response.dto';
import { ProfileCompletedEvent } from '../../domain/events/profile-completed.event';
// [UseCase UpdateProfile]: upsert del perfil + evento "completed" cuando aplica | [Patrón]: UseCase + Domain Event | [Principio]: SRP

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepo: IProfileRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly eventBus: EventEmitter2,
  ) {}

  async execute(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const profile = await this.profileRepo.upsert({
      userId,
      fullName: dto.fullName.trim(),
      dateOfBirth: dto.dateOfBirth ?? null,
      educationLevel: dto.educationLevel ?? null,
      productiveActivity: dto.productiveActivity?.trim() ?? null,
    });

    // [Detección "completo"]: emite evento si todos los campos opcionales también vienen llenos
    // | [Patrón]: Domain Event | [Principio]: Observer
    const isComplete =
      !!profile.fullName &&
      !!profile.dateOfBirth &&
      !!profile.educationLevel &&
      !!profile.productiveActivity;
    if (isComplete) {
      this.eventBus.emit(
        ProfileCompletedEvent.EVENT_NAME,
        new ProfileCompletedEvent(userId, profile.fullName, new Date()),
      );
    }

    return ProfileResponseDto.fromDomain(profile, user);
  }
}
