import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProfile } from './domain/entities/user-profile.entity';
import { PROFILE_REPOSITORY } from './domain/interfaces/profile.repository.interface';
import { ProfileRepository } from './infrastructure/repositories/profile.repository';
import { GetFullProfileUseCase } from './application/use-cases/get-full-profile.use-case';
import { GetPublicProfileUseCase } from './application/use-cases/get-public-profile.use-case';
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case';
import { ProfileController } from './presentation/profile.controller';
import { UsersModule } from '../users/users.module';
// [ProfileModule]: Bounded Context Profile | [Patrón]: Module + DI Container | [Principio]: ISP + DIP

const profileRepositoryProvider = {
  provide: PROFILE_REPOSITORY,
  useClass: ProfileRepository,
};

@Module({
  imports: [
    TypeOrmModule.forFeature([UserProfile]),
    // [UsersModule]: necesitamos USER_REPOSITORY para validar al dueño del perfil
    UsersModule,
  ],
  controllers: [ProfileController],
  providers: [
    profileRepositoryProvider,
    GetFullProfileUseCase,
    GetPublicProfileUseCase,
    UpdateProfileUseCase,
  ],
  exports: [profileRepositoryProvider],
})
export class ProfileModule {}
