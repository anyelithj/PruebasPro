import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VocabularyModule } from '../vocabulary/vocabulary.module';
import { BookLanguageUseCase } from './application/book-language.use-case';
import { BookProgressUseCase } from './application/book-progress.use-case';
import { BookTextUseCase } from './application/book-text.use-case';
import { SearchBooksUseCase } from './application/search-books.use-case';
import { BOOK_CATALOG } from './domain/book-catalog.port';
import { Book } from './domain/entities/book.entity';
import { BookProgress } from './domain/entities/book-progress.entity';
import { BookText } from './domain/entities/book-text.entity';
import { BookTranslation } from './domain/entities/book-translation.entity';
import { BooksCatalogAdapter } from './infrastructure/books-catalog.adapter';
import { GutendexAdapter } from './infrastructure/gutendex.adapter';
import { WikisourceAdapter } from './infrastructure/wikisource.adapter';
import { BooksController } from './presentation/books.controller';
// [BooksModule · Libros · 2026-11-14]: catálogo de libros de dominio público (RF-145) | [Arquitectura]: Hexagonal — el caso de uso depende de BOOK_CATALOG, no de Gutendex

@Module({
  imports: [
    TypeOrmModule.forFeature([Book, BookText, BookTranslation, BookProgress]),
    VocabularyModule, // LANGUAGE_TOOLS: traducción e IPA (FastAPI)
  ],
  controllers: [BooksController],
  providers: [
    SearchBooksUseCase,
    BookTextUseCase,
    BookLanguageUseCase,
    BookProgressUseCase,
    GutendexAdapter,
    WikisourceAdapter,
    { provide: BOOK_CATALOG, useClass: BooksCatalogAdapter }, // [2026-11-17]: Wikisource (géneros, textos originales) + Gutendex de respaldo
  ],
})
export class BooksModule {}
