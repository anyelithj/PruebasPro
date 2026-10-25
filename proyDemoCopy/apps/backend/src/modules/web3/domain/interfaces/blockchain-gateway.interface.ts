// [Port BlockchainGatewayPort · Sprint 7.5]: contrato de la cadena que usa el dominio (Sepolia con viem hoy; adaptador falso en las pruebas) | [Patrón]: Port (Hexagonal) + Strategy | [Principio]: DIP (los casos de uso no conocen viem) + OCP (otra red = otro adaptador) | [Paradigma]: POO
// [Montos]: `bigint` en wei (1 ETH = 10^18 wei) → sin pérdida de precisión

export const BLOCKCHAIN_GATEWAY = Symbol('BLOCKCHAIN_GATEWAY');

// [ChainTx]: transacción normalizada (sin tipos del SDK) | `status`: pending (sin bloque) · success · reverted
export interface ChainTx {
  hash: string;
  from: string;
  to: string | null;
  value: bigint;
  chainId: number;
  input: string; // `data` de la transacción (hex) — ahí va el hash anclado del certificado
  blockNumber: bigint | null;
  status: 'pending' | 'success' | 'reverted';
}

export interface SendTxInput {
  to: string;
  value?: bigint;
  data?: `0x${string}`;
}

export interface BlockchainGatewayPort {
  readonly chainId: number;
  readonly enabled: boolean; // Lectura disponible (RPC configurado)
  readonly canSend: boolean; // Hay clave de la plataforma → puede firmar transacciones (anclaje)
  readonly platformAddress: string | null; // Destinatario de los pagos y emisor de los anclajes
  // [sendTransaction]: firma con la clave de la plataforma (solo servidor) y devuelve el hash
  sendTransaction(input: SendTxInput): Promise<string>;
  getTransaction(hash: string): Promise<ChainTx | null>; // null = no existe (aún)
  getConfirmations(hash: string): Promise<number>; // 0 = sin minar
}
