import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, Matches } from 'class-validator';
import type { Request } from 'express';
import { Public } from '../../../shared/decorators/public.decorator';
import type { AuthResponseDto } from '../application/dtos/auth-response.dto';
import { RequestMagicLinkUseCase } from '../application/use-cases/request-magic-link.use-case';
import { VerifyMagicLinkUseCase } from '../application/use-cases/verify-magic-link.use-case';
// [Controller MagicLink · Sprints 1.5/7.18]: pedir y canjear el enlace de acceso sin contraseña | [Patrón]: Thin Controller | [Principio]: SRP + seguridad (rutas @Public con límite estricto: 5 por minuto) | [Paradigma]: POO + Decoradores

export class RequestMagicLinkBody {
  @IsEmail() email!: string;
}

export class VerifyMagicLinkBody {
  @Matches(/^[0-9a-f]{64}$/) token!: string;
}

const LIMIT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth/magic-link')
export class MagicLinkController {
  constructor(
    private readonly request: RequestMagicLinkUseCase,
    private readonly verify: VerifyMagicLinkUseCase,
  ) {}

  @Public()
  @Post('request')
  @Throttle(LIMIT)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Enviar un enlace de acceso por correo (respuesta genérica)',
  })
  requestOne(@Body() body: RequestMagicLinkBody): Promise<{ sent: true }> {
    return this.request.execute(body.email);
  }

  @Public()
  @Post('verify')
  @Throttle(LIMIT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Canjear el enlace por un par de tokens (un solo uso)',
  })
  verifyOne(
    @Body() body: VerifyMagicLinkBody,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.verify.execute(body.token, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
