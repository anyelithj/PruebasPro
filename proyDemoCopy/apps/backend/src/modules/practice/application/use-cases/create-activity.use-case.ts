import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PracticeActivity } from '../../domain/entities/practice-activity.entity';
import { PracticeItem } from '../../domain/entities/practice-item.entity';
import { itemProblem } from '../../domain/item-rules';
import type { ActivityContent, ItemType, Skill } from '../../domain/item-type';
// [UseCase CreateActivity · Sprint 8.12 · RF-110/RF-114]: crea la actividad a mano o desde un borrador de IA con sus ítems, en una transacción; siempre nace en borrador (revisión del docente antes de publicar) | [Patrón]: Use Case (Command) + Unit of Work (transacción) | [Principio]: SRP + Fail Fast (reglas del ítem) | [Paradigma]: POO + async/await

export interface ItemInput {
  itemType: ItemType;
  skill: Skill;
  prompt: string;
  options?: string[];
  accepted: string[][];
  corrections?: Record<string, string>;
  explanation?: string;
  tip?: string;
}

export interface ActivityInput {
  title: string;
  description?: string;
  language: string;
  level: string;
  skill: Skill;
  aiDraft?: boolean;
  items?: ItemInput[];
  contents?: ActivityContent[]; // [2026-10-23]: material vinculado de otras secciones
}

// [toItem]: normaliza un ItemInput (por defecto vacíos) y valida su coherencia | Lo reutilizan AddItem y UpdateItem (DRY)
export function checkedItem(input: ItemInput): Required<ItemInput> {
  const item = {
    options: [],
    corrections: {},
    explanation: '',
    tip: '',
    ...input,
  };
  const problem = itemProblem(item);
  if (problem) throw new BadRequestException(problem);
  return item;
}

@Injectable()
export class CreateActivityUseCase {
  constructor(
    @InjectRepository(PracticeActivity)
    private readonly activities: Repository<PracticeActivity>,
    private readonly db: DataSource,
  ) {}

  // [opts.published · Sprint 9.10]: solo Music lo usa — ítems deterministas sacados de la letra de una canción ya revisada y publicada por el ADMIN
  async execute(
    actorId: string,
    input: ActivityInput,
    opts: { published?: boolean } = {},
  ): Promise<PracticeActivity> {
    const items = (input.items ?? []).map(checkedItem); // Valida todo antes de escribir nada
    // `transaction` (TypeORM): actividad e ítems se guardan juntos o no se guarda nada
    return this.db.transaction(async (tx) => {
      const activity = await tx.save(
        tx.create(PracticeActivity, {
          title: input.title,
          description: input.description ?? '',
          language: input.language,
          level: input.level,
          skill: input.skill,
          status: opts.published ? 'published' : 'draft',
          aiDraft: input.aiDraft ?? false,
          contents: input.contents ?? [],
          createdBy: actorId,
          archivedAt: null,
        }),
      );
      await tx.save(
        items.map((it, position) =>
          tx.create(PracticeItem, { ...it, activityId: activity.id, position }),
        ),
      );
      return activity;
    });
  }
}
