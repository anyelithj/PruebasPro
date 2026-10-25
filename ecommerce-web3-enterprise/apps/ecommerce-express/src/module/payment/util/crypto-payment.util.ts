// crypto-payment.util.ts (ethers v6 + Axios) => RF-08.3 / RF-08.9 pagos con criptomonedas:
//  1. Conversión automática a moneda local: tasa en vivo de CoinGecko (API pública gratuita, cache 60 s) =>
//     monto exacto en BTC / ETH / USDT / USDC para el total del pedido en COP.
//  2. Sincronización con la blockchain: verificación ON-CHAIN de la transacción que envía el comprador
//     (destino = billetera de la tienda, monto >= cotizado, confirmada). EVM con ethers; Bitcoin con la API de Esplora.
// Patrones: Strategy (verificación por tipo de activo: nativo EVM, token ERC-20, Bitcoin) + Adapter (APIs externas ->
// resultado propio). Funciones puras para la cotización (testeables sin red).
import axios from "axios";
import { Interface, parseUnits } from "ethers";
import { getProvider, type ChainKey } from "../../blockchain/config/chain.config";
import { RedisKeys } from "../../../config/redis.config";
import { cached } from "../../../shared/interceptor/cache.interceptor";
import { ServiceUnavailableException, UnprocessableException } from "../../../shared/filter/http-exception.filter";

export const CRYPTO_ASSETS = ["BTC", "ETH", "USDT", "USDC"] as const;
export type CryptoAsset = (typeof CRYPTO_ASSETS)[number];
export type CryptoNetwork = "bitcoin" | "ethereum" | "polygon";

// Contratos oficiales de las stablecoins (6 decimales en ambas redes)
const TOKENS: Record<"USDT" | "USDC", Partial<Record<CryptoNetwork, string>>> = {
  USDT: { ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7", polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
  USDC: { ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
};
const DECIMALS: Record<CryptoAsset, number> = { BTC: 8, ETH: 18, USDT: 6, USDC: 6 };
const COINGECKO_IDS: Record<CryptoAsset, string> = { BTC: "bitcoin", ETH: "ethereum", USDT: "tether", USDC: "usd-coin" };
// Redes válidas por activo (ETH nativo solo en Ethereum; BTC solo en Bitcoin)
const NETWORKS: Record<CryptoAsset, CryptoNetwork[]> = { BTC: ["bitcoin"], ETH: ["ethereum"], USDT: ["ethereum", "polygon"], USDC: ["ethereum", "polygon"] };
const DISPLAY_DECIMALS: Record<CryptoAsset, number> = { BTC: 8, ETH: 8, USDT: 2, USDC: 2 }; // Precisión del monto a pagar
const ERC20 = new Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);

export function assertNetwork(asset: CryptoAsset, network: string): asserts network is CryptoNetwork {
  if (!NETWORKS[asset].includes(network as CryptoNetwork)) throw new UnprocessableException(`${asset} no se acepta en la red ${network}`, "CRYPTO_NETWORK_UNSUPPORTED", { allowed: NETWORKS[asset] });
}

// fiatRate => precio de 1 unidad del activo en la moneda local (ej. 1 USDT = 4.100 COP), cache 60 s
export async function fiatRate(asset: CryptoAsset, currency: string): Promise<number> {
  const vs = currency.toLowerCase();
  const prices = await cached(RedisKeys.report("crypto-rates", vs), 60, async () => {
    try {
      const { data } = await axios.get<Record<string, Record<string, number>>>("https://api.coingecko.com/api/v3/simple/price", {
        params: { ids: Object.values(COINGECKO_IDS).join(","), vs_currencies: vs },
        timeout: 5_000,
      });
      return data;
    } catch {
      throw new ServiceUnavailableException("No pudimos obtener la tasa de cambio de criptomonedas");
    }
  });
  const rate = prices[COINGECKO_IDS[asset]]?.[vs];
  if (!rate) throw new ServiceUnavailableException(`Sin tasa de cambio ${asset}/${currency}`);
  return rate;
}

// cryptoAmount => monto a pagar (texto decimal) para "fiatCents" a la tasa dada; redondeo HACIA ARRIBA para que el
// comercio nunca reciba menos de lo cotizado. Función pura
export function cryptoAmount(asset: CryptoAsset, fiatCents: number, rate: number): string {
  const scale = 10 ** DISPLAY_DECIMALS[asset];
  return (Math.ceil(((fiatCents / 100) / rate) * scale) / scale).toFixed(DISPLAY_DECIMALS[asset]);
}

// verifyTransfer => true si la transacción "txHash" envió al menos "amount" del activo a "toAddress" y está confirmada
export async function verifyTransfer(asset: CryptoAsset, network: CryptoNetwork, txHash: string, toAddress: string, amount: string): Promise<boolean> {
  const minUnits = parseUnits(amount, DECIMALS[asset]);
  if (network === "bitcoin") return verifyBitcoin(txHash, toAddress, minUnits);
  const provider = getProvider(network as ChainKey);
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) return false; // Inexistente, pendiente o revertida
  if (asset === "ETH") {
    const tx = await provider.getTransaction(txHash);
    return Boolean(tx && tx.to?.toLowerCase() === toAddress.toLowerCase() && tx.value >= minUnits);
  }
  const token = asset === "BTC" ? undefined : TOKENS[asset][network]?.toLowerCase(); // BTC ya salió por verifyBitcoin
  // Suma de los eventos Transfer del contrato oficial hacia la billetera de la tienda
  const received = receipt.logs
    .filter((log) => log.address.toLowerCase() === token)
    .map((log) => ERC20.parseLog(log))
    .filter((parsed) => parsed?.name === "Transfer" && String(parsed.args[1]).toLowerCase() === toAddress.toLowerCase())
    .reduce((sum, parsed) => sum + BigInt(parsed?.args[2] ?? 0), 0n);
  return received >= minUnits;
}

// verifyBitcoin => Esplora (blockstream.info, pública): salida hacia la dirección con valor >= cotizado y confirmada
async function verifyBitcoin(txid: string, toAddress: string, minSats: bigint): Promise<boolean> {
  try {
    const { data } = await axios.get<{ status: { confirmed: boolean }; vout: Array<{ scriptpubkey_address?: string; value: number }> }>(`https://blockstream.info/api/tx/${txid}`, { timeout: 8_000 });
    const sats = data.vout.filter((out) => out.scriptpubkey_address === toAddress).reduce((sum, out) => sum + BigInt(out.value), 0n);
    return data.status.confirmed && sats >= minSats;
  } catch {
    return false;
  }
}
