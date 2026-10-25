import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CURRICULUM_REPOSITORY,
  type ICurriculumRepository,
} from '../../domain/interfaces/curriculum.repository.interface';
// [Command DeleteCurriculumItem]: baja definitiva de un recurso (solo ADMIN, lo exige el controller) | [Patrón]: Command Handler (CQRS) | [Principio]: SRP + DIP | [Paradigma]: POO + async/await

@Injectable()
export class DeleteCurriculumItemCommand {
  constructor(
    @Inject(CURRICULUM_REPOSITORY) private readonly repo: ICurriculumRepository,
  ) {}

  async execute(id: string): Promise<{ deleted: true; id: string }> {
    if (!(await this.repo.findById(id)))
      throw new NotFoundException(`Recurso ${id} no encontrado`); // 404 claro en vez de borrado silencioso
    await this.repo.remove(id);
    return { deleted: true, id };
  }
}
