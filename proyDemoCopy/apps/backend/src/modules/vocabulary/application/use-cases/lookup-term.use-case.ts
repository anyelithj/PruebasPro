import { createHash } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  LanguageLookup,
  type LookupKind,
} from '../../domain/entities/language-lookup.entity';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
  type TermLookupResult,
} from '../../../../shared/domain/interfaces/language-tools.interface';
// [UseCases LookupTerm + GetLookup · Sprint 8.2 · RF-106/RF-107]: traducción + IPA UK/US con caché por huella; solo se llama a FastAPI si la huella no existe | [Patrón]: Cache-Aside + Use Case (Command/Query) | [Principio]: SRP + DIP (puerto) + determinístico primero | [Paradigma]: POO + async/await

// [fingerprintOf]: SHA-256 de los datos que definen el resultado (texto normalizado) | `createHash` (node:crypto)
export const fingerprintOf = (
  kind: LookupKind,
  language: string,
  text: string,
  context = '',
): string =>
  createHash('sha256')
    .update(
      [
        kind,
        language,
        'es',
        text.trim().toLowerCase(),
        context.trim().toLowerCase(),
      ].join('|'),
    )
    .digest('hex');

@Injectable()
export class LookupTermUseCase {
  constructor(
    @InjectRepository(LanguageLookup)
    private readonly lookups: Repository<LanguageLookup>,
    @Inject(LANGUAGE_TOOLS) private readonly tools: LanguageToolsPort,
  ) {}

  async execute(
    input: { text: string; language: string },
    token: string,
  ): Promise<LanguageLookup> {
    const fingerprint = fingerprintOf('term', input.language, input.text);
    const cached = await this.lookups.findOneBy({ fingerprint });
    if (cached) {
      await this.lookups.increment({ id: cached.id }, 'hits', 1); // Métrica de ahorro (sin releer la fila)
      return cached;
    }
    const result: TermLookupResult = await this.tools.lookup(
      input.text.trim(),
      input.language,
      token,
    );
    const row = this.lookups.create({
      fingerprint,
      kind: 'term',
      language: input.language,
      text: input.text.trim(),
      context: null,
      result: result as unknown as Record<string, unknown>,
      engine: result.engine,
      hits: 0,
    });
    // [No cachear fallos]: sin traducción (LLM caído) se devuelve el IPA pero no se guarda → la próxima consulta reintenta
    if (result.translation.model === 'unavailable') return row;
    await this.lookups
      .createQueryBuilder()
      .insert()
      .values(row as QueryDeepPartialEntity<LanguageLookup>)
      .orIgnore() // `ON CONFLICT DO NOTHING`: dos peticiones simultáneas con la misma huella no chocan
      .execute();
    return (await this.lookups.findOneBy({ fingerprint })) ?? row;
  }
}

@Injectable()
export class GetLookupUseCase {
  constructor(
    @InjectRepository(LanguageLookup)
    private readonly lookups: Repository<LanguageLookup>,
  ) {}

  async execute(id: string, kind: LookupKind): Promise<LanguageLookup> {
    const row = await this.lookups.findOneBy({ id, kind });
    if (!row) throw new NotFoundException('Consulta no encontrada');
    return row;
  }
}
