import type { Observable } from 'rxjs';
import type { ReadingDetail, ReadingFilter, ReadingProgress, ReadingSummary } from './models/reading';
// [Puerto ReadingRepository · Dominio · Lectura · 2026-10-25]: lista, lector, marcador y enlaces de descarga — sin que las pantallas conozcan HTTP | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP + ISP
// `abstract class` (TS): contrato + token de inyección a la vez

export abstract class ReadingRepository {
  abstract list(filter: ReadingFilter): Observable<ReadingSummary[]>;
  abstract get(id: string): Observable<ReadingDetail>;
  abstract saveProgress(id: string, progress: ReadingProgress): Observable<ReadingProgress>;
  abstract resetProgress(id: string): Observable<void>;
  abstract exportUrl(id: string, format: 'pdf' | 'txt', include: ReadonlyArray<'translation' | 'ipa'>): string;
}
