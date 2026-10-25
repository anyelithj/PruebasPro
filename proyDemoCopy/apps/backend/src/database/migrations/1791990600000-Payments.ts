import { MigrationInterface, QueryRunner } from "typeorm";
// [Migración · Sprint 7.3]: tablas orders, payments y refunds (pagos con Stripe en modo prueba) | [Patrón]: Migration (up/down reversible)
// [Integridad]: session_id e idempotency_key únicos → un webhook repetido o un doble clic nunca duplican el cobro

export class Payments1791990600000 implements MigrationInterface {
    name = 'Payments1791990600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', "items" jsonb NOT NULL, "total_minor" integer NOT NULL, "currency" character varying(3) NOT NULL, "paid_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_orders" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_orders_user_created" ON "orders" ("user_id", "created_at")`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL, "order_id" uuid NOT NULL, "user_id" uuid NOT NULL, "provider" character varying(16) NOT NULL, "status" character varying(24) NOT NULL DEFAULT 'pending', "session_id" character varying(255) NOT NULL, "payment_intent_id" character varying(255), "idempotency_key" character varying(120) NOT NULL, "amount_minor" integer NOT NULL, "refunded_minor" integer NOT NULL DEFAULT 0, "currency" character varying(3) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_payments" PRIMARY KEY ("id"), CONSTRAINT "UQ_payments_session" UNIQUE ("session_id"), CONSTRAINT "UQ_payments_idempotency" UNIQUE ("idempotency_key"))`);
        await queryRunner.query(`CREATE INDEX "ix_payments_user_created" ON "payments" ("user_id", "created_at")`);
        await queryRunner.query(`CREATE INDEX "ix_payments_order" ON "payments" ("order_id")`);
        await queryRunner.query(`CREATE TABLE "refunds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "payment_id" uuid NOT NULL, "amount_minor" integer NOT NULL, "currency" character varying(3) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', "provider_refund_id" character varying(255), "reason" text, "created_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_refunds" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ix_refunds_payment" ON "refunds" ("payment_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "refunds"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TABLE "orders"`);
    }

}
