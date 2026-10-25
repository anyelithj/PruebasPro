import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsUUID, Matches } from 'class-validator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { CreateCryptoPaymentUseCase } from '../application/use-cases/create-crypto-payment.use-case';
import {
  GetCryptoPaymentUseCase,
  ListMyCryptoPaymentsUseCase,
} from '../application/use-cases/get-crypto-payment.use-case';
import { RegisterCryptoTxUseCase } from '../application/use-cases/register-crypto-tx.use-case';
// [Controller CryptoPayments · Sprint 7.6]: crear el pago con ETH de prueba, consultarlo y registrar la transacción | [Patrón]: Thin Controller | [Principio]: SRP + DIP | [Paradigma]: POO + Decoradores

export class CreateCryptoPaymentBody {
  @IsUUID('all') orderId!: string;
}

export class RegisterTxBody {
  @Matches(/^0x[0-9a-fA-F]{64}$/, { message: 'Hash de transacción inválido' })
  txHash!: string;
}

@ApiTags('web3')
@ApiBearerAuth()
@Controller('web3/payments')
export class CryptoPaymentsController {
  constructor(
    private readonly create: CreateCryptoPaymentUseCase,
    private readonly listMine: ListMyCryptoPaymentsUseCase,
    private readonly getOne: GetCryptoPaymentUseCase,
    private readonly registerTx: RegisterCryptoTxUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear el pago PENDIENTE en ETH de prueba (Sepolia) de una orden',
  })
  start(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateCryptoPaymentBody,
  ) {
    return this.create.execute(user, body.orderId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Mis pagos con criptomonedas' })
  mine(@CurrentUser() user: JwtPayload) {
    return this.listMine.execute(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Estado y confirmaciones del pago cripto' })
  detail(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getOne.execute(user.sub, id);
  }

  @Patch(':id/tx')
  @ApiOperation({
    summary:
      'Registrar el hash de la transacción y encolar su verificación (idempotente)',
  })
  tx(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RegisterTxBody,
  ) {
    return this.registerTx.execute(user.sub, id, body.txHash);
  }
}
