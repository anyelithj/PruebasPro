// index.ts => punto de entrada del módulo Payment Gateway Proxy (equivale a mod.rs en Rust).
// Patrón Facade/Barrel: exporta handler, service, model, dto, error, guard y strategy.
export { gatewayRouter } from "./handler/gateway.handler";
export { gatewayService, GatewayService, isTransient, stripeBreaker } from "./service/gateway.service";
export * from "./model/gateway.model";
export * from "./dto/gateway.dto";
export { GatewayError } from "./error/gateway.error";
export { CircuitBreaker, type CircuitState } from "./guard/circuit_breaker.guard";
export * from "./strategy/retry_policy.strategy";
