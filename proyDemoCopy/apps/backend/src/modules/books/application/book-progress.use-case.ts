import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { BookProgress } from '../domain/entities/book-progress.entity';
// [UseCase BookProgress · Libros · RF-147 · 2026-11-14]: guarda y lee dónde se quedó el usuario en un libro (capítulo, párrafo, frase)
// [Patrón]: Upsert por (usuario, libro) → repetir el mismo marcador no duplica | [Seguridad]: el usuario sale del JWT, nunca del cliente

export interface BookPosition {
  chapter: number;
  paragraph: number;
  sentence: number;
}

@Injectable()
export class BookProgressUseCase {
  constructor(
    @InjectRepository(BookProgress)
    private readonly progress: Repository<BookProgress>,
  ) {}

  async get(userId: string, bookId: number): Promise<BookPosition | null> {
    const row = await this.progress.findOne({ where: { userId, bookId } });
    return row
      ? {
          chapter: row.chapter,
          paragraph: row.paragraph,
          sentence: row.sentence,
        }
      : null;
  }

  async save(
    userId: string,
    bookId: number,
    pos: BookPosition,
  ): Promise<BookPosition> {
    await this.progress.upsert({ userId, bookId, ...pos }, [
      'userId',
      'bookId',
    ]);
    return pos;
  }
}
