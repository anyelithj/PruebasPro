import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { CreateSiweNonceUseCase } from '../application/use-cases/create-siwe-nonce.use-case';
import {
  GetWalletUseCase,
  LinkWalletUseCase,
  ListMyWalletsUseCase,
} from '../application/use-cases/link-wallet.use-case';
import { UnlinkWalletUseCase } from '../application/use-cases/unlink-wallet.use-case';
// [Controller Wallets · Sprint 7.6]: reto SIWE, vincular, listar, ver y desvincular billeteras | [Patrón]: Thin Controller | [Principio]: SRP + DIP | [Paradigma]: POO + Decoradores
// [Seguridad]: JWT global · cada usuario solo opera sus billeteras · la plataforma no custodia claves

// [DTO]: mensaje EIP-4361 en texto y firma ECDSA hex (65 bytes = 130 hex)
export class VerifyWalletBody {
  @IsString() @MaxLength(2000) message!: string;
  @Matches(/^0x[0-9a-fA-F]{130}$/, { message: 'Firma inválida' })
  signature!: `0x${string}`;
}

@ApiTags('web3')
@ApiBearerAuth()
@Controller('web3/wallets')
export class WalletsController {
  constructor(
    private readonly nonce: CreateSiweNonceUseCase,
    private readonly link: LinkWalletUseCase,
    private readonly listMine: ListMyWalletsUseCase,
    private readonly getOne: GetWalletUseCase,
    private readonly unlink: UnlinkWalletUseCase,
  ) {}

  @Post('nonce')
  @ApiOperation({
    summary: 'Reto SIWE (EIP-4361) de un solo uso para firmar con la billetera',
  })
  challenge(@CurrentUser() user: JwtPayload) {
    return this.nonce.execute(user.sub);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar la firma SIWE y vincular la billetera' })
  verify(@CurrentUser() user: JwtPayload, @Body() body: VerifyWalletBody) {
    return this.link.execute(user.sub, body.message, body.signature);
  }

  @Get('me')
  @ApiOperation({ summary: 'Mis billeteras vinculadas' })
  mine(@CurrentUser() user: JwtPayload) {
    return this.listMine.execute(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una billetera vinculada' })
  detail(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getOne.execute(user.sub, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desvincular una billetera' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.unlink.execute(user.sub, id);
  }
}
