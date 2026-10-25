import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · Sprint 7.6]: tablas wallets (billeteras SIWE) y crypto_payments (pagos con ETH de prueba en Sepolia) | [Patrón]: Migration (up/down reversible)
// [Integridad]: address única (una billetera, un usuario) y tx_hash único (una transacción paga un solo pago)

export class Web31791990700000 implements MigrationInterface {
    name = 'Web31791990700000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "wallets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "address" character varying(42) NOT NULL, "chain_id" integer NOT NULL, "linked_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_wallets" PRIMARY KEY ("id"), CONSTRAINT "UQ_wallets_address" UNIQUE ("address"))`);
        await queryRunner.query(`CREATE INDEX "ix_wallets_user" ON "wallets" ("user_id")`);
        await queryRunner.query(`CREATE TABLE "crypto_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL, "user_id" uuid NOT NULL, "wallet_address" character varying(42) NOT NULL, "to_address" character varying(42) NOT NULL, "chain_id" integer NOT NULL, "amount_wei" character varying(78) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', "tx_hash" character varying(66), "confirmations" integer NOT NULL DEFAULT 0, "error" text, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "paid_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_crypto_payments" PRIMARY KEY ("id"), CONSTRAINT "UQ_crypto_payments_tx" UNIQUE ("tx_hash"))`);
        await queryRunner.query(`CREATE INDEX "ix_crypto_payments_user_created" ON "crypto_payments" ("user_id", "created_at")`);
        await queryRunner.query(`CREATE INDEX "ix_crypto_payments_order" ON "crypto_payments" ("order_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "crypto_payments"`);
        await queryRunner.query(`DROP TABLE "wallets"`);
    }

}
