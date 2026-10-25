import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../../domain/entities/wallet.entity';
// [UseCase UnlinkWallet · Sprint 7.6]: el dueño desvincula su billetera (los pagos ya hechos conservan la dirección usada) | [Patrón]: Use Case (Command) | [Principio]: SRP | [Paradigma]: POO + async/await

@Injectable()
export class UnlinkWalletUseCase {
  constructor(
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
  ) {}

  async execute(
    userId: string,
    id: string,
  ): Promise<{ id: string; removed: true }> {
    const res = await this.wallets.delete({ id, userId }); // Filtro por dueño → una ajena es 404
    if (!res.affected) throw new NotFoundException('Billetera no encontrada');
    return { id, removed: true };
  }
}
