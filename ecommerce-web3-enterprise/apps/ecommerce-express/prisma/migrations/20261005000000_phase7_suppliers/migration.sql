-- 20261005000000_phase7_suppliers => Fase 7 (sprint 7.2): proveedores con datos, contrato y condiciones.
-- Generada con "prisma migrate diff" + restricciones CHECK manuales (Prisma no modela CHECK).
-- (El diff también proponía borrar "products_embedding_idx": es el índice HNSW de pgvector creado a mano en la
--  migración inicial y Prisma no lo conoce; se omite a propósito.)

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "contactName" TEXT,
    "address" TEXT,
    "country" CHAR(2) NOT NULL DEFAULT 'CO',
    "currency" CHAR(3) NOT NULL DEFAULT 'COP',
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "rating" DOUBLE PRECISION,
    "contractUrl" TEXT,
    "contractEndsAt" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_taxId_key" ON "suppliers"("taxId");

-- CreateIndex (listado de activos ordenado por evaluación: ranking de proveedores)
CREATE INDEX "suppliers_isActive_rating_idx" ON "suppliers"("isActive", "rating");

-- La base protege los datos aunque falle la validación de la API
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_rating_check" CHECK ("rating" IS NULL OR ("rating" >= 0 AND "rating" <= 5));
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_terms_check" CHECK ("paymentTermsDays" >= 0 AND "leadTimeDays" >= 0);
