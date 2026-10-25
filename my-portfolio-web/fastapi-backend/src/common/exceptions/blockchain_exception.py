"""[LSP][SRP] errores del dominio blockchain — sustituibles por AppException."""

from src.common.exceptions.app_exception import AppException


class BlockchainException(AppException):
    """Base de errores blockchain — fallos de RPC, transacciones, validación."""

    status_code = 502
    error_code = "BLOCKCHAIN_ERROR"


class RpcException(BlockchainException):
    """El nodo RPC (Solana/Ethereum) devolvió error o no respondió."""

    status_code = 502
    error_code = "RPC_ERROR"


class TransactionException(BlockchainException):
    """La transacción on-chain falló al construirse, firmarse o confirmarse."""

    status_code = 422
    error_code = "TX_FAILED"


class ChainDisabledException(BlockchainException):
    """La cadena solicitada está deshabilitada por configuración."""

    status_code = 503
    error_code = "CHAIN_DISABLED"


class InvalidAddressException(BlockchainException):
    """Dirección de wallet inválida para la cadena indicada."""

    status_code = 422
    error_code = "INVALID_ADDRESS"
