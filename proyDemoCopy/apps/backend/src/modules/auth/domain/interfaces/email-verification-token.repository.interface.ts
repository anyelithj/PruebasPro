import { EmailVerificationToken } from '../entities/email-verification-token.entity';

export const EMAIL_VERIFICATION_TOKEN_REPOSITORY = Symbol(
  'EMAIL_VERIFICATION_TOKEN_REPOSITORY',
);

export interface CreateEmailVerificationTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface IEmailVerificationTokenRepository {
  create(
    input: CreateEmailVerificationTokenInput,
  ): Promise<EmailVerificationToken>;
  findActiveByHash(tokenHash: string): Promise<EmailVerificationToken | null>;
  markUsed(id: string): Promise<void>;
  invalidateAllForUser(userId: string): Promise<void>;
}
