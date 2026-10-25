import { createKeyvNonBlocking } from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import redisConfig from '../config/redis.config';
// [RedisCacheModule · Sprint 6.6 · RF-75]: caché distribuida en Redis para cache-manager (antes: memoria por proceso en Quiz y Score) | [Patrón]: Module + Factory + Adapter (Keyv) | [Principio]: DIP (los casos de uso siguen pidiendo CACHE_MANAGER) + DRY (una sola configuración)
// [Tecnología]: @nestjs/cache-manager v3 + cache-manager v7 + @keyv/redis
// [Resiliencia]: `createKeyvNonBlocking` → si Redis cae, las lecturas son "miss" y la app sigue respondiendo desde la BD (Cache-Aside degradado)

@Module({
  imports: [
    // `isGlobal: true` (NestJS): CACHE_MANAGER se inyecta en cualquier módulo sin volver a registrarlo
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule.forFeature(redisConfig)],
      inject: [redisConfig.KEY],
      useFactory: (cfg: ConfigType<typeof redisConfig>) => ({
        ttl: cfg.ttl * 1000, // cache-manager v7 usa milisegundos
        stores: [
          createKeyvNonBlocking(
            {
              url: `redis://${cfg.host}:${cfg.port}`,
              password: cfg.password,
            },
            { namespace: 'aula' }, // Prefijo de claves → no choca con las colas de Bull en el mismo Redis
          ),
        ],
      }),
    }),
  ],
})
export class RedisCacheModule {}
