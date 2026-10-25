import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MEDIA_EXT, mediaMime } from '../../../../shared/http/audio-mime';
import type { RangedSource } from '../../../../shared/http/ranged-response';
import type { ObjectStore } from '../../../../shared/storage/object-store';
import type { UploadedAudio } from '../../../music/application/use-cases/upload-song-audio.use-case';
import { DialogueTurn } from '../../domain/entities/dialogue-turn.entity';
import { OwnedDialogueSession } from './get-dialogue-session.use-case';
import { DIALOGUES_STORE } from './get-dialogue.use-case';
// [UseCase TurnRecording · 2026-10-20]: guarda la GRABACIÓN de voz de un turno del usuario en la conversación con el avatar y la devuelve por rangos
// (antes el audio solo se transcribía y se perdía → la alumna no podía volver a escucharse) | [Patrón]: Use Case + Ports & Adapters (ObjectStore «dialogues»)
// [Principio]: SRP + privacidad (solo el dueño de la sesión sube/escucha; borrar la sesión borra sus grabaciones) + DRY (mediaMime, sendRanged) | [Paradigma]: POO + async/await

export const MAX_RECORDING_BYTES = 10 * 1024 * 1024; // ≈ 10 min de opus a 128 kbps (el grabador corta a los 45 s)

@Injectable()
export class TurnRecordingUseCase {
  constructor(
    private readonly owned: OwnedDialogueSession,
    @InjectRepository(DialogueTurn) private readonly turns: Repository<DialogueTurn>,
    @Inject(DIALOGUES_STORE) private readonly store: ObjectStore,
  ) {}

  // [turnOf]: el turno debe ser del usuario y de una sesión suya (404 si no → no se revela si existe)
  private async turnOf(userId: string, sessionId: string, turnId: string): Promise<DialogueTurn> {
    await this.owned.load(userId, sessionId);
    const turn = await this.turns.findOneBy({ id: turnId, sessionId, speaker: 'user' });
    if (!turn) throw new NotFoundException('Turno no encontrado');
    return turn;
  }

  async save(userId: string, sessionId: string, turnId: string, file: UploadedAudio): Promise<DialogueTurn> {
    const mime = file?.buffer?.length ? mediaMime(file) : null;
    if (!mime) throw new BadRequestException('Falta la grabación o su formato no se admite');
    const turn = await this.turnOf(userId, sessionId, turnId);
    const key = `sessions/${sessionId}/${turn.id}-${randomUUID()}.${MEDIA_EXT[mime]}`;
    await this.store.put(key, file.buffer, mime);
    if (turn.audioKey) await this.store.remove(turn.audioKey); // Regrabar reemplaza la anterior
    Object.assign(turn, { audioKey: key, audioMime: mime });
    return this.turns.save(turn);
  }

  async stream(userId: string, sessionId: string, turnId: string): Promise<RangedSource> {
    const turn = await this.turnOf(userId, sessionId, turnId);
    const key = turn.audioKey;
    const size = key ? await this.store.size(key) : null;
    if (!key || size === null) throw new NotFoundException('Este turno no tiene grabación');
    const contentType = turn.audioMime ?? 'audio/webm';
    return {
      size,
      contentType,
      open: (range) => this.store.open(key, range),
      signedUrl: await this.store.signedUrl(key, { filename: `grabacion.${key.split('.').pop()}`, contentType, disposition: 'inline' }),
    };
  }

  // [removeAll]: lo llama el borrado de la sesión (privacidad: no quedan audios huérfanos)
  async removeAll(sessionId: string): Promise<void> {
    const withAudio = await this.turns.find({ where: { sessionId }, select: { id: true, audioKey: true } });
    await Promise.all(withAudio.filter((t) => t.audioKey).map((t) => this.store.remove(t.audioKey!)));
  }
}
