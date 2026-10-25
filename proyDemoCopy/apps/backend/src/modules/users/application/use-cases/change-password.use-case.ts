import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as bcrypt from 'bcrypt'; // [bcrypt]: hash adaptativo con sal (OWASP)
import jwtConfig from '../../../../shared/config/jwt.config';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/interfaces/user.repository.interface';
// [Use Case ChangePassword · 2026-10-23]: el usuario autenticado cambia su contraseña verificando la actual | [Patrón]: Command | [Principio]: SRP + Least Privilege
// ponytail: no revoca las otras sesiones (SESSION_REPOSITORY vive en Auth → dependencia circular); si se necesita, emitir un evento que Auth escuche

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(jwtConfig.KEY)
    private readonly jwtCfg: ConfigType<typeof jwtConfig>,
  ) {}

  async execute(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: true }> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    // `bcrypt.compare` (tiempo constante): la contraseña actual debe coincidir | [Seguridad]
    if (!(await bcrypt.compare(currentPassword, user.passwordHash)))
      throw new BadRequestException('La contraseña actual no es correcta');
    if (currentPassword === newPassword)
      throw new BadRequestException(
        'La nueva contraseña debe ser distinta de la actual',
      );
    const passwordHash = await bcrypt.hash(
      newPassword,
      this.jwtCfg.bcryptSaltRounds,
    );
    await this.users.update(userId, { passwordHash });
    return { success: true };
  }
}
