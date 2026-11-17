import { randomUUID } from 'node:crypto';
import { MEDIA_EXT, mediaMime } from '../../../../shared/http/audio-mime';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import {
  ALIGNMENT,
  type AlignmentPort,
} from '../../../../shared/domain/interfaces/alignment.interface';
import type { ObjectStore } from '../../../../shared/storage/object-store';
import { type UploadedAudio } from '../../../music/application/use-cases/upload-song-audio.use-case';
import {
  type License,
  licenseProblem,
} from '../../../music/domain/value-objects/license.vo';
import { Dialogue } from '../../domain/entities/dialogue.entity';
import { DialogueTurn } from '../../domain/entities/dialogue-turn.entity';
import { BackgroundTasks } from '../../../../shared/background/background-tasks';
import { TurnEnricher } from './turn-enricher';
import { assertUniqueTitle } from '../../../../shared/application/unique-title'; // [2026-10-28]: regla anti-duplicados compartida (DRY)
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
  license?: License; // [2026-10-27]: solo obligatoria con `origin: 'import'` (texto de terceros)
  origin?: 'ai' | 'own' | 'import';
  level?: string | null; // [2026-10-27]: nivel elegido por el docente (el clasificador solo aporta la estimación)
}

// [dialogueTaskKey · 2026-10-27]: clave de la tarea en segundo plano → GetDialogue no repite el relleno mientras corre y expone `enriching` | Función pura
export const dialogueTaskKey = (id: string): string => `dialogue:${id}`;

// [OWN_HOLDER · 2026-10-27]: titular por defecto del contenido propio o generado por la IA de la plataforma (= «Aula de Idiomas» de License.holder)
export const OWN_HOLDER = 'Aula de Idiomas';

// [resolveLicense · 2026-10-27]: la licencia la declara el docente SOLO si el texto es de terceros (importado); lo propio o generado nace como «obra propia»
// confirmada → no se piden «Titular de los derechos» ni la casilla de confirmación | [Patrón]: Specification (licenseProblem) + Default Value | Función pura
export function resolveLicense(
  input: Pick<DialogueInput, 'license' | 'origin'>,
): License {
  if (input.origin === 'import') {
    const problem = licenseProblem(input.license);
    if (problem)
      throw new BadRequestException(
        `Texto importado: ${problem.toLowerCase()}.`,
      );
    return input.license!; // `!` (TS): licenseProblem ya descartó `undefined`
  }
  if (input.license && !licenseProblem(input.license)) return input.license; // Compatibilidad: el editor Angular sigue enviando la suya
  return {
    type: 'own_work',
    source:
      input.origin === 'ai'
        ? 'Generado con IA (Aula de Idiomas)'
        : 'Contenido propio',
    holder: OWN_HOLDER,
    confirmed: true,
  };
}

@Injectable()
export class UploadDialogueUseCase {
  private readonly logger = new Logger(UploadDialogueUseCase.name);

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
    private readonly background: BackgroundTasks, // [2026-10-27]: cola global acotada (agente de rendimiento) → no se lanzan promesas sueltas
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
    // [Fix 2026-10-28 · Sin duplicados]: otro diálogo vigente con el mismo título (normalizado) en el mismo idioma → 409 | ámbito = idioma (el nivel lo estima la IA después y puede cambiar)
    await assertUniqueTitle(
      this.dialogues,
      input.title,
      { language: input.language, withdrawnAt: IsNull() },
      { label: 'un diálogo', language: input.language },
    );
    const license = resolveLicense(input); // [Fail Fast]: texto importado sin licencia válida → 400 antes de guardar nada
    // `transaction` (TypeORM): diálogo y turnos se guardan juntos — SIN esperar a la IA (IPA, traducción y nivel se completan en segundo plano)
    const dialogue = await this.dialogues.manager.transaction(async (tx) => {
      const d = await tx.save(
        tx.create(Dialogue, {
          title: input.title,
          topicId: input.topicId ?? null,
          language: input.language,
          speakers: input.speakers ?? ['A', 'B'],
          license,
          level: input.level ?? null,
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
            ipa: '',
            ipaUs: null,
            translation: null,
            position,
            dialogueId: d.id,
            sessionId: null,
          }),
        ),
      );
      return d;
    });
    // [Bug · 2026-10-27 · creación lenta y sin IPA]: antes se esperaba la IA (IPA + traducción de todos los turnos + nivel) ANTES de guardar → minutos de espera
    // y, si el LLM pasaba de 90 s, todo quedaba vacío. Ahora se responde en cuanto está guardado y se enriquece después | [Patrón]: Fire-and-forget + Eventual Consistency
    // BackgroundTasks: cupo de concurrencia + coalescing por clave · `enrichLater` nunca rechaza (registra el fallo) | Si el proceso se reinicia, GetDialogue lo rellena al abrir
    const texts = input.turns.map((t) => t.text);
    this.background.schedule(dialogueTaskKey(dialogue.id), () =>
      this.enrichLater(dialogue, texts, token),
    );
    return { ...dialogue, enriching: true }; // La UI avisa de que la IPA y la traducción aparecerán en unos segundos
  }

  // [enrichLater · 2026-10-27]: IPA + traducción por turno (en trozos, con respaldo de solo IPA) y luego el nivel estimado | [Principio]: degradación elegante
  async enrichLater(
    dialogue: Dialogue,
    texts: string[],
    token: string,
  ): Promise<void> {
    try {
      const ling = await this.enricher.enrich(texts, dialogue.language, token);
      const turns = await this.turns.find({
        where: { dialogueId: dialogue.id },
        order: { position: 'ASC' },
      });
      // Solo se rellena lo vacío → una corrección manual hecha mientras tanto no se pisa
      turns.forEach((t) => {
        const l = ling[t.position];
        if (!l) return;
        if (!t.ipa) Object.assign(t, { ipa: l.ipa, ipaUs: l.ipaUs });
        if (!t.translation) t.translation = l.translation;
      });
      await this.turns.save(turns);
      // [Recarga]: el docente pudo editar título, nivel o publicarlo mientras tanto → se clasifica la versión actual (no se pisan sus cambios)
      const fresh = await this.dialogues.findOneBy({
        id: dialogue.id,
        withdrawnAt: IsNull(),
      });
      if (fresh && fresh.levelStatus !== 'confirmed')
        await this.classify.execute(fresh, token); // El nivel queda «estimado» hasta que el docente lo confirma
    } catch (err) {
      this.logger.warn(
        `Diálogo ${dialogue.id} sin enriquecer en segundo plano: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
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
