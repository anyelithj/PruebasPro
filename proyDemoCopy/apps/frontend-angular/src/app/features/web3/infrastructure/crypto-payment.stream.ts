import { map, type Observable } from 'rxjs';
import { fromEventSource } from '@shared/utils/event-source';
import { CryptoProgressSchema, type CryptoProgress } from '../domain/models/wallet';
// [cryptoPaymentStream · Infraestructura]: SSE de GET /api/events filtrado al evento `crypto-payment` (confirmaciones en vivo del worker de NestJS) | [Patrón]: Adapter (EventSource → Observable) | [Principio]: DRY (reutiliza shared/utils/event-source) + SRP | [Paradigma]: Reactivo (RxJS)
// [Seguridad]: el payload del servidor se valida con Zod antes de llegar a la UI

export const cryptoPaymentStream = (api: string): Observable<CryptoProgress> =>
  fromEventSource<unknown>(`${api}/events`, ['crypto-payment']).pipe(map((m) => CryptoProgressSchema.parse(m.data)));
