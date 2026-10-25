import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, type FindOptionsWhere } from 'typeorm';
import { RolePlayScenario } from '../../domain/entities/roleplay-scenario.entity';
// [UseCases ListScenarios + GetScenario · Sprint 8.5 · RF-101]: escenarios activos por idioma y nivel, y detalle con objetivos y vocabulario | [Patrón]: Query + Soft Delete (filtra archivedAt) | [Principio]: SRP | [Paradigma]: POO

@Injectable()
export class ListScenariosUseCase {
  constructor(
    @InjectRepository(RolePlayScenario)
    private readonly scenarios: Repository<RolePlayScenario>,
  ) {}

  execute(filter: {
    language?: string;
    level?: string;
  }): Promise<RolePlayScenario[]> {
    const where: FindOptionsWhere<RolePlayScenario> = {
      archivedAt: IsNull(),
      ...(filter.language ? { language: filter.language } : {}),
      ...(filter.level ? { level: filter.level } : {}),
    };
    return this.scenarios.find({
      where,
      order: { level: 'ASC', title: 'ASC' },
    });
  }
}

@Injectable()
export class GetScenarioUseCase {
  constructor(
    @InjectRepository(RolePlayScenario)
    private readonly scenarios: Repository<RolePlayScenario>,
  ) {}

  async execute(id: string): Promise<RolePlayScenario> {
    const scenario = await this.scenarios.findOneBy({
      id,
      archivedAt: IsNull(),
    });
    if (!scenario) throw new NotFoundException('Escenario no encontrado');
    return scenario;
  }
}
