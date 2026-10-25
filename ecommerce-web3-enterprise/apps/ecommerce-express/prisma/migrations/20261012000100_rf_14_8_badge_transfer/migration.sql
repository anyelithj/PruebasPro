-- RF-14.8 transferencia de insignias NFT entre wallets
-- AlterTable
ALTER TABLE "nft_badges" ADD COLUMN     "ownerAddress" TEXT,
ADD COLUMN     "transferTxHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "nft_badges_transferTxHash_key" ON "nft_badges"("transferTxHash");

