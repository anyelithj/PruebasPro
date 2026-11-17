import { createHash, randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { User } from '../../../users/domain/entities/user.entity';
import { LoginOtp } from '../../domain/entities/login-otp.entity';
import {
  MAIL_SERVICE,
  type IMailService,
} from '../../domain/interfaces/mail.service.interface';
import { codeEmail } from '../mail/link-email';
// [Casos de uso 2FA · 2026-11-16]: segundo factor por código OTP (6 dígitos) enviado al correo | [Patrón]: Use Case (Command) + Token de un solo uso + Compare-and-Set | [Principio]: SRP (una clase por acción; este archivo NO importa LoginUseCase → sin dependencia circular) + DIP (correo por IMailService = bandeja de salida con reintentos) + DRY (LoginUseCase.issue emite la sesión) | [Paradigma]: POO + async/await
// ponytail: OTP por correo (sin app TOTP ni dependencia nueva); si se pide Google Authenticator → otplib + secreto cifrado por usuario

const OTP_TTL_MIN = 10; // Vida del código en minutos
export const MAX_OTP_ATTEMPTS = 5; // Intentos fallidos por reto antes de invalidarlo

// [Respuesta del login con 2FA]: sin tokens; el frontend pide el código y llama a /auth/2fa/verify | `export interface` (TS)
export interface TwoFactorChallenge {
  twoFactorRequired: true; // Tipo literal (TS): discrimina la unión AuthResponseDto | TwoFactorChallenge
  challengeId: string;
}

// [hashCode]: SHA-256 de `userId:código` (el userId sala el hash) | arrow function (ES2015) | [Paradigma]: Funcional (pura)
export const hashCode = (userId: string, code: string): string =>
  createHash('sha256').update(`${userId}:${code}`).digest('hex');

// [IssueLoginOtpUseCase]: crea el reto y envía el código; lo llama LoginUseCase tras validar la contraseña
@Injectable() // `@Injectable` (NestJS): registra la clase en el contenedor de DI
export class IssueLoginOtpUseCase {
  constructor(
    // `@InjectRepository` (NestJS + TypeORM): repositorio de la entidad | [Patrón]: Repository
    @InjectRepository(LoginOtp) private readonly otps: Repository<LoginOtp>,
    // `@Inject(TOKEN)` (NestJS): depende del puerto, no de nodemailer | [Principio]: DIP
    @Inject(MAIL_SERVICE) private readonly mail: IMailService,
  ) {}

  async execute(user: User): Promise<TwoFactorChallenge> {
    // [Un solo reto vigente]: los códigos anteriores del usuario dejan de servir
    await this.otps.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    // `randomInt` (Node crypto): CSPRNG uniforme 0…999999 | `padStart` (ES2017): conserva ceros a la izquierda
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const row = await this.otps.save(
      this.otps.create({
        userId: user.id,
        codeHash: hashCode(user.id, code),
        attempts: 0,
        expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000),
        usedAt: null,
      }),
    );
    // [Sin try/catch]: si no se puede encolar el correo, el usuario no podría entrar → el error sube en vez de un reto imposible
    await this.mail.send(
      codeEmail({
        to: user.email,
        firstName: user.firstName ?? '',
        subject: 'Tu código de acceso',
        intro: `Escribe este código para terminar de iniciar sesión (válido ${OTP_TTL_MIN} minutos, un solo uso):`,
        code,
        footer:
          'Si no intentaste entrar, cambia tu contraseña: alguien la conoce.',
      }),
    );
    return { twoFactorRequired: true, challengeId: row.id };
  }
}
