import { registerAs } from '@nestjs/config';
// [Configuración Redis]: cache + bull queues | [Patrón]: Configuration Object | [Paradigma]: Funcional

// [Factoría Redis]: namespace 'redis' del ConfigService | [Patrón]: Factory | [Principio]: SRP
export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  // [Password opcional]: undefined si vacío (Redis local típicamente sin auth)
  password: process.env.REDIS_PASSWORD || undefined,
  // [TTL default]: 60s para responses cacheadas
  ttl: parseInt(process.env.REDIS_TTL ?? '60', 10),
}));
