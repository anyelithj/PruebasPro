import type { Observable } from 'rxjs';
import type { CorrectorInput, CorrectorResult, WritingCorrection, WritingInput, WritingScope } from './models/own-llm';
// [Puerto OwnLlmRepository · Dominio]: contrato que la fachada usa sin conocer HTTP | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP (application → abstracción; infrastructure la implementa) + ISP
// `abstract class` (TS): sirve a la vez de contrato y de token de inyección de Angular (equivale a interfaz + InjectionToken)

export abstract class OwnLlmRepository {
  abstract correct(input: WritingInput): Observable<WritingCorrection>;
  abstract correctSentence(input: CorrectorInput): Observable<CorrectorResult>; // [2026-11-13 · Anexo A]: corrector pedagógico único
  abstract scope(): Observable<WritingScope>;
  abstract detect(text: string): Observable<string>; // [2026-11-02]: idioma del texto mientras se escribe (sin LLM)
}
