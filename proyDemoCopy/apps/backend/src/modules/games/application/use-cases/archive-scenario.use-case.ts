import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePlayScenario } from '../../domain/entities/roleplay-scenario.entity';
import { GetScenarioUseCase } from './list-scenarios.use-case';
// [UseCase ArchiveScenario · Sprint 8.5]: borrado lógico (archivedAt) — las partidas antiguas siguen mostrando su escenario | [Patrón]: Soft Delete | [Principio]: SRP | [Paradigma]: POO

@Injectable()
export class ArchiveScenarioUseCase {
  constructor(
    @InjectRepository(RolePlayScenario)
    private readonly scenarios: Repository<RolePlayScenario>,
    private readonly get: GetScenarioUseCase,
  ) {}

  async execute(id: string): Promise<void> {
    const scenario = await this.get.execute(id);
    scenario.archivedAt = new Date();
    await this.scenarios.save(scenario);
  }
}
