import { Global, Module } from '@nestjs/common';
import { BackgroundTasks } from './background-tasks';
// [BackgroundTasksModule · 2026-10-27]: expone UNA cola en segundo plano a todo el backend (Lectura, Diálogos, Gramática…) | [Patrón]: Module + Singleton (DI) | [Principio]: DRY (un solo mecanismo de «guardar primero, enriquecer después»)
// `@Global()` (NestJS): los módulos de dominio inyectan BackgroundTasks sin importarlo uno a uno

@Global()
@Module({
  providers: [BackgroundTasks],
  exports: [BackgroundTasks],
})
export class BackgroundTasksModule {}
