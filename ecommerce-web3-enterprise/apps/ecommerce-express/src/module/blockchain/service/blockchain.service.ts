// blockchain.service.ts (ethers v6 + Prisma + Redis) => integración blockchain EVM (sprint 9.2, reemplazo temporal de Rust/alloy).
// - Lecturas (balances, funciones "view") sin firma, con caché Redis de 10 s: menos llamadas RPC y menos energía.
// - Escrituras (transferencias, ERC-20/ERC-721) firmadas por la cuenta del backend, con Idempotency-Key (UNIQUE en
//   PostgreSQL), nonce administrado en Redis (INCR atómico), reintentos con backoff SOLO para fallos de red y
//   seguimiento del recibo en segundo plano. Un reintento reutiliza el MISMO nonce: nunca se envía dos veces.
// Patrones: Adapter (errores de ethers -> BlockchainError), Strategy (nativa | token | contrato), Factory (providers por
// cadena en chain.config) y Observer (el recibo actualiza el estado cuando llega).
import { Contract, formatUnits, parseUnits, type TransactionResponse, type Wallet } from "ethers";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import { redis } from "../../../config/redis.config";
import { cached } from "../../../shared/interceptor/cache.interceptor";
import { ForbiddenException } from "../../../shared/filter/http-exception.filter";
import { logger } from "../../../shared/middleware/logger.middleware";
import { withRetry } from "../../gateway/strategy/retry_policy.strategy";
import { errorText } from "../../gateway/model/gateway.model";
import { getChain, getProvider, getSigner, type ChainKey } from "../config/chain.config";
import { STANDARD_ABIS, toJsonSafe, toTxDto, type BlockchainTxDto, type BlockchainTxKind } from "../model/blockchain.model";
import type { BalanceQuery, BalanceResponse, ContractCallRequest, ContractReadResponse, TransactionRequest } from "../dto/blockchain.dto";
import { BlockchainError, ethersCode } from "../error/blockchain.error";

const BALANCE_TTL_SECONDS = 10; // Un saldo de hace 10 s es suficiente para la UI; ahorra llamadas RPC
const RECEIPT_TIMEOUT_MS = 10 * 60_000; // Espera máxima del recibo (luego queda PENDING y se consulta en el explorador)
const NONCE_TTL_SECONDS = 3_600;
const FEE_BUMP_PERCENT = 125n; // Reemplazo (cancelación): +25 % de gas (los nodos exigen al menos +10 %)

// Draft => datos de la fila antes de enviar (lo comparten transferencias y llamadas a contratos: DRY)
interface Draft {
  readonly chain: ChainKey;
  readonly kind: BlockchainTxKind;
  readonly toAddress: string;
  readonly method: string | null;
  readonly args: Prisma.InputJsonValue | null;
  readonly valueWei: string;
  readonly idempotencyKey: string;
  readonly createdById: string;
}

export class BlockchainService {
  constructor(private readonly db: PrismaClient = prisma) {}

  // getBalance => GET /balance/:id — saldo nativo o ERC-20 (cache-aside de 10 s)
  public getBalance(address: string, query: BalanceQuery): Promise<BalanceResponse> {
    const key = `rt:bc:balance:${query.chain}:${address}:${query.token ?? "native"}`;
    return cached(key, BALANCE_TTL_SECONDS, () =>
      this.rpc(async () => {
        const provider = getProvider(query.chain);
        if (!query.token) {
          const raw = await provider.getBalance(address);
          return { address, chain: query.chain, token: null, symbol: getChain(query.chain).nativeSymbol, decimals: 18, raw: raw.toString(), formatted: formatUnits(raw, 18) };
        }
        const token = new Contract(query.token, STANDARD_ABIS.erc20, provider);
        // "Promise.all" => las 3 lecturas viajan en paralelo (una sola espera de red)
        const [raw, decimals, symbol] = (await Promise.all([token.getFunction("balanceOf")(address), token.getFunction("decimals")(), token.getFunction("symbol")()])) as [bigint, bigint, string];
        return { address, chain: query.chain, token: query.token, symbol, decimals: Number(decimals), raw: raw.toString(), formatted: formatUnits(raw, decimals) };
      }, "balanceOf")
    );
  }

  // sendTransaction => POST /transaction — moneda nativa o, con "token", transferencia ERC-20
  public async sendTransaction(input: TransactionRequest, actorId: string): Promise<BlockchainTxDto> {
    const signer = getSigner(input.chain);
    const base = { chain: input.chain, idempotencyKey: input.idempotencyKey, createdById: actorId };
    if (!input.token) {
      const value = parseUnits(input.amount, 18); // ether -> wei (BigInt exacto, sin errores de coma flotante)
      return this.submit({ ...base, kind: "TRANSFER", toAddress: input.to, method: null, args: null, valueWei: value.toString() }, signer, (nonce) =>
        signer.sendTransaction({ to: input.to, value, nonce })
      );
    }
    const token = new Contract(input.token, STANDARD_ABIS.erc20, signer);
    const decimals = (await this.rpc(() => token.getFunction("decimals")(), "decimals")) as bigint;
    const amount = parseUnits(input.amount, decimals);
    return this.submit(
      { ...base, kind: "CONTRACT_CALL", toAddress: input.token, method: "transfer", args: [input.to, amount.toString()], valueWei: "0" },
      signer,
      (nonce) => token.getFunction("transfer")(input.to, amount, { nonce }) as Promise<TransactionResponse>
    );
  }

  // callContract => POST /contract/:id/call — "view" sin firma; escrituras solo ADMIN y con Idempotency-Key
  public async callContract(address: string, input: ContractCallRequest, actor: { id: string; canWrite: boolean }): Promise<ContractReadResponse | BlockchainTxDto> {
    const contract = new Contract(address, STANDARD_ABIS[input.standard], getProvider(input.chain));
    const fragment = (() => {
      try {
        return contract.interface.getFunction(input.method); // null si el método no está en el ABI permitido
      } catch {
        return null; // Nombre ambiguo (sobrecargas): tampoco se permite
      }
    })();
    if (!fragment) throw BlockchainError.methodNotAllowed(input.method);

    if (fragment.constant) {
      const result: unknown = await this.rpc(() => contract.getFunction(input.method).staticCall(...input.args), input.method);
      return { method: input.method, result: toJsonSafe(result) };
    }
    if (!actor.canWrite) throw new ForbiddenException("Solo un administrador puede escribir en un contrato");
    if (!input.idempotencyKey) throw BlockchainError.idempotencyRequired();
    const signer = getSigner(input.chain);
    const writable = new Contract(address, STANDARD_ABIS[input.standard], signer);
    return this.submit(
      { chain: input.chain, kind: "CONTRACT_CALL", toAddress: address, method: input.method, args: input.args, valueWei: "0", idempotencyKey: input.idempotencyKey, createdById: actor.id },
      signer,
      (nonce) => writable.getFunction(input.method)(...input.args, { nonce }) as Promise<TransactionResponse>
    );
  }

  // cancelTransaction => DELETE /transaction/:id — reemplaza la tx pendiente por una vacía (mismo nonce, más gas)
  public async cancelTransaction(id: string): Promise<BlockchainTxDto> {
    const row = await this.db.blockchainTx.findUnique({ where: { id } });
    if (!row) throw BlockchainError.notFound(id);
    if (row.status !== "PENDING" || !row.txHash || row.nonce === null) throw BlockchainError.notCancellable(row.status);
    const chain = row.chain as ChainKey;
    const pending = await this.rpc(() => getProvider(chain).getTransaction(row.txHash ?? ""));
    if (!pending || pending.blockNumber !== null) throw BlockchainError.notCancellable("CONFIRMED");

    const nonce = row.nonce; // Copia local: el narrowing "!== null" no se conserva dentro de closures
    const bump = (fee: bigint) => (fee * FEE_BUMP_PERCENT) / 100n; // BigInt: aritmética entera exacta
    const signer = getSigner(chain);
    const fees =
      pending.maxFeePerGas !== null && pending.maxPriorityFeePerGas !== null
        ? { maxFeePerGas: bump(pending.maxFeePerGas), maxPriorityFeePerGas: bump(pending.maxPriorityFeePerGas) } // EIP-1559
        : { gasPrice: bump(pending.gasPrice) }; // Transacción "legacy"
    const replacement = await this.rpc(() => signer.sendTransaction({ to: signer.address, value: 0n, nonce, ...fees }), "cancel");
    const updated = await this.db.blockchainTx.update({ where: { id }, data: { status: "CANCELLED", error: `Reemplazada por ${replacement.hash}` } });
    return toTxDto(updated);
  }

  // submit => pipeline común de escritura: idempotencia -> fila PENDING -> nonce -> envío con reintentos -> recibo
  private async submit(draft: Draft, signer: Wallet, send: (nonce: number) => Promise<TransactionResponse>): Promise<BlockchainTxDto> {
    const existing = await this.db.blockchainTx.findUnique({ where: { idempotencyKey: draft.idempotencyKey } });
    if (existing) return toTxDto(existing); // Repetición de la misma Idempotency-Key: misma transacción, sin reenviar
    const row = await this.db.blockchainTx
      .create({ data: { ...draft, args: draft.args ?? Prisma.JsonNull, fromAddress: signer.address } })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null; // Carrera con la misma clave
        throw error;
      });
    if (!row) return this.submit(draft, signer, send);

    try {
      const nonce = await this.nextNonce(draft.chain, signer.address);
      // Reintentos con el MISMO nonce: si el primer envío sí llegó al nodo, el segundo no duplica la operación
      const response = await this.rpc(() => send(nonce), draft.method ?? "transfer");
      const updated = await this.db.blockchainTx.update({ where: { id: row.id }, data: { txHash: response.hash, nonce } });
      this.track(updated.id, draft.chain, response.hash);
      return toTxDto(updated);
    } catch (error) {
      await this.resetNonce(draft.chain, signer.address); // Un nonce reservado y no usado bloquearía las siguientes tx
      await this.db.blockchainTx.update({ where: { id: row.id }, data: { status: "FAILED", error: errorText(error) } });
      throw error;
    }
  }

  // nextNonce => contador atómico en Redis (INCR) inicializado desde la red; sin Redis se consulta al nodo
  private async nextNonce(chain: ChainKey, address: string): Promise<number> {
    const provider = getProvider(chain);
    if (redis.status !== "ready") return this.rpc(() => provider.getTransactionCount(address, "pending"));
    const key = `rt:bc:nonce:${chain}:${address}`;
    if (!(await redis.exists(key))) {
      const pending = await this.rpc(() => provider.getTransactionCount(address, "pending"));
      await redis.set(key, pending - 1, "EX", NONCE_TTL_SECONDS, "NX"); // "NX" => otro proceso pudo inicializarlo antes
    }
    return redis.incr(key);
  }

  private async resetNonce(chain: ChainKey, address: string): Promise<void> {
    await redis.del(`rt:bc:nonce:${chain}:${address}`).catch(() => undefined);
  }

  // track => Observer del recibo (1 confirmación). "updateMany" con status PENDING => no pisa una cancelación.
  // ponytail: si el proceso se reinicia antes del recibo, la fila queda PENDING; job de reconciliación si hace falta.
  private track(id: string, chain: ChainKey, hash: string): void {
    void getProvider(chain)
      .waitForTransaction(hash, 1, RECEIPT_TIMEOUT_MS)
      .then((receipt) =>
        receipt
          ? this.db.blockchainTx.updateMany({
              where: { id, status: "PENDING" },
              data: { status: receipt.status === 1 ? "CONFIRMED" : "FAILED", blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString() },
            })
          : null
      )
      .catch((error: unknown) => logger.warn("blockchain_receipt_pending", { id, code: ethersCode(error) }));
  }

  // rpc => reintentos con backoff solo ante fallos de red del nodo + traducción de errores (Adapter)
  private async rpc<T>(operation: () => Promise<T>, method?: string): Promise<T> {
    try {
      return (await withRetry(operation, BlockchainError.isTransient)).value;
    } catch (error) {
      throw BlockchainError.fromEthers(error, method);
    }
  }
}

export const blockchainService = new BlockchainService();
