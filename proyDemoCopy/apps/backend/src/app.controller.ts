import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger'; // `@ApiTags` (Swagger): agrupa el endpoint en la sección «health» de /api/v1/docs
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Raíz de la API (comprobación de vida)' }) // [Sprint 11.2]: toda operación documentada en OpenAPI
  getHello(): string {
    return this.appService.getHello();
  }
}
