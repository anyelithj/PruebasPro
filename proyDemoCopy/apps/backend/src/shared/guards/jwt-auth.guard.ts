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
    // [Ruta pública]: sin token pasa directa (visitante). [Fix 2026-11-13 · Caso F]: CON token se intenta autenticar para poblar `request.user`
    // → antes el catálogo y el detalle (@Public) nunca veían al usuario y devolvían ⭐/👍/❤️ siempre en false aunque estuvieran guardados
    if (isPublic)
      return hasBearer(context) ? this.tryAuthenticate(context) : true;
    // [Delegación]: passport-jwt valida y popula request.user
    return super.canActivate(context);
  }

  // [tryAuthenticate]: autenticación OPCIONAL | `async` (ES2017) | token inválido o vencido en ruta pública → sigue como anónimo (nunca 401) | [Patrón]: Optional Authentication
  private async tryAuthenticate(context: ExecutionContext): Promise<boolean> {
    try {
      await (super.canActivate(context) as Promise<boolean>); // `super` (ES2015): AuthGuard('jwt') de passport valida y rellena request.user
    } catch {
      /* Ruta pública: un token malo no bloquea el acceso, solo deja `request.user` vacío */
    }
    return true;
  }
}

// [hasBearer]: ¿la petición trae «Authorization: Bearer …»? | Función pura | `?.` (ES2020): contextos sin cabeceras (WS) → false
function hasBearer(context: ExecutionContext): boolean {
  const auth = context
    .switchToHttp()
    .getRequest<{ headers?: Record<string, string | undefined> }>()
    ?.headers?.authorization;
  return typeof auth === 'string' && /^Bearer\s+\S+/i.test(auth);
}
