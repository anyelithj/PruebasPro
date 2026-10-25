import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FluencyMetric } from '../../domain/entities/fluency-metric.entity';
// [UseCase ClearMyFluency · Sprint 8.5]: borra el historial propio de métricas de fluidez (privacidad) | [Patrón]: Use Case (Command) | [Principio]: SRP + derecho de supresión | [Paradigma]: POO

@Injectable()
export class ClearMyFluencyUseCase {
  constructor(
    @InjectRepository(FluencyMetric)
    private readonly metrics: Repository<FluencyMetric>,
  ) {}

  async execute(userId: string): Promise<{ deleted: number }> {
    const { affected } = await this.metrics.delete({ userId });
    return { deleted: affected ?? 0 };
  }
}
