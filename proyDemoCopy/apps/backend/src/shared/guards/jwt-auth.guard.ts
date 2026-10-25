import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
// [Guard JWT global]: protege todas las rutas excepto las marcadas @Public | [Patrón]: Guard + Strategy | [Principio]: DIP (depende de Reflector) | [Paradigma]: AOP

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // [Inyección Reflector]: lee metadata de decorators @Public | [Patrón]: Strategy
  constructor(private readonly reflector: Reflector) {
    super();
  }

  // [Override canActivate]: cortocircuita si la ruta es pública | [Principio]: OCP — extiende sin modificar AuthGuard
  override canActivate(context: ExecutionContext) {
    // [Reflector multinivel]: busca @Public en handler primero, luego en clase
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // [Cortocircuito]: ruta pública pasa sin validación JWT
    if (isPublic) return true;
    // [Delegación]: passport-jwt valida y popula request.user
    return super.canActivate(context);
  }
}
