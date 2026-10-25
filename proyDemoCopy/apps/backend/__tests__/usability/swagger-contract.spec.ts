import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiBearerAuth, ApiOperation, ApiTags, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// [Suite Usability – contrato Swagger]: garantiza que DocumentBuilder + decorators OpenAPI emiten doc consistente con la API expuesta. [Por qué]: el OpenAPI alimenta el cliente HTTP del frontend; una doc rota propaga errores cliente/servidor difíciles de detectar.

@ApiTags('demo')
@ApiBearerAuth()
@Controller('demo')
class DemoController {
  @Get()
  @ApiOperation({ summary: 'List demo items' })
  list() {
    return [];
  }
}

describe('Usability: contrato Swagger (OpenAPI document)', () => {
  let doc: ReturnType<typeof SwaggerModule.createDocument>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [DemoController] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    const config = new DocumentBuilder()
      .setTitle('Plataforma Evaluación Cognitiva — API')
      .setDescription('Quiz + IA + RBAC')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    doc = SwaggerModule.createDocument(app, config);
    await app.close();
  });

  it('info incluye título, descripción y versión', () => {
    expect(doc.info.title).toContain('Plataforma');
    expect(doc.info.version).toBe('1.0');
    expect(doc.info.description).toMatch(/Quiz/);
  });

  it('declara securityScheme `bearer` para JWT', () => {
    expect(doc.components?.securitySchemes?.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('expone la ruta /demo con tag, summary y requirement de auth', () => {
    expect(doc.paths['/demo']).toBeDefined();
    const op = doc.paths['/demo'].get!;
    expect(op.tags).toContain('demo');
    expect(op.summary).toBe('List demo items');
    expect(op.security).toEqual([{ bearer: [] }]);
  });
});
