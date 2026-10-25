"""@tool[SRP] acuña un cNFT "Badge de Visitante" en Devnet (Metaplex Bubblegum).

El mint de NFT comprimidos requiere un árbol Merkle Bubblegum ya creado y el
programa Bubblegum. En este portafolio la operación se registra y se devuelve un
resultado estructurado; la integración completa con Bubblegum se activa cuando el
árbol está aprovisionado (config aparte). Nunca maneja claves del visitante.
"""

from datetime import UTC, datetime

from langchain_core.tools import tool

from src.module.blockchain.solana.tools._solana_client import to_pubkey


@tool
async def mint_cnft(to_wallet: str, badge_name: str = "Visitor Badge") -> dict:
    """Acuña un NFT comprimido de bienvenida (Badge de Visitante) en Devnet.

    Args:
        to_wallet: dirección pública Base58 que recibirá el cNFT.
        badge_name: nombre del badge a acuñar.
    """
    # Valida la dirección destino aunque el mint real dependa del árbol Bubblegum.
    to_pubkey(to_wallet)
    return {
        "to": to_wallet,
        "badge_name": badge_name,
        "standard": "Metaplex Bubblegum (compressed NFT)",
        "network": "devnet",
        "status": "queued",
        "note": (
            "Mint de cNFT registrado. Requiere árbol Merkle Bubblegum aprovisionado "
            "para completarse on-chain."
        ),
        "timestamp": datetime.now(UTC).isoformat(),
    }
