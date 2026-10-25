import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import * as bcrypt from 'bcrypt';
import { USER_REPOSITORY } from '../../../users/domain/interfaces/user.repository.interface';
import type { IUserRepository } from '../../../users/domain/interfaces/user.repository.interface';
// [Strategy Local]: valida email/password en login | [Patrón]: Strategy (passport) | [Principio]: SRP | [Paradigma]: POO

// [Forma simplificada del user]: lo que devuelve validate() al request
export interface ValidatedUser {
  id: string;
  email: string;
  role: string;
}

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,
  ) {
    // [usernameField]: passport-local usa 'username' por default, lo mapeamos a 'email'
    super({ usernameField: 'email', passwordField: 'password' });
  }

  // [validate]: passport invoca esto con body.email y body.password | [Principio]: SRP
  async validate(email: string, password: string): Promise<ValidatedUser> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    // [Retorno]: queda en request.user (subset seguro, sin passwordHash)
    return { id: user.id, email: user.email, role: user.role };
  }
}
