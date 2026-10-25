-- RF-01.1/01.2/01.3 (auth), RF-02.3 (Stripe Customer), RF-03.1 (jerarquía de roles), RF-04.2 (insignias), RF-05.1/05.3 (marcas), RF-05.5 (descuento de look)
-- (Se omite el DROP del índice HNSW products_embedding_idx: es manual (pgvector) y Prisma no lo ve en el esquema)
-- CreateEnum
CREATE TYPE "ProductBadge" AS ENUM ('NEW', 'SALE', 'BEST_SELLER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OAuthProvider" ADD VALUE 'FACEBOOK';
ALTER TYPE "OAuthProvider" ADD VALUE 'APPLE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VerificationPurpose" ADD VALUE 'PHONE_VERIFICATION';
ALTER TYPE "VerificationPurpose" ADD VALUE 'MAGIC_LINK';

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "country" CHAR(2),
ADD COLUMN     "isExclusive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPremium" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "story" TEXT;

-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "lookDiscountPercent" INTEGER;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "badges" "ProductBadge"[] DEFAULT ARRAY[]::"ProductBadge"[];

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
