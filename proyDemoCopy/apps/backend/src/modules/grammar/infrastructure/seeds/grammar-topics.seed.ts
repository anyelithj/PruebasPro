import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { slugify } from '../../../../shared/application/topic-crud.service';
import { GrammarExample } from '../../domain/entities/grammar-example.entity';
import { GrammarSection } from '../../domain/entities/grammar-section.entity';
import { GrammarTopic } from '../../domain/entities/grammar-topic.entity';
import type { SectionType } from '../../domain/section-type';
// [Seed GrammarTopics · Sprints 10.9/10.15 · RF-133/RF-134]: tres fichas semilla de inglés — Present Simple (A1), Present Continuous (A1) y Present Perfect (A2) — con uso, fórmula, negativa, interrogativa, nota y ejemplos | [Patrón]: Idempotent Seed (`OnModuleInit`: inserta solo las fichas que faltan) | [Principio]: contenido original (CC BY 4.0, © Aula de Idiomas) + verificación humana (ejemplos sin revisar; IPA y traducción con «Obtener IPA y traducción») | [Paradigma]: Declarativo

type SeedSection = [SectionType, string, string[]]; // tipo, texto, ejemplos

export const GRAMMAR_SEED: Array<{
  title: string;
  level: string;
  summary: string;
  sections: SeedSection[];
}> = [
  {
    title: 'Present Simple',
    level: 'A1',
    summary: 'Hábitos, rutinas y verdades generales.',
    sections: [
      ['usage', 'Se usa para hábitos y rutinas, hechos que siempre son ciertos y horarios fijos.', ['I drink coffee every morning.', 'Water boils at 100 degrees.', 'The train leaves at nine.']],
      ['formula', 'Sujeto + verbo (+ s/es con he, she, it) + complemento', ['She works in a hospital.', 'They live in Madrid.']],
      ['negative', "Sujeto + don't / doesn't + verbo en forma base", ["I don't like tea.", "He doesn't play football."]],
      ['interrogative', 'Do / Does + sujeto + verbo en forma base + ?', ['Do you speak English?', 'Does she have a car?']],
      ['note', 'Con he, she e it el verbo lleva -s (works), -es tras -s, -sh, -ch, -x, -o (watches, goes) e -ies tras consonante + y (studies).', ['He watches TV at night.', 'She studies every day.']],
      ['common_errors', 'No se añade -s después de does: «Does she works?» es incorrecto.', ['Does she work on Saturdays?']],
    ],
  },
  {
    title: 'Present Continuous',
    level: 'A1',
    summary: 'Acciones que ocurren ahora o en este período.',
    sections: [
      ['usage', 'Se usa para lo que está pasando en este momento, situaciones temporales y planes ya decididos.', ["I'm reading a book right now.", "We're staying with friends this week.", "She's meeting her boss tomorrow."]],
      ['formula', 'Sujeto + am / is / are + verbo con -ing', ['They are playing in the park.', 'He is cooking dinner.']],
      ['negative', "Sujeto + am not / isn't / aren't + verbo con -ing", ["I'm not working today.", "It isn't raining."]],
      ['interrogative', 'Am / Is / Are + sujeto + verbo con -ing + ?', ['Are you listening?', 'Is he sleeping?']],
      ['note', 'Los verbos de estado (know, like, want, believe) casi nunca se usan en continuo.', ['I know the answer.']],
    ],
  },
  {
    title: 'Present Perfect',
    level: 'A2',
    summary: 'Experiencias y acciones pasadas conectadas con el presente.',
    sections: [
      ['usage', 'Se usa para experiencias de vida, acciones recientes con efecto en el presente y situaciones que empezaron en el pasado y siguen (con for y since).', ["I've been to Paris twice.", "She's lost her keys.", "We've lived here for five years."]],
      ['formula', 'Sujeto + have / has + participio pasado', ['They have finished the project.', 'He has eaten sushi.']],
      ['negative', "Sujeto + haven't / hasn't + participio pasado", ["I haven't seen that film.", "She hasn't called yet."]],
      ['interrogative', 'Have / Has + sujeto + participio pasado + ?', ['Have you ever tried Mexican food?', 'Has he arrived?']],
      ['common_errors', 'No se usa con un momento terminado del pasado: «I have seen him yesterday» es incorrecto; se dice «I saw him yesterday».', ['I saw him yesterday.', "I've seen him this week."]],
    ],
  },
];

@Injectable()
export class GrammarTopicSeeder implements OnModuleInit {
  private readonly logger = new Logger(GrammarTopicSeeder.name);

  constructor(
    @InjectRepository(GrammarTopic)
    private readonly topics: Repository<GrammarTopic>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const existing = new Set(
        (
          await this.topics.find({
            where: { slug: In(GRAMMAR_SEED.map((t) => slugify(t.title))) },
            select: { slug: true },
          })
        ).map((t) => t.slug),
      );
      const missing = GRAMMAR_SEED.filter((t) => !existing.has(slugify(t.title)));
      for (const t of missing) {
        // `transaction` (TypeORM): una ficha entra completa o no entra
        await this.topics.manager.transaction(async (tx) => {
          const topic = await tx.save(
            tx.create(GrammarTopic, {
              slug: slugify(t.title),
              title: t.title,
              summary: t.summary,
              language: 'en',
              levels: [t.level],
              status: 'published',
              model: null,
              createdBy: null,
              archivedAt: null,
            }),
          );
          for (const [position, [type, body, examples]] of t.sections.entries()) {
            const section = await tx.save(
              tx.create(GrammarSection, { topicId: topic.id, position, type, title: '', body }),
            );
            await tx.save(
              examples.map((text, i) =>
                tx.create(GrammarExample, {
                  sectionId: section.id,
                  position: i,
                  text,
                  ipa: '',
                  ipaUs: null,
                  translation: null,
                  reviewed: false,
                }),
              ),
            );
          }
        });
      }
      if (missing.length) this.logger.log(`Fichas de gramática sembradas: ${missing.length}`);
    } catch (err) {
      this.logger.warn(
        `Seed de gramática omitido: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
