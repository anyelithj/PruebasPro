-- 20261006000000_phase9_express_hpc => Fase 9 en Express (sprints 9.2 y 9.3): transacciones blockchain y proxy de pagos
-- (transacciones + reintentos). Generada con "prisma migrate diff" (solo tablas nuevas; no toca tablas existentes).

-- CreateEnum
CREATE TYPE "BlockchainTxKind" AS ENUM ('TRANSFER', 'CONTRACT_CALL');

-- CreateEnum
CREATE TYPE "BlockchainTxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GatewayTxStatus" AS ENUM ('PROCESSING', 'PENDING', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "blockchain_transactions" (
    "id" TEXT NOT NULL,
    "chain" VARCHAR(20) NOT NULL,
    "kind" "BlockchainTxKind" NOT NULL,
    "fromAddress" VARCHAR(42) NOT NULL,
    "toAddress" VARCHAR(42) NOT NULL,
    "method" VARCHAR(40),
    "args" JSONB,
    "valueWei" TEXT NOT NULL DEFAULT '0',
    "nonce" INTEGER,
    "txHash" VARCHAR(66),
    "status" "BlockchainTxStatus" NOT NULL DEFAULT 'PENDING',
    "blockNumber" INTEGER,
    "gasUsed" TEXT,
    "error" TEXT,
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blockchain_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway_transactions" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(20) NOT NULL DEFAULT 'STRIPE',
    "userId" TEXT NOT NULL,
    "checkoutSessionId" TEXT NOT NULL,
    "paymentId" TEXT,
    "status" "GatewayTxStatus" NOT NULL DEFAULT 'PROCESSING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gateway_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway_retry_attempts" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "GatewayTxStatus" NOT NULL,
    "error" TEXT,
    "durationMs" INTEGER NOT NULL,
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gateway_retry_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_transactions_txHash_key" ON "blockchain_transactions"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_transactions_idempotencyKey_key" ON "blockchain_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "blockchain_transactions_status_createdAt_idx" ON "blockchain_transactions"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "gateway_transactions_idempotencyKey_key" ON "gateway_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "gateway_transactions_userId_createdAt_idx" ON "gateway_transactions"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "gateway_retry_attempts_idempotencyKey_key" ON "gateway_retry_attempts"("idempotencyKey");

-- CreateIndex
CREATE INDEX "gateway_retry_attempts_transactionId_idx" ON "gateway_retry_attempts"("transactionId");

-- AddForeignKey
ALTER TABLE "gateway_retry_attempts" ADD CONSTRAINT "gateway_retry_attempts_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "gateway_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

