import {
  Query,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
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
import { ManageCertificatesUseCase, type IssuedFilters } from '../application/use-cases/manage-certificates.use-case';
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

// [2026-11-09 · RF-32]: gestión ADMIN/DOCENTE
export class ManualCertificateBody {
  @IsEmail() @MaxLength(200) email!: string;
  @IsUUID('all') courseId!: string;
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}

export class ReissueCertificateBody {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) recipientName?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) courseTitle?: string;
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}

export class CertificateTemplateBody {
  @IsString() @MinLength(2) @MaxLength(80) institution!: string;
  @IsOptional() @IsString() @MaxLength(120) signerName?: string;
  @IsOptional() @IsString() @MaxLength(120) signerTitle?: string;
  @IsOptional() @IsString() @MaxLength(400) legalText?: string;
}

export class CertificateMetadataBody {
  @IsOptional() @IsString() @MaxLength(2000) adminNotes?: string;
}

// [2026-11-09 · RF-32]: cierre académico y nota final (docente de su curso o ADMIN)
export class ClosureBody {
  @IsUUID('all') userId!: string;
  @IsUUID('all') courseId!: string;
  @IsBoolean() approve!: boolean;
}

export class GradeBody {
  @IsUUID('all') userId!: string;
  @IsUUID('all') courseId!: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) grade!: number | null; // null = vuelve a la nota del examen
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class RevokeRequestBody {
  @IsString() @MinLength(10) @MaxLength(1000) reason!: string;
}

// [Formato del código]: AULA-XXXX-XXXX (sin 0/O/1/I) · bloquea entradas raras antes de tocar la BD
const CODE = /^AULA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/i;

const actor = (u: JwtPayload) => ({ id: u.sub, admin: u.role === Role.ADMIN });

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
    private readonly manage: ManageCertificatesUseCase,
  ) {}

  // [GET /certificates/issued · 2026-11-06 → 2026-11-09]: bandeja con filtros (ADMIN: todos · docente: los de sus cursos)
  @Get('issued')
  @Roles(Role.TEACHER)
  @ApiOperation({ summary: 'Certificados emitidos (gestión) con filtros' })
  issuedList(@CurrentUser() user: JwtPayload, @Query() q: IssuedFilters) {
    return this.manage.list(actor(user), {
      search: typeof q.search === 'string' ? q.search : '',
      status: q.status,
      courseId: q.courseId,
      from: q.from,
      to: q.to,
    });
  }

  // [POST /certificates/manual]: emisión por excepción (ADMIN) con motivo auditable
  @Post('manual')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Emitir un certificado manualmente (excepción, solo ADMIN)' })
  manual(@Body() body: ManualCertificateBody) {
    return this.issue.issueManual(body.email, body.courseId, body.reason);
  }

  // [POST /certificates/closure · 2026-11-09 · RF-32]: aprobar/retirar el cierre académico → gatillo de la emisión
  @Post('closure')
  @Roles(Role.TEACHER)
  @ApiOperation({ summary: 'Aprobar el cierre académico del alumno (docente de su curso o ADMIN) y emitir si cumple' })
  closure(@CurrentUser() user: JwtPayload, @Body() body: ClosureBody) {
    return this.issue.approveClosure(actor(user), body.userId, body.courseId, body.approve);
  }

  // [PATCH /certificates/grade · 2026-11-09 · RF-32]: corregir la nota final → recalcula la elegibilidad
  @Patch('grade')
  @Roles(Role.TEACHER)
  @ApiOperation({ summary: 'Corregir la nota final del alumno (docente de su curso o ADMIN)' })
  grade(@CurrentUser() user: JwtPayload, @Body() body: GradeBody) {
    return this.issue.setGrade(actor(user), body.userId, body.courseId, body.grade ?? null, body.note ?? '');
  }

  // [GET/PUT /certificates/template · 2026-11-09 · RF-32]: plantilla del PDF (ADMIN)
  @Get('template')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Plantilla del certificado (institución, firma, texto legal)' })
  getTemplate() {
    return this.manage.getTemplate();
  }

  @Put('template')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Guardar la plantilla del certificado (solo ADMIN)' })
  saveTemplate(@Body() body: CertificateTemplateBody) {
    return this.manage.saveTemplate(body);
  }

  @Get(':id/detail')
  @Roles(Role.TEACHER)
  @ApiOperation({ summary: 'Detalle del certificado (ADMIN: todos · docente: sus cursos)' })
  detail(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.manage.detail(actor(user), id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Editar metadatos de control (notas de auditoría)' })
  updateMeta(@Param('id', ParseUUIDPipe) id: string, @Body() body: CertificateMetadataBody) {
    return this.manage.updateMetadata(id, body);
  }

  // [reissue]: corregir nombre o curso impresos → nuevo PDF, código, hash y anclaje
  @Post(':id/reissue')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reemitir con datos corregidos (solo ADMIN)' })
  reissue(@Param('id', ParseUUIDPipe) id: string, @Body() body: ReissueCertificateBody) {
    return this.issue.reissue(id, body, body.reason);
  }

  @Post(':id/revoke-request')
  @Roles(Role.TEACHER)
  @ApiOperation({ summary: 'Solicitar la revocación al ADMIN (docente del curso)' })
  revokeRequest(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: RevokeRequestBody) {
    return this.manage.requestRevocation(actor(user), id, body.reason);
  }

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
  @ApiOperation({ summary: 'Descargar el PDF del certificado (dueño · docente de su curso · ADMIN)' })
  async file(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    // [2026-11-09 · RF-32]: ADMIN (todos) y docente (sus cursos) también lo descargan para dar soporte; `detail` valida el alcance (403 si no)
    const staff = (user.role === Role.ADMIN || user.role === Role.TEACHER) && (await this.manage.detail(actor(user), id).then(() => true, () => false));
    const { filename, source } = await this.pdf.execute(staff ? null : user.sub, id); // Sin alcance → solo si es SU certificado
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
