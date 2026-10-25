import { SetMetadata } from '@nestjs/common';
// [Decorator @Public]: marca un endpoint como abierto (sin JWT) | [Patrón]: Decorator | [Principio]: OCP | [Paradigma]: AOP

// [Clave metadata]: usada por JwtAuthGuard para detectar rutas exentas
export const IS_PUBLIC_KEY = 'isPublic';

// [Factory de decorator]: aplica metadata via Reflector | [Patrón]: Marker
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
