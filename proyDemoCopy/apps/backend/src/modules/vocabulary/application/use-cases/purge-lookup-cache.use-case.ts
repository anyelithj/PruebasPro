import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LanguageLookup } from '../../domain/entities/language-lookup.entity';
// [UseCase PurgeLookupCache · Sprint 8.2]: vacía la caché de traducciones e IPA (ADMIN) — p. ej. tras cambiar la versión de espeak-ng o el modelo | [Patrón]: Use Case (Command) | [Principio]: SRP | [Paradigma]: POO

@Injectable()
export class PurgeLookupCacheUseCase {
  constructor(
    @InjectRepository(LanguageLookup)
    private readonly lookups: Repository<LanguageLookup>,
  ) {}

  async execute(): Promise<{ deleted: number }> {
    const { affected } = await this.lookups
      .createQueryBuilder()
      .delete()
      .execute(); // DELETE sin WHERE explícito (TypeORM lo exige así)
    return { deleted: affected ?? 0 };
  }
}
