import type { Observable } from 'rxjs';
import type { __Name__ } from './models/__name__';
// [Plantilla · Puerto]: contrato del repositorio de __name__ | [Patrón]: Port (Hexagonal) | [Principio]: DIP | `abstract class` = contrato + token de inyección

export abstract class __Name__Repository {
  abstract list(): Observable<__Name__[]>;
}
