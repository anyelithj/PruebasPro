import type { ExecutionContext } from '@nestjs/common';
import { SSE_METADATA } from '@nestjs/common/constants';
// [isSse · Sprint 6.2]: ¿el handler es un endpoint @Sse? → los interceptores globales no deben envolverlo ni cortarlo por timeout | [Patrón]: Predicate (Reflection) | [Principio]: DRY (lo usan TransformInterceptor y TimeoutInterceptor) | [Paradigma]: Funcional
// `Reflect.getMetadata` (reflect-metadata): lee la marca que @Sse deja en el método del controlador

export const isSse = (context: ExecutionContext): boolean =>
  Reflect.getMetadata(SSE_METADATA, context.getHandler()) === true;
