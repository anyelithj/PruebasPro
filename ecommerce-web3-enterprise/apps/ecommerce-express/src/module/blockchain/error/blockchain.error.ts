// blockchain.error.ts (TypeScript + ethers v6) => errores de dominio Web3: RpcError, InsufficientGas, NonceConflict...
// Patrón Adapter: "fromEthers" traduce los códigos de error de ethers (INSUFFICIENT_FUNDS, NONCE_EXPIRED...) a errores
// HTTP propios; el cliente nunca ve mensajes crudos del nodo RPC.
import { DomainException } from "../../../shared/filter/http-exception.filter";

// Códigos de ethers que indican un fallo TRANSITORIO de red (se pueden reintentar con backoff)
const TRANSIENT_CODES = new Set(["NETWORK_ERROR", "SERVER_ERROR", "TIMEOUT"]);

// ethersCode => lee "error.code" de forma segura (tipado: el error llega como "unknown")
export const ethersCode = (error: unknown): string => (typeof error === "object" && error !== null && "code" in error ? String(error.code) : "");

export class BlockchainError extends DomainException {
  public static rpcError(): BlockchainError {
    return new BlockchainError(502, "BLOCKCHAIN_RPC_ERROR", "El nodo RPC no respondió correctamente");
  }

  public static insufficientGas(): BlockchainError {
    return new BlockchainError(422, "BLOCKCHAIN_INSUFFICIENT_GAS", "La cuenta del backend no tiene fondos suficientes para el gas");
  }

  public static nonceConflict(): BlockchainError {
    return new BlockchainError(409, "BLOCKCHAIN_NONCE_CONFLICT", "Conflicto de nonce: la transacción ya fue reemplazada o confirmada");
  }

  public static reverted(): BlockchainError {
    return new BlockchainError(422, "BLOCKCHAIN_CALL_REVERTED", "El contrato rechazó la llamada (revert)");
  }

  public static invalidArgs(method: string): BlockchainError {
    return new BlockchainError(400, "BLOCKCHAIN_INVALID_ARGS", `Argumentos inválidos para ${method}`);
  }

  public static methodNotAllowed(method: string): BlockchainError {
    return new BlockchainError(400, "BLOCKCHAIN_METHOD_NOT_ALLOWED", `Método no permitido: ${method}`);
  }

  public static notFound(id: string): BlockchainError {
    return new BlockchainError(404, "BLOCKCHAIN_TX_NOT_FOUND", `Transacción ${id} no encontrada`);
  }

  public static notCancellable(status: string): BlockchainError {
    return new BlockchainError(409, "BLOCKCHAIN_TX_NOT_CANCELLABLE", `Solo se cancela una transacción pendiente en la mempool (estado: ${status})`);
  }

  public static idempotencyRequired(): BlockchainError {
    return new BlockchainError(400, "IDEMPOTENCY_KEY_REQUIRED", "Las escrituras en cadena exigen el header Idempotency-Key");
  }

  // isTransient => ¿vale la pena reintentar? (red/servidor RPC, no errores de negocio)
  public static isTransient(error: unknown): boolean {
    return TRANSIENT_CODES.has(ethersCode(error));
  }

  // fromEthers => Adapter: error de ethers -> BlockchainError (los que ya son de dominio pasan tal cual)
  public static fromEthers(error: unknown, method = "call"): Error {
    if (error instanceof DomainException) return error;
    switch (ethersCode(error)) {
      case "INSUFFICIENT_FUNDS":
        return BlockchainError.insufficientGas();
      case "NONCE_EXPIRED":
      case "REPLACEMENT_UNDERPRICED":
        return BlockchainError.nonceConflict();
      case "CALL_EXCEPTION":
        return BlockchainError.reverted();
      case "INVALID_ARGUMENT":
      case "BAD_DATA":
        return BlockchainError.invalidArgs(method);
      default:
        return BlockchainError.rpcError();
    }
  }
}
