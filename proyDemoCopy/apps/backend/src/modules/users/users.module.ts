import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import jwtConfig from '../../shared/config/jwt.config';
import { User } from './domain/entities/user.entity';
import { USER_REPOSITORY } from './domain/interfaces/user.repository.interface';
import { UserRepository } from './infrastructure/repositories/user.repository';
import { UsersController } from './presentation/users.controller';
import { ProfileController } from './presentation/profile.controller';
import { GetProfileUseCase } from './application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case';
import { GetUserHistoryUseCase } from './application/use-cases/get-user-history.use-case';
import { DeleteAccountUseCase } from './application/use-cases/delete-account.use-case';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case';
// [Módulo Users]: Bounded Context que encapsula gestión de usuarios | [Patrón]: Module | [Principio]: ISP + DIP | [Paradigma]: POO

// [Provider con token simbólico]: Application depende de USER_REPOSITORY (Port), no de UserRepository (Adapter) | [Patrón]: DI Token
const userRepositoryProvider = {
  provide: USER_REPOSITORY,
  useClass: UserRepository,
};

@Module({
  // [TypeOrm feature]: registra entidad User para que @InjectRepository funcione
  imports: [
    TypeOrmModule.forFeature([User]),
    ConfigModule.forFeature(jwtConfig),
  ],
  controllers: [UsersController, ProfileController],
  providers: [
    userRepositoryProvider,
    CreateUserUseCase,
    GetProfileUseCase,
    UpdateProfileUseCase,
    GetUserHistoryUseCase,
    DeleteAccountUseCase,
    ChangePasswordUseCase,
  ],
  // [Exports]: Auth module necesita el repo para validar credenciales
  exports: [userRepositoryProvider, CreateUserUseCase, TypeOrmModule],
})
export class UsersModule {}
