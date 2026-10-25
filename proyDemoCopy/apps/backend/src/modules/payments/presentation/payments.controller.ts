import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Public } from '../../../shared/decorators/public.decorator';
import { CreateCheckoutSessionDto } from '../application/dtos/create-order.dto';
import { CreateCheckoutSessionUseCase } from '../application/use-cases/create-checkout-session.use-case';
import {
  GetPaymentStatusUseCase,
  ListMyPaymentsUseCase,
} from '../application/use-cases/get-payment-status.use-case';
import { HandleGatewayWebhookUseCase } from '../application/use-cases/handle-gateway-webhook.use-case';
// [Controller Payments · Sprint 7.3]: sesión de pago, historial, estado y webhook de la pasarela | [Patrón]: Thin Controller | [Principio]: SRP + DIP | [Paradigma]: POO + Decoradores
// [Seguridad]: el webhook es @Public pero exige la firma HMAC de Stripe sobre el cuerpo CRUDO (main.ts: `rawBody: true`)

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly checkout: CreateCheckoutSessionUseCase,
    private readonly listMine: ListMyPaymentsUseCase,
    private readonly status: GetPaymentStatusUseCase,
    private readonly webhook: HandleGatewayWebhookUseCase,
  ) {}

  @Post('checkout-session')
  @ApiOperation({
    summary: 'Crear (o reabrir) la sesión de pago embebida de una orden',
  })
  createSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    return this.checkout.execute(user, dto.orderId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Mi historial de pagos (ADMIN: todos)' })
  mine(@CurrentUser() user: JwtPayload) {
    return this.listMine.execute(user);
  }

  @Get(':id/status')
  @ApiOperation({
    summary: 'Estado del pago (lo consulta periódicamente el checkout)',
  })
  paymentStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.status.execute(user, id);
  }

  // `@SkipThrottle` (@nestjs/throttler): Stripe puede enviar ráfagas de eventos · 200 rápido = Stripe no reintenta
  @Public()
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // No se documenta: solo lo llama Stripe
  receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!req.rawBody || !signature)
      throw new BadRequestException('Falta la firma del webhook');
    return this.webhook.execute(req.rawBody, signature);
  }
}
