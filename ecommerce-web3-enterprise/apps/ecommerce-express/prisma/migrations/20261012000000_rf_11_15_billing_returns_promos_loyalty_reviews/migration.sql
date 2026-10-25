-- RF-11 (resoluciones DIAN, anulación, envío por correo), RF-12 (cambio, crédito, logística inversa, inspección),
-- RF-13 (restricciones de cupón, promociones automáticas), RF-14 (Diamante, referidos, cumpleaños, logros, multiplicadores),
-- RF-15 (fotos, aspectos, votos útiles, historial, emociones)
-- CreateEnum
CREATE TYPE "RefundResolution" AS ENUM ('REFUND', 'EXCHANGE', 'STORE_CREDIT');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('PICKUP_SCHEDULED', 'IN_TRANSIT', 'RECEIVED', 'INSPECTED_OK', 'INSPECTED_FAILED');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('BUY_X_PAY_Y', 'PERCENT_OFF', 'TIERED', 'FLASH');

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'VOIDED';

-- AlterEnum
ALTER TYPE "LoyaltyTier" ADD VALUE 'DIAMOND';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "birthDate" DATE,
ADD COLUMN     "referralCode" VARCHAR(16),
ADD COLUMN     "referredById" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "preSaleUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "checkout_sessions" ADD COLUMN     "promotions" JSONB;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "reviewRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "emailedAt" TIMESTAMP(3),
ADD COLUMN     "resolutionId" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "refunds" ADD COLUMN     "exchangeOrderId" TEXT,
ADD COLUMN     "exchangeVariantId" TEXT,
ADD COLUMN     "inspection" JSONB,
ADD COLUMN     "items" JSONB,
ADD COLUMN     "pickupScheduledAt" TIMESTAMP(3),
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "resolution" "RefundResolution" NOT NULL DEFAULT 'REFUND',
ADD COLUMN     "returnCarrier" TEXT,
ADD COLUMN     "returnStatus" "ReturnStatus",
ADD COLUMN     "returnTrackingNumber" TEXT,
ADD COLUMN     "storeCreditCode" TEXT;

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "brandIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "origin" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "segments" "LoyaltyTier"[] DEFAULT ARRAY[]::"LoyaltyTier"[],
ADD COLUMN     "userIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "aspects" JSONB,
ADD COLUMN     "emotions" JSONB,
ADD COLUMN     "helpfulCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sentimentLabel" VARCHAR(10);

-- CreateTable
CREATE TABLE "dian_resolutions" (
    "id" TEXT NOT NULL,
    "resolutionNumber" VARCHAR(30) NOT NULL,
    "prefix" VARCHAR(10) NOT NULL,
    "fromNumber" INTEGER NOT NULL,
    "toNumber" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL,
    "technicalKey" TEXT NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dian_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "PromotionType" NOT NULL,
    "buyQuantity" INTEGER,
    "payQuantity" INTEGER,
    "percent" INTEGER,
    "tiers" JSONB,
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brandIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "collectionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 0,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "campaign" VARCHAR(30),
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_applications" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_helpful_votes" (
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_helpful_votes_pkey" PRIMARY KEY ("reviewId","userId")
);

-- CreateTable
CREATE TABLE "review_revisions" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "userId" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("userId","code")
);

-- CreateTable
CREATE TABLE "points_multipliers" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_multipliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dian_resolutions_resolutionNumber_key" ON "dian_resolutions"("resolutionNumber");

-- CreateIndex
CREATE INDEX "promotions_isActive_startsAt_endsAt_idx" ON "promotions"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "promotion_applications_orderId_idx" ON "promotion_applications"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_applications_promotionId_orderId_key" ON "promotion_applications"("promotionId", "orderId");

-- CreateIndex
CREATE INDEX "review_revisions_reviewId_idx" ON "review_revisions"("reviewId");

-- CreateIndex
CREATE INDEX "points_multipliers_isActive_startsAt_endsAt_idx" ON "points_multipliers"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_returnTrackingNumber_key" ON "refunds"("returnTrackingNumber");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "dian_resolutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_applications" ADD CONSTRAINT "promotion_applications_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_revisions" ADD CONSTRAINT "review_revisions_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

