// [GUARD][SRP] auth guard para WebSockets — STUB (vertical slice, chat no implementado)
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class WsJwtGuard implements CanActivate {
  // TODO(vertical-slice): validar token del handshake y adjuntar user al socket.
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}
