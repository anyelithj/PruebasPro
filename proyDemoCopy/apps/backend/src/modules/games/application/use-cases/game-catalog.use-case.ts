import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../../users/domain/value-objects/role.vo';
import { GAME_CONTENT_LICENSE } from '../../domain/game-content';
import { GAME_META, GAME_TYPES, type GameType } from '../../domain/game-type';
import { GameSetting, type GameStatus } from '../../domain/entities/game-setting.entity';
// [GameCatalogUseCase · 2026-10-24]: catálogo de juegos = tipos del código + ajustes de la BD (título, descripción, estado)
// Estudiante → solo publicados · Docente/Admin → también borradores (Gestión → Actividades → Juegos) · archivados → nadie
// [Patrón]: Use Case (Clean Architecture) + Merge de catálogo estático con overrides | [Principio]: SRP + Fail Fast (tipo desconocido = 404) | [Paradigma]: POO + async/await

export interface CatalogActor {
  id: string;
  role: Role;
}

export interface GamePatch {
  title?: string | null;
  description?: string | null;
  status?: Exclude<GameStatus, 'archived'>; // Archivar va por DELETE
}

const isStaff = (a: CatalogActor) => a.role === Role.TEACHER || a.role === Role.ADMIN;

@Injectable()
export class GameCatalogUseCase {
  constructor(@InjectRepository(GameSetting) private readonly settings: Repository<GameSetting>) {}

  // [list]: un elemento por tipo con su ajuste (o los valores por defecto) | `Map` (ES2015): búsqueda O(1) por tipo
  async list(actor: CatalogActor) {
    const byType = new Map((await this.settings.find()).map((s) => [s.type, s]));
    const games = GAME_TYPES.map((type) => {
      const s = byType.get(type);
      return { type, ...GAME_META[type], title: s?.title ?? null, description: s?.description ?? null, status: s?.status ?? ('published' as GameStatus) };
    }).filter((g) => g.status === 'published' || (g.status === 'draft' && isStaff(actor)));
    return { games, license: GAME_CONTENT_LICENSE };
  }

  // [assertPlayable]: no se inicia una partida de un juego archivado, ni de uno en borrador si no es personal
  async assertPlayable(actor: CatalogActor, type: GameType): Promise<void> {
    const status = (await this.settings.findOneBy({ type }))?.status ?? 'published';
    if (status === 'archived' || (status === 'draft' && !isStaff(actor))) throw new ForbiddenException('Este juego no está disponible.');
  }

  // [update]: crea o modifica el ajuste (upsert) | cadena vacía → vuelve al valor por defecto
  async update(actor: CatalogActor, type: string, patch: GamePatch): Promise<GameSetting> {
    const s = await this.load(type);
    if (patch.title !== undefined) s.title = patch.title?.trim() || null;
    if (patch.description !== undefined) s.description = patch.description?.trim() || null;
    if (patch.status) s.status = patch.status;
    s.updatedBy = actor.id;
    return this.settings.save(s);
  }

  // [archive]: «Eliminar» de Gestión = borrado lógico (el juego deja de listarse y de poder jugarse; se reactiva con PATCH status)
  async archive(actor: CatalogActor, type: string): Promise<void> {
    const s = await this.load(type);
    Object.assign(s, { status: 'archived', updatedBy: actor.id });
    await this.settings.save(s);
  }

  private async load(type: string): Promise<GameSetting> {
    if (!(GAME_TYPES as readonly string[]).includes(type)) throw new NotFoundException(`Juego desconocido: ${type}`);
    return (await this.settings.findOneBy({ type })) ?? this.settings.create({ type, title: null, description: null, status: 'published' });
  }
}
