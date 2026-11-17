import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import jwtConfig from '../../../../shared/config/jwt.config';
import { LANGUAGE_TOOLS, type LanguageToolsPort } from '../../../../shared/domain/interfaces/language-tools.interface';
import { applyGrammar, needsGrammar } from '../../../curriculum/domain/content/vocabulary-grammar';
import { articleInLemma } from '../../../curriculum/domain/content/vocabulary-article';
import { RevisionChangeType } from '../../../curriculum/domain/entities/curriculum-item-revision.entity';
import type { CurriculumItem } from '../../../curriculum/domain/entities/curriculum-item.entity';
import { CURRICULUM_REVIEWED_EVENT, type CurriculumReviewedEvent } from '../../../curriculum/domain/events/curriculum-reviewed.event';
import { CURRICULUM_REPOSITORY, type ICurriculumRepository } from '../../../curriculum/domain/interfaces/curriculum.repository.interface';
import { CurriculumItemKind } from '../../../curriculum/domain/value-objects/curriculum-item-kind.vo';
// [CurriculumGrammarRepair · 2026-11-05 · Regla obligatoria de vocabulario]: las fichas de vocabulario del currículo guardadas SIN artículo/género/plural/clasificador
// se completan solas con la gramática de FastAPI (/noun-grammar, la misma del banco de vocabulario) y se guardan con revisión «corrección automática»
// Cuándo: al aprobarse un recurso y al arrancar el backend (barrido en segundo plano) | [Patrón]: Observer + Fail Soft (IA caída → se reintenta en el próximo arranque) | [Principio]: OCP (Curriculum no conoce a Vocabulary)

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const BOOT_DELAY_MS = 60_000; // Deja arrancar Ollama/FastAPI antes del barrido
const BOOT_LIMIT = 40; // ponytail: tope por arranque (~30 s por palabra en la IA); cola de trabajos si el currículo crece mucho
export { applyGrammar, needsGrammar }; // [2026-11-06]: viven en curriculum/domain/content/vocabulary-grammar (también se usan al generar)

@Injectable()
export class CurriculumGrammarRepairListener implements OnApplicationBootstrap {
  private readonly logger = new Logger(CurriculumGrammarRepairListener.name);
  private readonly tried = new Set<string>(); // Un intento por recurso y arranque (no insiste si la IA no sabe)
  private failed = false; // El último repair lanzó error (IA/servicio caído), no «la IA no sabe»

  constructor(
    @Inject(CURRICULUM_REPOSITORY) private readonly items: ICurriculumRepository,
    @Inject(LANGUAGE_TOOLS) private readonly tools: LanguageToolsPort,
    private readonly jwt: JwtService,
    @Inject(jwtConfig.KEY) private readonly cfg: ConfigType<typeof jwtConfig>,
  ) {}

  // [Nuevos]: recurso aprobado → se completa en segundo plano
  @OnEvent(CURRICULUM_REVIEWED_EVENT, { async: true })
  async onReviewed(event: CurriculumReviewedEvent): Promise<void> {
    if (!event.approved) return;
    const item = await this.items.findById(event.itemId).catch(() => null);
    if (item) await this.repair(item);
  }

  // [Guardados antes de la regla]: barrido al arrancar (no bloquea el arranque)
  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    setTimeout(() => void this.sweep().catch((err) => this.logger.warn(`Barrido de gramática: ${String(err)}`)), BOOT_DELAY_MS).unref();
  }

  async sweep(): Promise<number> {
    let fixed = 0;
    let attempts = 0;
    for (let page = 1; attempts < BOOT_LIMIT; page++) {
      const { data } = await this.items.search({ kind: CurriculumItemKind.VOCABULARY, page, limit: 100 });
      if (!data.length) break;
      for (const item of data) {
        if (attempts >= BOOT_LIMIT) break;
        if (!needsGrammar(item.language, item.content) || this.tried.has(item.id)) continue;
        attempts++;
        this.failed = false;
        if (await this.repair(item)) fixed++;
        else if (this.failed) break; // [2026-11-07]: servicio caído → corta el barrido (antes: 38 peticiones fallidas seguidas); se reintenta en el próximo arranque
      }
    }
    if (attempts) this.logger.log(`Gramática de vocabulario: ${fixed} de ${attempts} fichas completadas`);
    return fixed;
  }

  // [repair]: true = se guardó la ficha completa | nunca lanza
  async repair(item: CurriculumItem): Promise<boolean> {
    if (item.kind !== CurriculumItemKind.VOCABULARY || !needsGrammar(item.language, item.content) || this.tried.has(item.id)) return false;
    this.tried.add(item.id);
    try {
      const lemma = str(item.content.lemma);
      const art = articleInLemma(item.language, lemma);
      const bare = art ? lemma.slice(art.length).trim() : lemma; // «der Tisch» → «Tisch» para la consulta
      const token = await this.jwt.signAsync({ sub: item.createdBy, role: 'TEACHER', svc: 'vocabulary' }, { secret: this.cfg.accessSecret, expiresIn: 300 });
      const next = applyGrammar(item.language, item.content, await this.tools.nounGrammar(bare, item.language, token));
      if (!next) return false;
      const version = item.version;
      item.content = next;
      await this.items.saveWithRevision(item, version, {
        changeType: RevisionChangeType.UPDATED,
        changedBy: item.createdBy,
        note: 'Corrección automática: artículo, género, plural o clasificador',
      });
      return true;
    } catch (err) {
      this.failed = true;
      this.logger.warn(`Sin gramática para la ficha ${item.id}: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}
