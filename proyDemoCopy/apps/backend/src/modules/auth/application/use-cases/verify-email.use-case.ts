import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { USER_REPOSITORY } from '../../../users/domain/interfaces/user.repository.interface';
import type { IUserRepository } from '../../../users/domain/interfaces/user.repository.interface';
import { EMAIL_VERIFICATION_TOKEN_REPOSITORY } from '../../domain/interfaces/email-verification-token.repository.interface';
import type { IEmailVerificationTokenRepository } from '../../domain/interfaces/email-verification-token.repository.interface';

@Injectable()
export class VerifyEmailUseCase {
  private readonly logger = new Logger(VerifyEmailUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(EMAIL_VERIFICATION_TOKEN_REPOSITORY)
    private readonly tokens: IEmailVerificationTokenRepository,
  ) {}

  async execute(token: string): Promise<{ verified: true }> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.tokens.findActiveByHash(tokenHash);

    if (!record) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (record.isExpired()) {
      throw new BadRequestException('Verification token has expired');
    }

    const user = await this.users.findById(record.userId);
    if (!user || !user.isActive) {
      throw new BadRequestException('User not found or inactive');
    }

    if (user.isEmailVerified) {
      await this.tokens.markUsed(record.id);
      return { verified: true };
    }

    await this.users.update(user.id, { isEmailVerified: true });
    await this.tokens.markUsed(record.id);

    this.logger.log(`Email verified: ${user.email}`);
    return { verified: true };
  }
}
