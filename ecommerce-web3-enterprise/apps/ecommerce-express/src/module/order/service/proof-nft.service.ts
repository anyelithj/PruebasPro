// proof-nft.service.ts => RF-29.3 NFT de prueba de compra (ERC-721): al ENTREGARSE un pedido de un cliente con wallet
// conectada se mintea un certificado on-chain; también se puede pedir a mano (reintento) desde la cuenta.
// Privacidad: la metadata pública no incluye nombre, dirección ni montos; sí número de pedido, fecha, productos y un
// hash SHA-256 del pedido que cualquiera puede recalcular con el comprobante (verificación sin exponer datos).
// Patrones: Observer (order.status-changed) + Idempotencia (orderId único: un certificado por pedido) + Reuse (DRY:
// mismo minteo e IPFS que las insignias de fidelidad). Paradigma: POO + funcional (orderHash es pura).
import { createHash } from "node:crypto";
import { prisma } from "../../../config/database.config";
import { appConfig } from "../../../config/app.config";
import { commerceEvents } from "../event/order.event";
import { mintBadge, uploadMetadata } from "../../loyalty/util/nft.util";
import { NotFoundException, UnprocessableException } from "../../../shared/filter/http-exception.filter";
import { logger } from "../../../shared/middleware/logger.middleware";

const PROOF_IMAGE = "https://res.cloudinary.com/demo/image/upload/badges/proof-of-purchase.png";

// orderHash => huella del pedido (número, fecha, líneas y total): mismo pedido => mismo hash (función PURA)
export function orderHash(order: { orderNumber: string; placedAt: Date; totalCents: number; items: Array<{ sku: string; quantity: number; unitPriceCents: number }> }): string {
  const canonical = [order.orderNumber, order.placedAt.toISOString(), order.totalCents, ...order.items.map((i) => `${i.sku}x${i.quantity}@${i.unitPriceCents}`).sort()].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

export class ProofNftService {
  public registerSubscribers(): void {
    commerceEvents.on("order.status-changed", async (event) => {
      if (event.to !== "DELIVERED") return;
      const user = await prisma.user.findUnique({ where: { id: event.userId }, select: { walletAddress: true } });
      if (!user?.walletAddress) return; // Sin wallet no hay a quién entregar el NFT (se puede pedir luego)
      await this.mint(event.orderId, event.userId).catch((error: unknown) => logger.warn("proof_nft_failed", { orderId: event.orderId, error: String(error) }));
    });
  }

  public async get(orderId: string, userId: string) {
    const order = await prisma.order.findFirst({ where: { id: orderId, userId }, select: { id: true, proofNft: true } });
    if (!order) throw new NotFoundException("Order", orderId);
    return order.proofNft;
  }

  // mint => crea (o reintenta) el certificado: requiere pedido ENTREGADO, del usuario y con wallet conectada
  public async mint(orderId: string, userId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, orderNumber: true, status: true, placedAt: true, totalCents: true, proofNft: true, user: { select: { walletAddress: true } }, items: { select: { sku: true, quantity: true, unitPriceCents: true, productName: true } } },
    });
    if (!order) throw new NotFoundException("Order", orderId);
    if (order.status !== "DELIVERED") throw new UnprocessableException("El certificado se emite cuando el pedido se entrega", "ORDER_NOT_DELIVERED");
    if (!order.user.walletAddress) throw new UnprocessableException("Conecta una wallet para recibir el NFT", "WALLET_REQUIRED");
    if (order.proofNft?.status === "MINTED") return order.proofNft;

    const hash = orderHash(order);
    const record = await prisma.purchaseProofNft.upsert({
      where: { orderId },
      update: { status: "PENDING", failureReason: null, ownerAddress: order.user.walletAddress, orderHash: hash },
      create: { orderId, ownerAddress: order.user.walletAddress, orderHash: hash },
    });
    try {
      const metadataUri = await uploadMetadata({
        name: `Prueba de compra ${order.orderNumber}`,
        description: "Certificado de compra entregada emitido por la tienda. El hash permite verificar el comprobante sin exponer datos personales.",
        image: PROOF_IMAGE,
        attributes: [
          { trait_type: "Pedido", value: order.orderNumber },
          { trait_type: "Fecha", value: order.placedAt.toISOString().slice(0, 10) },
          { trait_type: "Productos", value: order.items.length },
          { trait_type: "Hash SHA-256", value: hash },
        ],
      });
      // POP_NFT_CONTRACT_ADDRESS => contrato propio de certificados; sin él se usa el de insignias (mismo ERC-721)
      const minted = await mintBadge(order.user.walletAddress, metadataUri, appConfig.POP_NFT_CONTRACT_ADDRESS);
      return prisma.purchaseProofNft.update({ where: { id: record.id }, data: { status: "MINTED", metadataUri, contractAddress: minted.contractAddress, tokenId: minted.tokenId, txHash: minted.txHash, mintedAt: new Date() } });
    } catch (error) {
      await prisma.purchaseProofNft.update({ where: { id: record.id }, data: { status: "FAILED", failureReason: (error instanceof Error ? error.message : String(error)).slice(0, 300) } });
      throw error;
    }
  }

  // verify => público: ¿este hash corresponde a un certificado minteado? (verificación de terceros, p. ej. reventa)
  public async verify(hash: string) {
    const proof = await prisma.purchaseProofNft.findFirst({ where: { orderHash: hash, status: "MINTED" }, select: { contractAddress: true, tokenId: true, txHash: true, mintedAt: true, order: { select: { orderNumber: true } } } });
    return proof ? { valid: true, orderNumber: proof.order.orderNumber, contractAddress: proof.contractAddress, tokenId: proof.tokenId, txHash: proof.txHash, mintedAt: proof.mintedAt } : { valid: false };
  }
}

export const proofNftService = new ProofNftService();
