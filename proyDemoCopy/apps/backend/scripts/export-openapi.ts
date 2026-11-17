import { existsSync, writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { buildOpenApiDocument } from '../src/shared/config/swagger.config'; // [Sprint 11.2]: mismo documento que /api/v1/docs-json | [Principio]: DRY + SSOT
// [Script export-openapi · Sprints 7.1/10.13]: escribe el OpenAPI de NestJS a un archivo SIN base de datos ni Redis (`preview: true`: Nest arma el grafo de módulos y controladores sin instanciar proveedores) → `pnpm api:types` del frontend lo lee sin levantar el backend | [Patrón]: Contract-First | [Principio]: SSOT (el backend define la API) + KISS
// [Uso]: pnpm openapi:export [ruta]      (por defecto ./openapi.json)

for (const file of ['.env.local', '.env'])
  if (existsSync(file)) process.loadEnvFile(file); // `process.loadEnvFile` (Node ≥ 20.12)

async function main(): Promise<void> {
  const out = process.argv[2] ?? 'openapi.json';
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: ['error'],
  });
  app.setGlobalPrefix(process.env.API_PREFIX ?? 'api/v1'); // Mismo prefijo que main.ts
  writeFileSync(out, JSON.stringify(buildOpenApiDocument(app), null, 2));
  console.log(`OpenAPI → ${out}`);
  await app.close();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
