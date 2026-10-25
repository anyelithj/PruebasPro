import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PasswordResetToken } from '../../domain/entities/password-reset-token.entity';
import {
  CreatePasswordResetTokenInput,
  IPasswordResetTokenRepository,
} from '../../domain/interfaces/password-reset-token.repository.interface';

@Injectable()
export class PasswordResetTokenRepository implements IPasswordResetTokenRepository {
  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly repo: Repository<PasswordResetToken>,
  ) {}

  async create(
    input: CreatePasswordResetTokenInput,
  ): Promise<PasswordResetToken> {
    const entity = this.repo.create(input);
    return this.repo.save(entity);
  }

  async findActiveByHash(
    tokenHash: string,
  ): Promise<PasswordResetToken | null> {
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
