import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Session } from '../../domain/entities/session.entity';
import {
  CreateSessionInput,
  ISessionRepository,
} from '../../domain/interfaces/session.repository.interface';
// [Adapter TypeORM]: implementa ISessionRepository | [Patrón]: Repository + Adapter (Hexagonal) | [Principio]: DIP | [Paradigma]: POO

@Injectable()
export class SessionRepository implements ISessionRepository {
  constructor(
    @InjectRepository(Session)
    private readonly repo: Repository<Session>,
  ) {}

  // [createSession]: persiste un nuevo refresh-token hasheado | [Principio]: SRP
  async createSession(input: CreateSessionInput): Promise<Session> {
    const entity = this.repo.create(input);
    return this.repo.save(entity);
  }

  // [findActiveByHash]: busca sesión vigente por hash de refresh | [Principio]: SRP
  async findActiveByHash(refreshTokenHash: string): Promise<Session | null> {
    return this.repo.findOne({
      where: {
        refreshTokenHash,
        isRevoked: false,
      },
    });
  }

  // [revoke]: marca sesión como invalidada (soft) | [Patrón]: Soft Delete
  async revoke(sessionId: string): Promise<void> {
    await this.repo.update({ id: sessionId }, { isRevoked: true });
  }

  // [revokeAllForUser]: usado en logout-all o cambio de password | [Principio]: SRP
  async revokeAllForUser(userId: string): Promise<void> {
    await this.repo.update({ userId, isRevoked: false }, { isRevoked: true });
  }

  // [purge job]: borrar sesiones expiradas (Sprint posterior + Bull cron)
  async purgeExpired(): Promise<number> {
    const result = await this.repo.delete({ expiresAt: LessThan(new Date()) });
    return result.affected ?? 0;
  }
}
