import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import jwtConfig from '../../shared/config/jwt.config';
import oauthConfig from '../../shared/config/oauth.config';
import { UsersModule } from '../users/users.module';
import { EmailVerificationToken } from './domain/entities/email-verification-token.entity';
import { PasswordResetToken } from './domain/entities/password-reset-token.entity';
import { Session } from './domain/entities/session.entity';
import { SESSION_REPOSITORY } from './domain/interfaces/session.repository.interface';
import { EMAIL_VERIFICATION_TOKEN_REPOSITORY } from './domain/interfaces/email-verification-token.repository.interface';
import { OAUTH_VERIFIER_REGISTRY } from './domain/interfaces/oauth-verifier.interface';
import { PASSWORD_RESET_TOKEN_REPOSITORY } from './domain/interfaces/password-reset-token.repository.interface';
import { TOKEN_SERVICE } from './domain/interfaces/token.service.interface';
import { MAIL_SERVICE } from './domain/interfaces/mail.service.interface';
import { SessionRepository } from './infrastructure/repositories/session.repository';
import { EmailVerificationTokenRepository } from './infrastructure/repositories/email-verification-token.repository';
import { PasswordResetTokenRepository } from './infrastructure/repositories/password-reset-token.repository';
import { GoogleOAuthVerifier } from './infrastructure/services/google-oauth.verifier';
import { JwtTokenService } from './infrastructure/services/jwt-token.service';
import { MicrosoftOAuthVerifier } from './infrastructure/services/microsoft-oauth.verifier';
import { OAuthVerifierRegistry } from './infrastructure/services/oauth-verifier.registry';
import { EnqueueEmailUseCase } from '../notifications/application/use-cases/enqueue-email.use-case';
import { NotificationsModule } from '../notifications/notifications.module';
import { MagicLinkToken } from './domain/entities/magic-link-token.entity';
import { MagicLinkController } from './presentation/magic-link.controller';
import { RequestMagicLinkUseCase } from './application/use-cases/request-magic-link.use-case';
import { VerifyMagicLinkUseCase } from './application/use-cases/verify-magic-link.use-case';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { LocalStrategy } from './infrastructure/strategies/local.strategy';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { OAuthLoginUseCase } from './application/use-cases/oauth-login.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset.use-case';
import { RequestVerifyEmailUseCase } from './application/use-cases/request-verify-email.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';
import { AuthController } from './presentation/auth.controller';
// [Módulo Auth]: Bounded Context de autenticación | [Patrón]: Module + DI Container | [Principio]: ISP + DIP | [Paradigma]: POO

// [Providers Ports]: Application depende de tokens simbólicos, no de clases concretas | [Patrón]: DI Token
const sessionRepoProvider = {
  provide: SESSION_REPOSITORY,
  useClass: SessionRepository,
};
const tokenServiceProvider = {
  provide: TOKEN_SERVICE,
  useClass: JwtTokenService,
};
// [Provider OAuth registry]: expone IOAuthVerifierRegistry vía DI token | [Patrón]: DI Token + Registry
const oauthRegistryProvider = {
  provide: OAUTH_VERIFIER_REGISTRY,
  useClass: OAuthVerifierRegistry,
};
// [Provider PasswordResetTokenRepository]: expone IPasswordResetTokenRepository via DI
const passwordResetRepoProvider = {
  provide: PASSWORD_RESET_TOKEN_REPOSITORY,
  useClass: PasswordResetTokenRepository,
};
// [Provider EmailVerificationTokenRepository]: expone IEmailVerificationTokenRepository via DI
const emailVerificationRepoProvider = {
  provide: EMAIL_VERIFICATION_TOKEN_REPOSITORY,
  useClass: EmailVerificationTokenRepository,
};

// [Provider MailService · Sprint 7.15]: IMailService = bandeja de salida (EnqueueEmailUseCase de Notifications) → los correos se guardan y se envían con cola y reintentos | [Patrón]: DI Token + Alias (`useExisting`) | [Principio]: OCP (los casos de uso de Auth no cambian)
const mailServiceProvider = {
  provide: MAIL_SERVICE,
  useExisting: EnqueueEmailUseCase,
};

@Module({
  imports: [
    // [UsersModule]: re-exporta USER_REPOSITORY que necesitan UseCases y JwtStrategy
    UsersModule,
    NotificationsModule, // [Sprint 7.15]: EnqueueEmailUseCase (correo con bandeja de salida)
    // [Entities Auth]: registra repos TypeORM (Session + tokens efímeros)
    TypeOrmModule.forFeature([
      Session,
      EmailVerificationToken,
      PasswordResetToken,
      MagicLinkToken, // [Sprint 7.18]: acceso sin contraseña
    ]),
    // [Passport bootstrap]: requerido por strategies | [Patrón]: Strategy
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // [JwtModule]: registro vacío — JwtTokenService pasa secret y expiresIn en cada signAsync
    JwtModule.register({}),
    // [Config feature]: hace jwtConfig.KEY + oauthConfig.KEY inyectables en este módulo
    ConfigModule.forFeature(jwtConfig),
    ConfigModule.forFeature(oauthConfig),
  ],
  controllers: [AuthController, MagicLinkController],
  providers: [
    // [Strategies passport]: registran 'jwt' y 'local'
    JwtStrategy,
    LocalStrategy,
    // [Adapters]: implementan los Ports
    sessionRepoProvider,
    tokenServiceProvider,
    passwordResetRepoProvider,
    emailVerificationRepoProvider,
    mailServiceProvider,
    // [Verifiers OAuth]: adapters Google/Microsoft + registry
    GoogleOAuthVerifier,
    MicrosoftOAuthVerifier,
    oauthRegistryProvider,
    // [Use cases]: orquestadores de dominio
    RegisterUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    VerifyEmailUseCase,
    RequestVerifyEmailUseCase,
    OAuthLoginUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    RequestMagicLinkUseCase,
    VerifyMagicLinkUseCase,
  ],
  exports: [tokenServiceProvider, sessionRepoProvider],
})
export class AuthModule {}
