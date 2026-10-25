import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePlayScenario } from '../../domain/entities/roleplay-scenario.entity';
import type { ScenarioInput } from './create-scenario.use-case';
import { GetScenarioUseCase } from './list-scenarios.use-case';
// [UseCase UpdateScenario · Sprint 8.5]: edita un escenario (el slug no cambia: las partidas guardan el id) | [Patrón]: Use Case (Command) | [Principio]: SRP + DRY (GetScenario) | [Paradigma]: POO

@Injectable()
export class UpdateScenarioUseCase {
  constructor(
    @InjectRepository(RolePlayScenario)
    private readonly scenarios: Repository<RolePlayScenario>,
    private readonly get: GetScenarioUseCase,
  ) {}

  async execute(
    id: string,
    patch: Partial<ScenarioInput>,
  ): Promise<RolePlayScenario> {
    const scenario = await this.get.execute(id);
    Object.assign(
      scenario,
      Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined),
      ),
    );
    return this.scenarios.save(scenario);
  }
}
