import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EmailVerificationToken } from '../../domain/entities/email-verification-token.entity';
import {
  CreateEmailVerificationTokenInput,
  IEmailVerificationTokenRepository,
} from '../../domain/interfaces/email-verification-token.repository.interface';

@Injectable()
export class EmailVerificationTokenRepository implements IEmailVerificationTokenRepository {
  constructor(
    @InjectRepository(EmailVerificationToken)
    private readonly repo: Repository<EmailVerificationToken>,
  ) {}

  async create(
    input: CreateEmailVerificationTokenInput,
  ): Promise<EmailVerificationToken> {
    const entity = this.repo.create(input);
    return this.repo.save(entity);
  }

  async findActiveByHash(
    tokenHash: string,
  ): Promise<EmailVerificationToken | null> {
    return this.repo.findOne({
      where: { tokenHash, usedAt: IsNull() },
    });
  }

  async markUsed(id: string): Promise<void> {
    await this.repo.update({ id }, { usedAt: new Date() });
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    await this.repo.update(
      { userId, usedAt: IsNull() },
      { usedAt: new Date() },
    );
  }
}
