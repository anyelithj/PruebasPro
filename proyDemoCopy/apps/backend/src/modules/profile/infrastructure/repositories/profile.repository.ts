import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfile } from '../../domain/entities/user-profile.entity';
import {
  IProfileRepository,
  UpsertProfileInput,
} from '../../domain/interfaces/profile.repository.interface';
// [Adapter TypeORM ProfileRepository]: implementa IProfileRepository | [Patrón]: Adapter (Hexagonal) | [Principio]: DIP

@Injectable()
export class ProfileRepository implements IProfileRepository {
  constructor(
    @InjectRepository(UserProfile)
    private readonly repo: Repository<UserProfile>,
  ) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    return this.repo.findOne({ where: { userId } });
  }

  // [upsert]: insert si no existe, update si sí | [Patrón]: Upsert
  // Implementado como find+merge+save para mantener disparo de hooks/timestamps.
  async upsert(input: UpsertProfileInput): Promise<UserProfile> {
    const existing = await this.repo.findOne({
      where: { userId: input.userId },
    });
    if (existing) {
      existing.fullName = input.fullName;
      existing.dateOfBirth = input.dateOfBirth ?? null;
      existing.educationLevel = input.educationLevel ?? null;
      existing.productiveActivity = input.productiveActivity ?? null;
      return this.repo.save(existing);
    }
    const created = this.repo.create({
      userId: input.userId,
      fullName: input.fullName,
      dateOfBirth: input.dateOfBirth ?? null,
      educationLevel: input.educationLevel ?? null,
      productiveActivity: input.productiveActivity ?? null,
    });
    return this.repo.save(created);
  }

  async delete(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }
}
