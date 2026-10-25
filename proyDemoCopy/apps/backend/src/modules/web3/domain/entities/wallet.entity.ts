import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity Wallet · Sprint 7.6]: billetera EVM vinculada a un usuario tras firmar un mensaje SIWE (EIP-4361) | [Patrón]: Entity (DDD) | [Principio]: SRP + mínimo dato (la plataforma NUNCA custodia claves: solo guarda la dirección pública) | [Tecnología]: TypeORM

@Entity({ name: 'wallets' })
@Index(['userId'])
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  // [Única]: una dirección pertenece a un solo usuario (checksum EIP-55)
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 42 })
  address!: string;

  @Column({ type: 'int', name: 'chain_id' })
  chainId!: number;

  @CreateDateColumn({ name: 'linked_at', type: 'timestamptz' })
  linkedAt!: Date;
}
