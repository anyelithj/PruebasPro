import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Public } from '../../../shared/decorators/public.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { sendRanged } from '../../../shared/http/ranged-response';
import { Role } from '../../users/domain/value-objects/role.vo';
import { IssueCertificateUseCase } from '../application/use-cases/issue-certificate.use-case';
import { RevokeCertificateUseCase } from '../application/use-cases/revoke-certificate.use-case';
import {
  GetCertificatePdfUseCase,
  ListMyCertificatesUseCase,
  VerifyCertificateUseCase,
} from '../application/use-cases/verify-certificate.use-case';
// [Controller Certificates · Sprints 2.7/7.8]: emitir, listar, descargar, verificar (público) y revocar (ADMIN) | [Patrón]: Thin Controller | [Principio]: SRP + DIP + mínimo privilegio | [Paradigma]: POO + Decoradores
// [Seguridad]: las rutas /verify son @Public (cualquiera verifica) pero solo devuelven la vista pública · el PDF solo lo descarga su dueño

export class IssueCertificateBody {
  @IsUUID('all') courseId!: string;
}

export class RevokeCertificateBody {
  @IsString() @MinLength(3) @MaxLength(300) reason!: string;
}

// [Formato del código]: AULA-XXXX-XXXX (sin 0/O/1/I) · bloquea entradas raras antes de tocar la BD
const CODE = /^AULA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/i;

@ApiTags('certificates')
@ApiBearerAuth()
@Controller('certificates')
export class CertificatesController {
  constructor(
    private readonly issue: IssueCertificateUseCase,
    private readonly listMine: ListMyCertificatesUseCase,
    private readonly pdf: GetCertificatePdfUseCase,
    private readonly verify: VerifyCertificateUseCase,
    private readonly revoke: RevokeCertificateUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Emitir el certificado de un curso completado al 100 %',
  })
  create(@CurrentUser() user: JwtPayload, @Body() body: IssueCertificateBody) {
    return this.issue.execute(user.sub, body.courseId);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Mis certificados y los cursos que ya puedo certificar',
  })
  mine(@CurrentUser() user: JwtPayload) {
    return this.listMine.execute(user.sub);
  }

  @Public()
  @Get('verify/tx/:txHash')
  @ApiOperation({
    summary: 'Verificación pública por hash de la transacción de Sepolia',
  })
  byTx(@Param('txHash') txHash: string) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return this.verify.byTx('0x'); // Formato inválido → 404 del caso de uso (mismo mensaje)
    return this.verify.byTx(txHash);
  }

  // [QR · Sprint 7.8]: SVG crudo (sin envoltorio JSON) → Angular lo pinta con <img> en tarjetas y diploma | caché 1 día (el código no cambia)
  @Public()
  @Get('verify/:code/qr')
  @ApiOperation({ summary: 'QR (SVG) de verificación del certificado' })
  async qr(@Param('code') code: string, @Res() res: Response): Promise<void> {
    const svg = await this.verify.qrSvg(CODE.test(code) ? code : 'INVALIDO');
    res
      .type('image/svg+xml')
      .set('Cache-Control', 'public, max-age=86400')
      .set('X-Content-Type-Options', 'nosniff')
      .send(svg);
  }

  @Public()
  @Get('verify/:code')
  @ApiOperation({ summary: 'Verificación pública por código (AULA-XXXX-XXXX)' })
  byCode(@Param('code') code: string) {
    return this.verify.byCode(CODE.test(code) ? code : 'INVALIDO');
  }

  // `@Res()`: el PDF viaja en flujo (disco) o redirige a la URL firmada (S3/R2), igual que los reportes
  @Get(':id/pdf')
  @ApiOperation({ summary: 'Descargar el PDF del certificado (solo el dueño)' })
  async file(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, source } = await this.pdf.execute(user.sub, id);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    await sendRanged(res, range, source);
  }

  @Patch(':id/revoke')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Revocar un certificado (solo ADMIN)' })
  revokeOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RevokeCertificateBody,
  ) {
    return this.revoke.execute(id, body.reason);
  }
}
