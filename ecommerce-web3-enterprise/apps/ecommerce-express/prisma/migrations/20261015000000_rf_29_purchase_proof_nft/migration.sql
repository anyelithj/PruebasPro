-- CreateTable
CREATE TABLE "purchase_proof_nfts" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "ownerAddress" TEXT NOT NULL,
    "orderHash" CHAR(64) NOT NULL,
    "metadataUri" TEXT,
    "contractAddress" TEXT,
    "tokenId" TEXT,
    "txHash" TEXT,
    "status" "BadgeStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "mintedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_proof_nfts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_proof_nfts_orderId_key" ON "purchase_proof_nfts"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_proof_nfts_txHash_key" ON "purchase_proof_nfts"("txHash");

-- AddForeignKey
ALTER TABLE "purchase_proof_nfts" ADD CONSTRAINT "purchase_proof_nfts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

