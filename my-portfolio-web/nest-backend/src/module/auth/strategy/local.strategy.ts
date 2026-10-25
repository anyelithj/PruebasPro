// [STRATEGY] autenticación email + password
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { UnauthorizedException } from 'src/common/exceptions/validation.exception';
import { verifyPassword } from 'src/common/utils/hash.util';
import { UserModel } from 'src/module/user/model/user.model';
import { UserRepository } from 'src/module/user/repository/user.repository';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly users: UserRepository) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  async validate(email: string, password: string): Promise<UserModel> {
    const user = await this.users.findByEmail(email);
    // [CC-C] mismo error para "no existe" y "password malo": evita user enumeration.
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('User inactive');
    }
    return user;
  }
}
