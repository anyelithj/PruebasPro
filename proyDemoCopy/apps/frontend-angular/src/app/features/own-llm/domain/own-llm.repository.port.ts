import type { Observable } from 'rxjs';
import type { WritingCorrection, WritingInput, WritingScope } from './models/own-llm';
// [Puerto OwnLlmRepository · Dominio]: contrato que la fachada usa sin conocer HTTP | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP (application → abstracción; infrastructure la implementa) + ISP
// `abstract class` (TS): sirve a la vez de contrato y de token de inyección de Angular (equivale a interfaz + InjectionToken)

export abstract class OwnLlmRepository {
  abstract correct(input: WritingInput): Observable<WritingCorrection>;
  abstract scope(): Observable<WritingScope>;
}
