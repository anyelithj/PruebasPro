import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AIClientService } from '../src/modules/ai/ai-client.service';
import {
  TOKEN_SERVICE,
  type ITokenService,
} from '../src/modules/auth/domain/interfaces/token.service.interface';
import { ChangeSongStatusUseCase } from '../src/modules/music/application/use-cases/change-song-status.use-case';
import { CreateCollectionUseCase } from '../src/modules/music/application/use-cases/create-collection.use-case';
import { CreateSongUseCase } from '../src/modules/music/application/use-cases/create-song.use-case';
import { ReplaceSongLinesUseCase } from '../src/modules/music/application/use-cases/replace-song-lines.use-case';
import { UploadSongAudioUseCase } from '../src/modules/music/application/use-cases/upload-song-audio.use-case';
import { SongCollection } from '../src/modules/music/domain/entities/song-collection.entity';
import { Song } from '../src/modules/music/domain/entities/song.entity';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../src/modules/users/domain/interfaces/user.repository.interface';
import {
  DEFAULT_VARIANT,
  Language,
} from '../src/shared/domain/language.vo';
// [Script contenido inicial · Sprint 9.15 · RF-116/RF-128]: una canción tradicional de dominio público por idioma (siete idiomas) con su colección, letra enriquecida (IPA y traducción vía FastAPI) y audio recitado con espeak-ng | [Patrón]: Batch Job idempotente (usa los casos de uso reales: licencia, estados y revisión) | [Principio]: DRY (nada de SQL a mano) + cumplimiento de derechos de autor (solo dominio público)
// [Uso]: pnpm seed:music                 (las deja «En revisión»: un docente nativo revisa letra, IPA y traducción)
//        pnpm seed:music --publish       (solo desarrollo: el ADMIN las publica para ver la UI)
// [Requisitos]: FastAPI arriba para IPA, traducción y voz; sin FastAPI quedan en borrador sin audio (degradación elegante)

for (const file of ['.env.local', '.env'])
  if (existsSync(file)) process.loadEnvFile(file); // `process.loadEnvFile` (Node ≥ 20.12)

interface SeedSong {
  language: Language;
  level: string;
  title: string;
  source: string; // Referencia de dominio público
  lyrics: string;
}

// [Banco]: letras tradicionales anónimas o de autores fallecidos hace más de 70 años
const SONGS: SeedSong[] = [
  {
    language: Language.EN,
    level: 'A1',
    title: 'Twinkle, Twinkle, Little Star',
    source: 'Jane Taylor, «The Star» (1806) — dominio público',
    lyrics:
      'Twinkle, twinkle, little star,\nHow I wonder what you are!\nUp above the world so high,\nLike a diamond in the sky.\nTwinkle, twinkle, little star,\nHow I wonder what you are!',
  },
  {
    language: Language.FR,
    level: 'A1',
    title: 'Frère Jacques',
    source: 'Canción tradicional francesa (s. XVIII) — dominio público',
    lyrics:
      'Frère Jacques, frère Jacques,\nDormez-vous ? Dormez-vous ?\nSonnez les matines, sonnez les matines,\nDing, dang, dong. Ding, dang, dong.',
  },
  {
    language: Language.DE,
    level: 'A1',
    title: 'Alle meine Entchen',
    source: 'Canción infantil tradicional alemana (s. XIX) — dominio público',
    lyrics:
      "Alle meine Entchen\nschwimmen auf dem See,\nschwimmen auf dem See,\nKöpfchen in das Wasser,\nSchwänzchen in die Höh'.",
  },
  {
    language: Language.ES,
    level: 'A1',
    title: 'Los pollitos dicen',
    source: 'Canción infantil tradicional hispanoamericana — dominio público',
    lyrics:
      'Los pollitos dicen\npío, pío, pío,\ncuando tienen hambre,\ncuando tienen frío.',
  },
  {
    language: Language.PT,
    level: 'A1',
    title: 'Ciranda, cirandinha',
    source: 'Cantiga de roda tradicional brasileña — dominio público',
    lyrics:
      'Ciranda, cirandinha,\nvamos todos cirandar,\nvamos dar a meia volta,\nvolta e meia vamos dar.',
  },
  {
    language: Language.ZH,
    level: 'A1',
    title: '两只老虎',
    source: 'Canción infantil tradicional china (melodía de «Frère Jacques») — dominio público',
    lyrics: '两只老虎，两只老虎，\n跑得快，跑得快，\n一只没有耳朵，\n一只没有尾巴，\n真奇怪！真奇怪！',
  },
  {
    language: Language.RU,
    level: 'A2',
    title: 'Калинка',
    source: 'Iván Lariónov, «Kalinka» (1860) — dominio público',
    lyrics: 'Калинка, калинка, калинка моя!\nВ саду ягода малинка, малинка моя!',
  },
];

async function main(): Promise<void> {
  const publish = process.argv.includes('--publish');
  if (publish && process.env.NODE_ENV === 'production')
    throw new Error('--publish es solo para desarrollo'); // [Fail Fast]: en producción publica el ADMIN tras la revisión nativa
  const email =
    process.argv.slice(2).find((a) => !a.startsWith('--')) ??
    'admin@neuroedu.ia';
  // `createApplicationContext` (NestJS): contenedor DI sin servidor HTTP
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const user = await app
      .get<IUserRepository>(USER_REPOSITORY)
      .findByEmail(email);
    if (!user) throw new Error(`No existe el usuario ${email}`);
    if (user.role !== 'ADMIN') throw new Error(`${email} no es ADMIN`);
    const actor = { id: user.id, role: 'ADMIN' };
    // [Token]: FastAPI exige JWT; se firma uno de acceso corto para el ADMIN (mismo servicio que el login)
    const { accessToken } = await app
      .get<ITokenService>(TOKEN_SERVICE)
      .issuePair({ userId: user.id, email: user.email, role: user.role });
    const songs = app.get<Repository<Song>>(getRepositoryToken(Song));
    const collections = app.get<Repository<SongCollection>>(
      getRepositoryToken(SongCollection),
    );
    const ai = app.get(AIClientService);
    const status = app.get(ChangeSongStatusUseCase);

    for (const s of SONGS) {
      // [Idempotente]: misma canción e idioma → se reutiliza
      let song = await songs.findOneBy({
        title: s.title,
        language: s.language,
      });
      if (!song) {
        song = await app.get(CreateSongUseCase).execute(actor, {
          title: s.title,
          artist: 'Tradicional',
          language: s.language,
          level: s.level,
          license: {
            type: 'public_domain',
            source: s.source,
            holder: 'Dominio público',
            confirmed: true,
          },
        });
        const { enriched } = await app
          .get(ReplaceSongLinesUseCase)
          .execute(actor, song.id, s.lyrics, accessToken);
        if (!enriched) console.warn(`· ${s.language}: letra sin IPA ni traducción (FastAPI caído)`);
      }
      if (!song.audioKey) {
        try {
          // [Audio]: letra recitada con espeak-ng (obra generada por la plataforma; el avatar «canta» con su volumen)
          const voice = await ai.speak(
            {
              text: s.lyrics.replace(/\n/g, ' '),
              language: s.language,
              variant: DEFAULT_VARIANT[s.language],
            },
            accessToken,
          );
          song = await app.get(UploadSongAudioUseCase).execute(actor, song.id, {
            buffer: voice.audio,
            mimetype: 'audio/wav',
            size: voice.audio.length,
          });
        } catch {
          console.warn(`· ${s.language}: sin audio (motor de voz no disponible); queda en borrador`);
        }
      }
      if (song.audioKey && song.status === 'draft')
        song = await status.execute(actor, song.id, 'review');
      if (publish && song.status === 'review')
        song = await status.execute(actor, song.id, 'published');

      const title = 'Canciones tradicionales';
      const existing = await collections.findOneBy({
        title,
        language: s.language,
      });
      if (!existing)
        await app.get(CreateCollectionUseCase).execute(actor, {
          title,
          description: 'Canciones de dominio público para empezar.',
          language: s.language,
          level: s.level,
          theme: 'canciones infantiles',
          emoji: '🎶',
          songIds: [song.id],
        });
      console.log(`✓ ${s.language} · ${s.title} · ${song.status}`);
    }
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
