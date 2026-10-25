import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import jwtConfig from '../../../../shared/config/jwt.config';
import { User } from '../../domain/entities/user.entity';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/interfaces/user.repository.interface';
import { Email } from '../../domain/value-objects/email.vo';
import { Role } from '../../domain/value-objects/role.vo';
// [Use Case CreateUser]: único dueño del alta de la entidad User (registro público, alta ADMIN y OAuth) | [Patrón]: Command + Use Case | [Principio]: SRP + DRY + DIP | [Paradigma]: POO

// [Input]: contraseña en claro; el hash lo calcula solo este caso de uso
export interface CreateUserCommand {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: Role;
  section?: string | null;
  phone?: string | null; // [2026-10-24]: teléfono opcional
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: IUserRepository,
    @Inject(jwtConfig.KEY)
    private readonly jwtCfg: ConfigType<typeof jwtConfig>,
  ) {}

  async execute(cmd: CreateUserCommand): Promise<User> {
    // [Normalización de email via VO]: regex + lowercase
    const email = Email.create(cmd.email).value;

    // [Unicidad]: antes de hashear para no gastar CPU
    if (await this.repo.findByEmail(email)) {
      throw new ConflictException('Email already registered');
    }

    // [Hash bcrypt]: factor configurable (12 por defecto) | [Principio]: SSOT
    const passwordHash = await bcrypt.hash(
      cmd.password,
      this.jwtCfg.bcryptSaltRounds,
    );

    return this.repo.create({
      email,
      passwordHash,
      firstName: cmd.firstName.trim(),
      lastName: cmd.lastName.trim(),
      role: cmd.role ?? Role.USER,
      section: cmd.section?.trim() || null,
      phone: cmd.phone?.trim() || null,
    });
  }
}
