-- RF-07.6 (recordatorio de carrito), RF-07.3/08.7 (puntos), RF-08.1 (invitado), RF-08.3/08.9 (medios de pago), RF-08.11 (huella de dispositivo),
-- RF-09.3 (preferencias de entrega), RF-09.6 (alerta de retraso), RF-09.7 (canal de origen del pedido)
-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('WEB', 'SOCIAL', 'MARKETING', 'MANUAL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "carts" ADD COLUMN     "remindedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "checkout_sessions" ADD COLUMN     "channel" "OrderChannel" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "channelRef" VARCHAR(120),
ADD COLUMN     "pointsRedeemed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "channel" "OrderChannel" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "channelRef" VARCHAR(120),
ADD COLUMN     "deliveryInstructions" VARCHAR(500),
ADD COLUMN     "pointsRedeemed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "preferredDeliveryDate" DATE;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "details" JSONB;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "delayNotifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "device_fingerprints" (
    "id" TEXT NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" VARCHAR(45),
    "country" CHAR(2),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_fingerprints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_fingerprints_hash_idx" ON "device_fingerprints"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "device_fingerprints_hash_userId_key" ON "device_fingerprints"("hash", "userId");

-- CreateIndex
CREATE INDEX "orders_channel_idx" ON "orders"("channel");

-- AddForeignKey
ALTER TABLE "device_fingerprints" ADD CONSTRAINT "device_fingerprints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

