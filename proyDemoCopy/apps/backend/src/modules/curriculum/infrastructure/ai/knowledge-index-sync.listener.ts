import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import jwtConfig from '../../../../shared/config/jwt.config';
import { AssistantClientService } from '../../../ai/assistant-client.service';
import {
  CURRICULUM_ITEMS_CHANGED_EVENT,
  type CurriculumItemsChangedEvent,
} from '../../domain/events/curriculum-items-changed.event';
// [Listener KnowledgeIndexSync · 2026-11-13 · Tarea 9 · RF-57/RF-139]: cada cambio del temario llega al índice RAG de FastAPI
// (alta manual, importación por archivo o enlace, edición, revisión, publicación en lote y baja: un solo flujo)
// [Patrón]: Observer (Domain Event) + Adapter (evento → HTTP) + Debounce/Batch (una publicación en lote = una sola petición)
// [Principio]: OCP (Curriculum no conoce a FastAPI) + SRP + Fail-soft (si FastAPI cae, el recurso se guarda igual; «Reindexar» lo repara)
// [Paradigma]: Event-Driven + async/await | [Tecnología]: NestJS EventEmitter + JwtService

const FLUSH_MS = 500; // Ventana para juntar cambios seguidos (publicar un tema completo = decenas de eventos)
const BATCH = 500; // Tope del DTO de FastAPI (KnowledgeSyncIn.ids)

@Injectable()
export class KnowledgeIndexSyncListener implements OnModuleDestroy {
  private readonly logger = new Logger(KnowledgeIndexSyncListener.name);
  private readonly pending = new Set<string>(); // `Set` (ES2015): ids sin repetir entre eventos
  private actorId: string | null = null; // Último autor del lote (sujeto del token de servicio)
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly assistant: AssistantClientService,
    private readonly jwt: JwtService,
    @Inject(jwtConfig.KEY) private readonly cfg: ConfigType<typeof jwtConfig>,
  ) {}

  // `@OnEvent` (NestJS): se suscribe al evento del dominio | síncrono: solo encola, no bloquea la respuesta HTTP del autor
  @OnEvent(CURRICULUM_ITEMS_CHANGED_EVENT)
  handle(event: CurriculumItemsChangedEvent): void {
    event.ids.forEach((id) => this.pending.add(id));
    this.actorId = event.actorId ?? this.actorId;
    // `??=` (ES2021): un solo temporizador por lote | `.unref()` (Node.js): no retiene el proceso al apagar
    this.timer ??= setTimeout(() => void this.flush(), FLUSH_MS).unref();
  }

  // [flush]: envía lo pendiente en lotes de ≤ 500 ids | público para los tests
  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer); // Envío anticipado (tests, apagado) → sin temporizador colgando
    this.timer = null;
    const ids = [...this.pending]; // Spread (ES2015): copia y vacía → los eventos que lleguen ahora van al siguiente lote
    this.pending.clear();
    if (!ids.length) return;
    try {
      // [Token de servicio]: el evento no trae JWT → se firma uno de 2 min (mismo secreto que valida FastAPI); nunca sale del servidor
      const token = await this.jwt.signAsync(
        { sub: this.actorId ?? 'system', role: 'TEACHER', svc: 'curriculum-rag' },
        { secret: this.cfg.accessSecret, expiresIn: 120 },
      );
      for (let i = 0; i < ids.length; i += BATCH) {
        const res = await this.assistant.syncKnowledge(ids.slice(i, i + BATCH), token);
        this.logger.log(`Índice RAG: +${res.indexed} fragmentos, ${res.removed.length} recursos fuera (total ${res.size})`);
      }
    } catch (err) {
      this.logger.warn(`Índice RAG sin actualizar (${ids.length} recursos): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // `OnModuleDestroy` (NestJS): al apagar se envía lo pendiente en vez de perderlo
  async onModuleDestroy(): Promise<void> {
    await this.flush();
  }
}
