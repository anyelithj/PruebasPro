import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { LanguageLookup } from '../../domain/entities/language-lookup.entity';
import {
  LANGUAGE_TOOLS,
  type LanguageToolsPort,
} from '../../../../shared/domain/interfaces/language-tools.interface';
import { fingerprintOf } from './lookup-term.use-case';
// [UseCase LookupWord · Sprint 8.2 · RF-136]: palabra dentro de su frase → traducción según el contexto, IPA y dos ejemplos; reutiliza la caché LanguageLookup (kind = word) | [Patrón]: Cache-Aside + Use Case | [Principio]: SRP + DRY (misma tabla y misma huella que LookupTerm) | [Paradigma]: POO + async/await

@Injectable()
export class LookupWordUseCase {
  constructor(
    @InjectRepository(LanguageLookup)
    private readonly lookups: Repository<LanguageLookup>,
    @Inject(LANGUAGE_TOOLS) private readonly tools: LanguageToolsPort,
  ) {}

  async execute(
    input: { word: string; sentence?: string; language: string },
    token: string,
  ): Promise<LanguageLookup> {
    const sentence = input.sentence?.trim() ?? '';
    const fingerprint = fingerprintOf(
      'word',
      input.language,
      input.word,
      sentence,
    );
    const cached = await this.lookups.findOneBy({ fingerprint });
    if (cached) {
      await this.lookups.increment({ id: cached.id }, 'hits', 1);
      return cached;
    }
    const result = await this.tools.word(
      input.word.trim(),
      sentence,
      input.language,
      token,
    );
    const row = this.lookups.create({
      fingerprint,
      kind: 'word',
      language: input.language,
      text: input.word.trim(),
      context: sentence || null,
      result: result as unknown as Record<string, unknown>,
      engine: result.engine,
      hits: 0,
    });
    if (!result.translation) return row; // LLM caído: IPA sí, caché no
    await this.lookups
      .createQueryBuilder()
      .insert()
      .values(row as QueryDeepPartialEntity<LanguageLookup>)
      .orIgnore() // `ON CONFLICT DO NOTHING`: dos peticiones simultáneas con la misma huella no chocan
      .execute();
    return (await this.lookups.findOneBy({ fingerprint })) ?? row;
  }
}
