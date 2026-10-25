// nft.util.ts => Web3: metadata del badge en IPFS + minteo ERC-721 con ethers.js v6.
// IPFS vía su HTTP RPC con axios (el SETUP prescribía ipfs-http-client, pero está deprecado y es solo-ESM:
// no carga en este backend CommonJS; axios ya está instalado y cubre la misma función sin duplicar herramientas).
import axios from "axios";
import { Contract, JsonRpcProvider, Wallet, type Log } from "ethers";
import { appConfig } from "../../../config/app.config";
import { BadGatewayException, ServiceUnavailableException } from "../../../shared/filter/http-exception.filter";

// ABI mínimo (Interface Segregation): solo la función y el evento que se usan del contrato ERC-721
const BADGE_ABI = [
  "function safeMint(address to, string uri) returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)", // RF-14.8 verificar la transferencia
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

// Metadata estándar ERC-721 (la leen OpenSea, MetaMask y los exploradores)
export interface BadgeMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
}

// uploadMetadata => sube el JSON a IPFS y devuelve la URI "ipfs://<CID>" (contenido inmutable direccionado por hash)
export async function uploadMetadata(metadata: BadgeMetadata): Promise<string> {
  if (!appConfig.IPFS_API_URL) throw new ServiceUnavailableException("IPFS no está configurado (IPFS_API_URL)");
  const form = new FormData();
  form.append("file", new Blob([JSON.stringify(metadata)], { type: "application/json" }), "metadata.json");
  try {
    // Kubo RPC: POST /api/v0/add => { Hash: "<CID>" }; "pin=true" evita que el nodo lo elimine en su GC
    const { data } = await axios.post<{ Hash: string }>(`${appConfig.IPFS_API_URL}/api/v0/add?pin=true`, form, { timeout: 20_000 });
    return `ipfs://${data.Hash}`;
  } catch {
    throw new BadGatewayException("No se pudo publicar la metadata en IPFS", "IPFS_UPLOAD_FAILED");
  }
}

// verifyTransfer => RF-14.8 la transferencia la firma el DUEÑO en su wallet (el backend nunca mueve tokens ajenos); aquí
// solo se comprueba en la blockchain que la transacción fue exitosa y que el token ya pertenece a la wallet destino
export async function verifyBadgeTransfer(contractAddress: string, tokenId: string, txHash: string, toAddress: string): Promise<boolean> {
  if (!appConfig.WEB3_RPC_URL) throw new ServiceUnavailableException("Blockchain no configurada (WEB3_RPC_URL)");
  const provider = new JsonRpcProvider(appConfig.WEB3_RPC_URL);
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) return false;
  const owner = String(await new Contract(contractAddress, BADGE_ABI, provider).getFunction("ownerOf")(tokenId));
  return owner.toLowerCase() === toAddress.toLowerCase();
}

// mintBadge => llama safeMint(to, uri) y espera la confirmación; devuelve el tokenId (del evento Transfer) y el hash
// "contractAddress" => otro contrato ERC-721 con safeMint (RF-29.3 pruebas de compra); por defecto el de insignias
export async function mintBadge(to: string, tokenUri: string, contractAddress?: string): Promise<{ tokenId: string; txHash: string; contractAddress: string }> {
  const { WEB3_RPC_URL, WEB3_PRIVATE_KEY } = appConfig;
  const NFT_CONTRACT_ADDRESS = contractAddress ?? appConfig.NFT_CONTRACT_ADDRESS;
  if (!WEB3_RPC_URL || !WEB3_PRIVATE_KEY || !NFT_CONTRACT_ADDRESS) {
    throw new ServiceUnavailableException("Minteo NFT no configurado (WEB3_RPC_URL / WEB3_PRIVATE_KEY / NFT_CONTRACT_ADDRESS)");
  }

  const provider = new JsonRpcProvider(WEB3_RPC_URL); // Nodo RPC (Infura/Alchemy/propio)
  const signer = new Wallet(WEB3_PRIVATE_KEY, provider); // Cuenta minter del backend (nunca se expone al frontend)
  const contract = new Contract(NFT_CONTRACT_ADDRESS, BADGE_ABI, signer);

  try {
    // "getFunction" => acceso tipado a la función del ABI; la llamada envía una transacción firmada
    const tx = await contract.getFunction("safeMint")(to, tokenUri);
    const receipt = await tx.wait(1); // 1 confirmación
    // Busca el evento Transfer en los logs de la transacción para obtener el tokenId asignado
    const transfer = receipt?.logs
      .map((log: Log) => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed: ReturnType<typeof contract.interface.parseLog> | null) => parsed?.name === "Transfer");
    return {
      tokenId: transfer ? String(transfer.args[2]) : "",
      txHash: String(receipt?.hash ?? tx.hash),
      contractAddress: NFT_CONTRACT_ADDRESS,
    };
  } catch (error) {
    if (error instanceof ServiceUnavailableException) throw error;
    throw new BadGatewayException("La transacción de minteo falló en la blockchain", "NFT_MINT_FAILED");
  }
}
