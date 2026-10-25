// [ADAPTER] cliente gRPC → agente blockchain de FastAPI.
// Define el token de inyección, el contrato TS del servicio y sus mensajes.
import { Observable } from 'rxjs';

export const BLOCKCHAIN_PACKAGE = 'BLOCKCHAIN_PACKAGE';

// Espejo de blockchain.proto (BlockchainService).
export interface BlockchainRequest {
  message: string;
  chain: string; // "solana" | "ethereum"
  wallet?: string;
  user_id?: string;
}

export interface BlockchainResponse {
  status: string;
  chain: string;
  tool_used: string;
  agent_response: string;
  tool_result: string; // JSON serializado
  tx_signature: string;
  tx_hash: string;
  network: string;
  explorer_url: string;
  timestamp: string;
}

export interface BlockchainEvent {
  type: string; // "chunk" | "tool_call" | "tool_result" | "done" | "error"
  content: string;
  tool: string;
  result: string;
}

// Contrato del servicio gRPC (los métodos devuelven Observable en el cliente Nest).
export interface BlockchainServiceGrpc {
  Invoke(data: BlockchainRequest): Observable<BlockchainResponse>;
  Stream(data: BlockchainRequest): Observable<BlockchainEvent>;
}
