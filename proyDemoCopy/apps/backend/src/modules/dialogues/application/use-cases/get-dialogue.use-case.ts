import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { RangedSource } from '../../../../shared/http/ranged-response';
import type { ObjectStore } from '../../../../shared/storage/object-store';
import { Dialogue } from '../../domain/entities/dialogue.entity';
import { DialogueTurn } from '../../domain/entities/dialogue-turn.entity';
import { sanitizeTranslation } from '../../domain/translation-sanitizer';
import { TurnEnricher } from './turn-enricher';
// [UseCases DialogueAccess + GetDialogue · Sprint 9.3 · RF-123/RF-127]: carga un diálogo según el rol (con nivel sin confirmar solo para su autor o ADMIN) y lo devuelve con sus turnos, IPA y traducción; audio opcional por rangos | [Patrón]: Query + Guard reutilizable | [Principio]: SRP + mínimo privilegio + verificación humana + DRY | [Paradigma]: POO

export const DIALOGUES_STORE = Symbol('DIALOGUES_STORE'); // Prefijo «dialogues» del almacén de objetos (audio opcional)

export interface DialogueActor {
  id: string;
  role: string;
}

@Injectable()
export class DialogueAccess {
  constructor(
    @InjectRepository(Dialogue)
    private readonly dialogues: Repository<Dialogue>,
  ) {}

  async readable(actor: DialogueActor, id: string): Promise<Dialogue> {
    const d = await this.dialogues.findOneBy({ id, withdrawnAt: IsNull() });
    if (!d || (d.levelStatus !== 'confirmed' && !this.canEdit(actor, d)))
      throw new NotFoundException('Diálogo no encontrado');
    return d;
  }

  async editable(actor: DialogueActor, id: string): Promise<Dialogue> {
    const d = await this.dialogues.findOneBy({ id, withdrawnAt: IsNull() });
    if (!d) throw new NotFoundException('Diálogo no encontrado');
    if (!this.canEdit(actor, d))
      throw new ForbiddenException('Solo el autor o un ADMIN puede editarlo');
    return d;
  }

  canEdit(actor: DialogueActor, d: Dialogue): boolean {
    return (
      actor.role === 'ADMIN' ||
      (actor.role === 'TEACHER' && d.createdBy === actor.id)
    );
  }
}

@Injectable()
export class GetDialogueUseCase {
  constructor(
    private readonly access: DialogueAccess,
    @InjectRepository(DialogueTurn)
    private readonly turns: Repository<DialogueTurn>,
    @Inject(DIALOGUES_STORE) private readonly store: ObjectStore,
    private readonly enricher: TurnEnricher,
  ) {}

  async execute(actor: DialogueActor, id: string, token?: string) {
    const dialogue = await this.access.readable(actor, id);
    const turns = await this.turns.find({
      where: { dialogueId: id },
      order: { position: 'ASC' },
    });
    // [Espera acotada]: hasta 8 s; si el LLM tarda más, termina en segundo plano y la próxima visita ya trae la traducción | `Promise.race` (ES2015)
    if (token)
      await Promise.race([
        this.fillTranslations(turns, dialogue.language, token).catch(() => undefined),
        new Promise((r) => setTimeout(r, 8_000)),
      ]);
    return {
      ...dialogue,
      turns,
      editable: this.access.canEdit(actor, dialogue),
      hasAudio: !!dialogue.audioKey,
    };
  }

  // [fillTranslations · 2026-10-23]: turnos subidos cuando el LLM no tradujo («—» en la biblioteca) → se traducen al abrir y se guardan (relleno perezoso, una vez) | [Patrón]: Lazy Backfill | [Principio]: degradación elegante (si falla, se muestra igual)
  // [2026-10-25]: también repara traducciones guardadas con JSON crudo (`{"<frase>": "<traducción>"}`) — se desenvuelven o, si no sirven, se vuelven a pedir
  private async fillTranslations(turns: DialogueTurn[], language: string, token: string): Promise<void> {
    if (language === 'es') return;
    // [Limpieza en sitio]: `filter` con efecto deliberado — muta el turno devuelto y lo marca para guardar si su traducción cambió
    const cleaned = turns.filter((t) => {
      const clean = sanitizeTranslation(t.text, t.translation);
      return clean !== t.translation && ((t.translation = clean), true);
    });
    const missing = turns.filter((t) => !t.translation);
    const ling = missing.length ? await this.enricher.enrich(missing.map((t) => t.text), language, token) : [];
    const filled = missing.filter((t, i) => (ling[i]?.translation ? ((t.translation = ling[i].translation), true) : false)); // Muta el turno devuelto y lo marca para guardar
    const changed = [...new Set([...cleaned, ...filled])]; // `Set`: un turno limpiado y luego traducido se guarda una sola vez
    if (changed.length) await this.turns.save(changed).catch(() => undefined);
  }

  async audio(actor: DialogueActor, id: string): Promise<RangedSource> {
    const d = await this.access.readable(actor, id);
    const key = d.audioKey;
    const size = key ? await this.store.size(key) : null;
    if (!key || size === null)
      throw new NotFoundException('El diálogo no tiene audio');
    const contentType = d.audioMime ?? 'audio/mpeg';
    return {
      size,
      contentType,
      open: (range) => this.store.open(key, range),
      signedUrl: await this.store.signedUrl(key, {
        filename: `${d.title}.${key.split('.').pop()}`,
        contentType,
        disposition: 'inline',
      }),
    };
  }
}
