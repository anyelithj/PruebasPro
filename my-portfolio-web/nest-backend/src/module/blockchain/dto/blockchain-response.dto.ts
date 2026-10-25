// [ISP] respuesta del agente blockchain hacia el cliente — contrato mínimo
export interface BlockchainResponseDto {
  status: string;
  chain: string;
  toolUsed: string;
  agentResponse: string;
  toolResult: unknown;
  txSignature: string | null;
  txHash: string | null;
  network: string;
  explorerUrl: string | null;
  timestamp: string;
}
