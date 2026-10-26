import {
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  CURRICULUM_REPOSITORY,
  type ICurriculumRepository,
} from '../../domain/interfaces/curriculum.repository.interface';
import { publishSteps } from '../../domain/value-objects/review-status.vo';
import {
  canApproveCurriculum,
  type CurriculumActor,
} from '../curriculum-actor';
import { ChangeReviewStatusCommand } from './change-review-status.command';
// [Command BulkPublish · 2026-10-24]: publica (o despublica) MUCHOS recursos en UNA petición HTTP — p. ej. un tema de vocabulario de 69 palabras importado de una web
// [Bug que corrige]: antes el frontend recorría cada recurso con 1 GET + hasta 3 POST /:id/status → ~276 peticiones contra el throttler global (100/min por IP)
//   → «ThrottlerException: Too Many Requests» a mitad del lote y el tema quedaba «Parcial 66/69»
// [Patrón]: Command Handler (CQRS) + Composite Command (reutiliza ChangeReviewStatusCommand por paso) + Collecting Parameter (resultado por id) | [Principio]: SRP + DRY (las reglas de transición, rol y versión siguen en UN solo sitio) + idempotencia
// [Paradigma]: POO + async/await (secuencial: cada paso usa la versión devuelta por el anterior → concurrencia optimista respetada)

// `export interface` (TS): resumen que la UI muestra («Se publicaron 3; 66 ya estaban publicados»)
export interface BulkPublishResult {
  total: number; // Ids recibidos
  changed: number; // Recursos que cambiaron de estado
  unchanged: number; // Ya estaban en el estado pedido (reintento de un lote parcial → no se repiten)
  failed: Array<{ id: string; message: string }>; // Fallos individuales: no detienen el resto del lote
}

@Injectable() // `@Injectable()` (NestJS): el contenedor DI lo crea e inyecta sus dependencias
export class BulkPublishCommand {
  constructor(
    @Inject(CURRICULUM_REPOSITORY) private readonly repo: ICurriculumRepository, // `@Inject(TOKEN)`: puerto del repositorio (DIP)
    private readonly changeStatus: ChangeReviewStatusCommand, // [Delegation]: cada transición pasa por la máquina de estados y la auditoría existentes
  ) {}

  async execute(
    ids: ReadonlyArray<string>,
    publish: boolean,
    actor: CurriculumActor,
  ): Promise<BulkPublishResult> {
    // [Fail Fast]: publicar = aprobar → solo ADMIN (antes se descubría en cada recurso, uno a uno)
    if (publish && !canApproveCurriculum(actor))
      throw new ForbiddenException(
        'Solo un administrador puede publicar contenido',
      );

    const unique = [...new Set(ids)]; // `Set` (ES2015): sin ids repetidos
    const result: BulkPublishResult = {
      total: unique.length,
      changed: 0,
      unchanged: 0,
      failed: [],
    };
    // `for…of` + `await` (ES2018): secuencial a propósito → sin carreras de versión ni picos de conexiones a PostgreSQL
    for (const id of unique) {
      try {
        const item = await this.repo.findById(id);
        if (!item) {
          result.failed.push({ id, message: 'Recurso no encontrado' });
          continue; // `continue`: pasa al siguiente id sin abortar el lote
        }
        const steps = publishSteps(item.reviewStatus, publish); // [] si ya está en el estado pedido → idempotente
        if (!steps.length) {
          result.unchanged += 1;
          continue;
        }
        let version = item.version; // `let`: cambia tras cada transición
        for (const status of steps)
          version = (
            await this.changeStatus.execute(
              id,
              { status, expectedVersion: version },
              actor,
            )
          ).version;
        result.changed += 1;
      } catch (err) {
        // `instanceof HttpException` (NestJS): mensaje legible (409 versión, 400 transición…); cualquier otro error → texto genérico sin filtrar detalles internos
        result.failed.push({
          id,
          message:
            err instanceof HttpException ? err.message : 'Error inesperado',
        });
      }
    }
    return result;
  }
}
