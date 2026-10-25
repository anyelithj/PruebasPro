import { randomUUID } from 'node:crypto';
import { MEDIA_EXT, mediaMime } from '../../../../shared/http/audio-mime';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import {
  ALIGNMENT,
  type AlignmentPort,
} from '../../../../shared/domain/interfaces/alignment.interface';
import type { ObjectStore } from '../../../../shared/storage/object-store';
import {
  type UploadedAudio,
} from '../../../music/application/use-cases/upload-song-audio.use-case';
import type { License } from '../../../music/domain/value-objects/license.vo';
import { Dialogue } from '../../domain/entities/dialogue.entity';
import { DialogueTurn } from '../../domain/entities/dialogue-turn.entity';
import { TurnEnricher } from './turn-enricher';
import { ClassifyDialogueLevelUseCase } from './classify-dialogue-level.use-case';
import {
  DIALOGUES_STORE,
  type DialogueActor,
  DialogueAccess,
} from './get-dialogue.use-case';
// [UseCase UploadDialogue · Sprint 9.3 · RF-125/RF-126/RF-128]: sube el diálogo (texto por hablante y licencia), obtiene traducción e IPA de cada turno y estima su nivel CEFR; el audio opcional se sube aparte y se sincroniza solo (voz limpia) | [Patrón]: Use Case (Command) + Unit of Work + Ports & Adapters (LanguageTools, LevelClassifier, Alignment, ObjectStore) | [Principio]: SRP + DIP + DRY (TurnEnricher, AlignmentClient de Music) + verificación humana | [Paradigma]: POO + async/await

export interface DialogueInput {
  title: string;
  topicId?: string;
  language: string;
  speakers?: string[];
  turns: { speaker: 'A' | 'B'; text: string }[];
  license: License;
}

@Injectable()
export class UploadDialogueUseCase {
  constructor(
    @InjectRepository(Dialogue)
    private readonly dialogues: Repository<Dialogue>,
    @InjectRepository(DialogueTurn)
    private readonly turns: Repository<DialogueTurn>,
    private readonly enricher: TurnEnricher,
    private readonly classify: ClassifyDialogueLevelUseCase,
    private readonly access: DialogueAccess,
    @Inject(DIALOGUES_STORE) private readonly store: ObjectStore,
    @Inject(ALIGNMENT) private readonly alignment: AlignmentPort,
  ) {}

  async execute(actor: DialogueActor, input: DialogueInput, token: string) {
    if (new Set(input.turns.map((t) => t.speaker)).size < 2)
      throw new BadRequestException(
        'El diálogo necesita turnos de los dos hablantes',
      );
    // [Idempotencia · 2026-10-19]: el alta tarda (IPA + traducción + nivel con IA) y un corte o un doble clic la repetía → diálogo duplicado.
    // Mismo autor + título + idioma en los últimos 15 min = el mismo envío → se devuelve el ya guardado | [Principio]: Idempotent Receiver
    const recent = await this.dialogues.findOne({
      where: {
        createdBy: actor.id,
        title: input.title,
        language: input.language,
        withdrawnAt: IsNull(),
        createdAt: MoreThan(new Date(Date.now() - 15 * 60_000)),
      },
      order: { createdAt: 'DESC' },
    });
    if (recent) return recent;
    const ling = await this.enricher.enrich(
      input.turns.map((t) => t.text),
      input.language,
      token,
    );
    // `transaction` (TypeORM): diálogo y turnos se guardan juntos
    const dialogue = await this.dialogues.manager.transaction(async (tx) => {
      const d = await tx.save(
        tx.create(Dialogue, {
          title: input.title,
          topicId: input.topicId ?? null,
          language: input.language,
          speakers: input.speakers ?? ['A', 'B'],
          license: input.license,
          level: null,
          levelStatus: 'estimated',
          levelEstimate: null,
          audioKey: null,
          audioMime: null,
          createdBy: actor.id,
          withdrawnAt: null,
        }),
      );
      await tx.save(
        input.turns.map((t, position) =>
          tx.create(DialogueTurn, {
            ...t,
            ...ling[position],
            position,
            dialogueId: d.id,
            sessionId: null,
          }),
        ),
      );
      return d;
    });
    return this.classify.execute(dialogue, token); // El nivel queda «estimado» hasta que el docente lo confirma
  }

  // [audio]: guarda el audio y pide los tiempos de cada turno a Alignment (diálogos con voz limpia → se guardan; el docente puede corregirlos)
  async audio(
    actor: DialogueActor,
    id: string,
    file: UploadedAudio,
    token: string,
  ) {
    const mime = file?.buffer?.length ? mediaMime(file) : null; // [2026-10-20]: firma del archivo, no solo el Content-Type
    if (!mime)
      throw new BadRequestException('Falta el audio o su formato no se admite');
    const d = await this.access.editable(actor, id);
    const key = `dialogues/${d.id}/${randomUUID()}.${MEDIA_EXT[mime]}`;
    await this.store.put(key, file.buffer, mime);
    if (d.audioKey) await this.store.remove(d.audioKey);
    Object.assign(d, { audioKey: key, audioMime: mime });
    await this.dialogues.save(d);
    const turns = await this.turns.find({
      where: { dialogueId: id },
      order: { position: 'ASC' },
    });
    try {
      const res = await this.alignment.align(
        {
          audio: file.buffer,
          mime,
          lines: turns.map((t) => t.text),
          language: d.language,
          kind: 'dialogue',
        },
        token,
      );
      res.lines.forEach((t) =>
        Object.assign(turns[t.index], { startS: t.start, endS: t.end }),
      );
      await this.turns.save(turns);
      return { aligned: true, turns };
    } catch {
      return { aligned: false, turns }; // Sin FastAPI el audio se guarda igual; el reproductor resalta por turno sin tiempos
    }
  }
}
