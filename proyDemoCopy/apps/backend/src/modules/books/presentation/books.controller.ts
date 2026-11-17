import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Language } from '../../../shared/domain/language.vo';
import { BOOK_GENRES, type BookGenre } from '../domain/book';
import { bearer } from '../../ai/assistant.controller';
import { BookLanguageUseCase } from '../application/book-language.use-case';
import { BookProgressUseCase } from '../application/book-progress.use-case';
import { BookTextUseCase } from '../application/book-text.use-case';
import { SearchBooksUseCase } from '../application/search-books.use-case';
// [Controller Books · Libros · RF-145 · 2026-11-14]: GET /books (buscar) · GET /books/:id (ficha) | sesión obligatoria (JwtAuthGuard global)
// [Throttle]: tope por usuario → nadie recorre el catálogo de Gutendex a golpe de peticiones | [Patrón]: Thin Controller

export class SearchBooksQuery {
  @ApiPropertyOptional({ example: 'Austen' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: Language })
  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @ApiPropertyOptional({ enum: Object.keys(BOOK_GENRES) }) // [2026-11-17]: género (novela, cuento, poesía…)
  @IsOptional()
  @IsIn(Object.keys(BOOK_GENRES))
  genre?: BookGenre;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  page?: number;
}

// [RF-147]: posición de lectura (enteros ≥ 0 con tope → nada de valores absurdos)
export class BookProgressBody {
  @IsInt() @Min(0) @Max(10_000) chapter!: number;
  @IsInt() @Min(0) @Max(100_000) paragraph!: number;
  @IsInt() @Min(0) @Max(10_000) sentence!: number;
}

@ApiTags('books')
@ApiBearerAuth()
@Controller('books')
export class BooksController {
  constructor(
    private readonly uc: SearchBooksUseCase,
    private readonly text: BookTextUseCase,
    private readonly language: BookLanguageUseCase,
    private readonly progress: BookProgressUseCase,
  ) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Buscar libros de dominio público por título o autor (filtro de idioma)',
  })
  search(@Query() q: SearchBooksQuery) {
    return this.uc.search({
      search: q.search || undefined,
      language: q.language,
      genre: q.genre,
      page: q.page ?? 1,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Ficha de un libro con su atribución a Project Gutenberg',
  })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.uc.get(id);
  }

  // [RF-146]: abrir el libro = descargarlo (solo esta vez, solo este libro) → índice de capítulos · tope estricto por usuario
  @Get(':id/chapters')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Índice de capítulos (descarga el libro bajo pedido)',
  })
  chapters(@Param('id', ParseIntPipe) id: number) {
    return this.text.index(id);
  }

  @Get(':id/chapters/:chapter')
  @ApiOperation({
    summary: 'Una página de un capítulo (párrafos divididos en frases)',
  })
  page(
    @Param('id', ParseIntPipe) id: number,
    @Param('chapter', ParseIntPipe) chapter: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    return this.text.page(id, chapter, page);
  }

  // [RF-146]: traducción al español de UN párrafo (respaldo del servidor cuando el navegador no trae Translator API) · el LLM es caro → tope
  @Post(':id/chapters/:chapter/paragraphs/:paragraph/translation')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Traducir un párrafo (contexto: el párrafo anterior; con caché)',
  })
  translate(
    @Param('id', ParseIntPipe) id: number,
    @Param('chapter', ParseIntPipe) chapter: number,
    @Param('paragraph', ParseIntPipe) paragraph: number,
    @Headers('authorization') auth: string,
  ) {
    return this.language.translate(id, chapter, paragraph, bearer(auth));
  }

  @Get(':id/chapters/:chapter/paragraphs/:paragraph/sentences/:sentence/ipa')
  @ApiOperation({ summary: 'IPA de una frase (espeak-ng, con caché)' })
  ipa(
    @Param('id', ParseIntPipe) id: number,
    @Param('chapter', ParseIntPipe) chapter: number,
    @Param('paragraph', ParseIntPipe) paragraph: number,
    @Param('sentence', ParseIntPipe) sentence: number,
    @Headers('authorization') auth: string,
  ) {
    return this.language.sentenceIpa(
      id,
      chapter,
      paragraph,
      sentence,
      bearer(auth),
    );
  }

  // [RF-147]: progreso de lectura del usuario del JWT
  @Get(':id/progress')
  @ApiOperation({
    summary: 'Marcador de lectura del usuario en el libro (RF-147)',
    description: 'Capítulo, párrafo y frase donde se quedó; null si aún no lo abrió.',
  })
  getProgress(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.progress.get(user.sub, id);
  }

  @Put(':id/progress')
  @ApiOperation({
    summary: 'Guardar el marcador de lectura (RF-147)',
    description: 'Upsert por usuario y libro; enteros con tope (BookProgressBody).',
  })
  saveProgress(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: BookProgressBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.progress.save(user.sub, id, body);
  }
}
