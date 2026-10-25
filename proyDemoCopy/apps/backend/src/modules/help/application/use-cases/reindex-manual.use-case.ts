import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssistantClientService } from '../../../ai/assistant-client.service';
import {
  Faq,
  HELP_LOCALES,
  HELP_ROLES,
  type HelpLocale,
  type HelpRole,
} from '../../domain/entities/faq.entity';
import { ManualArticle } from '../../domain/entities/manual-article.entity';
import { FaqIndexSync } from './create-faq.use-case';
// [UseCase ReindexManual · Sprints 7.10/7.12 · RF-95/97]: lee docs/manual-usuario/{es,en}/*.md, publica los artículos en la tabla, siembra la FAQ inicial (faq.json) y reconstruye los índices del Agente Guía | [Patrón]: Use Case (Command) + Sync (repositorio → BD → FAISS) + Seed idempotente | [Principio]: SSOT (los archivos del repo mandan) + DRY (FaqIndexSync) | [Paradigma]: POO + Funcional (`parseArticle` es pura)
// [Seguridad]: solo se leen archivos de la carpeta configurada con nombre `[a-z0-9-]+.md` → sin rutas inyectadas · [FAQ inicial]: solo inserta las que faltan (nunca pisa lo que editó un ADMIN)

// [Carpeta]: HELP_MANUAL_DIR o, por defecto, la del monorepo (el backend corre en apps/backend)
export const manualDir = (): string =>
  process.env.HELP_MANUAL_DIR ??
  resolve(process.cwd(), '..', '..', 'docs', 'manual-usuario');
const FILE = /^([a-z0-9-]+)\.md$/;
const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/; // Encabezado YAML mínimo (`clave: valor`)

export interface ParsedArticle {
  slug: string;
  locale: HelpLocale;
  role: HelpRole;
  title: string;
  body: string;
  sha256: string;
}

// [parseArticle]: Markdown con encabezado → artículo | rol desconocido = ALL · título = `title` o el primer `# ` | [Paradigma]: función pura
export function parseArticle(
  slug: string,
  locale: HelpLocale,
  raw: string,
): ParsedArticle {
  const m = FRONT.exec(raw);
  const meta = new Map(
    (m?.[1] ?? '')
      .split(/\r?\n/)
      .map((l) => /^(\w+):\s*(.+)$/.exec(l))
      .filter((x): x is RegExpExecArray => !!x)
      .map((x) => [x[1], x[2].trim()] as const),
  );
  const body = raw.slice(m?.[0].length ?? 0).trim();
  const role = HELP_ROLES.find((r) => r === meta.get('role')) ?? 'ALL';
  const title = meta.get('title') ?? /^#\s+(.+)$/m.exec(body)?.[1] ?? slug;
  return {
    slug,
    locale,
    role,
    title,
    body,
    sha256: createHash('sha256').update(raw).digest('hex'),
  };
}

interface SeedFaq {
  question: string;
  answer: string;
  category: string;
  role?: HelpRole;
  manualSlug?: string;
}

@Injectable()
export class ReindexManualUseCase {
  private readonly logger = new Logger(ReindexManualUseCase.name);

  constructor(
    @InjectRepository(ManualArticle)
    private readonly articles: Repository<ManualArticle>,
    @InjectRepository(Faq) private readonly faqs: Repository<Faq>,
    private readonly assistant: AssistantClientService,
    private readonly faqSync: FaqIndexSync,
  ) {}

  async execute(token: string) {
    const dir = manualDir();
    const parsed: ParsedArticle[] = [];
    let faqsSeeded = 0;
    for (const locale of HELP_LOCALES) {
      const files = await readdir(join(dir, locale)).catch(() => {
        throw new ServiceUnavailableException(
          `No se encontró el manual en ${join(dir, locale)} (define HELP_MANUAL_DIR)`,
        );
      });
      for (const file of files.sort()) {
        const slug = FILE.exec(file)?.[1];
        if (slug)
          parsed.push(
            parseArticle(
              slug,
              locale,
              await readFile(join(dir, locale, file), 'utf8'),
            ),
          );
      }
      faqsSeeded += await this.seedFaqs(join(dir, locale, 'faq.json'), locale);
    }

    // [Upsert por huella]: solo se reescriben los artículos que cambiaron · los que ya no tienen archivo se borran
    const existing = await this.articles.find();
    const key = (a: { slug: string; locale: string }) =>
      `${a.locale}/${a.slug}`;
    const current = new Map(existing.map((a) => [key(a), a]));
    const changed = parsed.filter(
      (p) => current.get(key(p))?.sha256 !== p.sha256,
    );
    await this.articles.save(
      changed.map((p) =>
        this.articles.create({ ...current.get(key(p)), ...p }),
      ),
    );
    const keep = new Set(parsed.map(key));
    const gone = existing.filter((a) => !keep.has(key(a)));
    if (gone.length) await this.articles.remove(gone);

    // [Índices]: el manual completo (FastAPI lo divide por `## `) y la FAQ (incluye la recién sembrada) · fail-soft igual que la FAQ
    const sections = await this.assistant
      .reindexManual(
        parsed.map(({ slug, title, role, locale, body }) => ({
          slug,
          title,
          role,
          locale,
          body,
        })),
        token,
      )
      .then((r) => r.sections)
      .catch((err: unknown) => {
        this.logger.warn(
          `Índice del manual sin actualizar: ${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      });
    const faqIndexed = await this.faqSync.execute(token);
    return {
      articles: parsed.length,
      updated: changed.length,
      removed: gone.length,
      faqsSeeded,
      sections,
      faqIndexed,
    };
  }

  // [seedFaqs]: inserta las preguntas de faq.json que aún no existen (misma pregunta e idioma) → re-ejecutar no duplica
  private async seedFaqs(path: string, locale: HelpLocale): Promise<number> {
    const raw = await readFile(path, 'utf8').catch(() => null);
    if (!raw) return 0;
    const seed = JSON.parse(raw) as SeedFaq[];
    const known = new Set(
      (
        await this.faqs.find({ where: { locale }, select: { question: true } })
      ).map((f) => f.question),
    );
    const fresh = seed.filter(
      (s) => s.question && s.answer && !known.has(s.question),
    );
    await this.faqs.save(
      fresh.map((s) =>
        this.faqs.create({
          question: s.question,
          answer: s.answer,
          category: s.category,
          role: HELP_ROLES.find((r) => r === s.role) ?? 'ALL',
          locale,
          manualSlug: s.manualSlug ?? null,
          status: 'published',
          reviewedAt: new Date(),
        }),
      ),
    );
    return fresh.length;
  }
}
