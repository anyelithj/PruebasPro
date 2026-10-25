import { registerAs } from '@nestjs/config';
// [Configuración rate limit]: protección contra abuso por IP | [Patrón]: Configuration Object | [Paradigma]: Funcional

// [Factoría Throttler]: límite global de requests | [Patrón]: Factory | [Principio]: SRP
export default registerAs('throttler', () => ({
  // [TTL]: ventana en ms (60000 = 1 min)
  ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
  // [Limit]: máx requests por IP dentro del TTL
  limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
}));
