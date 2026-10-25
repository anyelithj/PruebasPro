import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RolePlayScenario,
  type ScenarioObjective,
} from '../../domain/entities/roleplay-scenario.entity';
// [UseCase CreateScenario · Sprint 8.5 · RF-101]: un docente o ADMIN crea un escenario con papel del agente, objetivos y vocabulario | [Patrón]: Use Case (Command) | [Principio]: SRP | [Paradigma]: POO

export interface ScenarioInput {
  title: string;
  language: string;
  level: string;
  emoji?: string;
  role: string;
  opening?: string;
  objectives: ScenarioObjective[];
  vocabulary?: string[];
}

// [slugOf]: «En el banco» + en → «en-en-el-banco» (sin tildes ni signos) | Función pura
export const slugOf = (language: string, title: string): string =>
  `${language}-${title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`.slice(0, 80);

@Injectable()
export class CreateScenarioUseCase {
  constructor(
    @InjectRepository(RolePlayScenario)
    private readonly scenarios: Repository<RolePlayScenario>,
  ) {}

  async execute(
    actorId: string,
    input: ScenarioInput,
  ): Promise<RolePlayScenario> {
    const slug = slugOf(input.language, input.title);
    if (await this.scenarios.existsBy({ slug }))
      throw new ConflictException('Ya existe un escenario con ese título');
    return this.scenarios.save(
      this.scenarios.create({
        ...input,
        slug,
        emoji: input.emoji ?? '💬',
        opening: input.opening ?? '',
        vocabulary: input.vocabulary ?? [],
        createdBy: actorId,
        archivedAt: null,
      }),
    );
  }
}
