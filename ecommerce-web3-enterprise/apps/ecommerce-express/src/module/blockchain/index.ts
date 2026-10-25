// index.ts => punto de entrada del módulo Blockchain Integration (equivale a mod.rs en Rust).
// Patrón Facade/Barrel: exporta handler, service, model, dto, error y config.
export { blockchainRouter } from "./handler/blockchain.handler";
export { blockchainService, BlockchainService } from "./service/blockchain.service";
export * from "./model/blockchain.model";
export * from "./dto/blockchain.dto";
export { BlockchainError } from "./error/blockchain.error";
export * from "./config/chain.config";
