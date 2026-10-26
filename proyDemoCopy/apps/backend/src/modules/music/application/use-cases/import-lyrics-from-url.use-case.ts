import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  WEB_PAGE_FETCHER,
  WebFetchError,
  type WebPageFetcher,
} from '../../domain/interfaces/web-page-fetcher.interface';
import {
  decodeBody,
  type ExtractedLyrics,
  extractLyrics,
  plainLyrics,
} from '../../domain/lyrics-text';
// [UseCase ImportLyricsFromUrl · 2026-10-24 · RF-117]: lee la letra de una página pública (Genius, Letras, AZLyrics, blogs…) para el paso «Letra» del asistente — NO guarda nada: el docente revisa el texto y lo carga con POST /songs/:id/lines
// [Contenido no HTML]: PDF, imágenes o audio → 415 y el frontend usa el extractor general de Next.js (OCR, Whisper…) | [Patrón]: Use Case (Query) + Port (WebPageFetcher) + Strategy (HTML | texto plano) + Error Translation | [Principio]: SRP + DIP + mensajes accionables | [Paradigma]: POO + funcional

const HTML = /^(text\/html|application\/xhtml\+xml)/i;
const PLAIN = /^text\/(plain|lrc|x-lrc)|^application\/x-subrip$/i; // .txt / .lrc / .srt servidos como texto (octet-stream solo por extensión)

@Injectable()
export class ImportLyricsFromUrlUseCase {
  private readonly logger = new Logger(ImportLyricsFromUrlUseCase.name);

  constructor(
    @Inject(WEB_PAGE_FETCHER) private readonly fetcher: WebPageFetcher,
  ) {}

  async execute(url: string): Promise<ExtractedLyrics & { url: string }> {
    const page = await this.fetcher.fetch(url).catch((err: unknown) => {
      throw this.translate(err, url);
    });
    const mime = page.contentType.split(';')[0]!.trim();
    const name = new URL(page.url).pathname.split('/').pop() ?? '';
    try {
      // [Strategy]: HTML (o sin tipo pero con «<html») → extractor de letras; texto plano/LRC → limpieza; resto → 415
      const text = decodeBody(page.body, page.contentType);
      if (HTML.test(mime) || (!mime && /<html|<body/i.test(text.slice(0, 2048))))
        return { ...extractLyrics(text), url: page.url };
      if (PLAIN.test(mime) || /\.(txt|lrc|srt)$/i.test(name))
        return { ...plainLyrics(text, name.replace(/\.[^.]+$/, '')), url: page.url };
    } catch (err) {
      // Las funciones puras lanzan Error con un mensaje ya pensado para el docente
      throw new UnprocessableEntityException(err instanceof Error ? err.message : String(err));
    }
    throw new UnsupportedMediaTypeException(
      `El enlace no es una página de texto (${mime || 'tipo desconocido'}).`,
    );
  }

  // [translate]: motivo del adaptador → excepción HTTP con QUÉ HACER | [Patrón]: Error Translation
  private translate(err: unknown, url: string): Error {
    if (!(err instanceof WebFetchError)) {
      this.logger.error(`Importar letra ${url}: ${String(err)}`);
      return new UnprocessableEntityException('No se pudo leer el enlace.');
    }
    const host = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return 'el sitio';
      }
    })(); // IIFE (función invocada al instante): valor con try/catch sin variable mutable
    this.logger.warn(`Importar letra ${host}: ${err.reason} (${err.status ?? '—'})`);
    switch (err.reason) {
      case 'invalid_url':
      case 'private_address':
        return new BadRequestException(err.message);
      case 'challenge':
        return new UnprocessableEntityException(
          `${host} protege sus páginas con una verificación anti-bots que solo se supera en un navegador. Abre la página, copia la letra y pégala en el cuadro de texto.`,
        );
      case 'blocked':
        return new UnprocessableEntityException(
          `${host} rechazó la lectura automática (código ${err.status}) incluso identificándonos como navegador. Copia la letra desde la página y pégala en el cuadro de texto, o sube un archivo con la letra.`,
        );
      default:
        return new UnprocessableEntityException(err.message);
    }
  }
}
