// index.ts => punto de entrada del módulo High-frequency Analytics (equivale a mod.rs en Rust).
// Patrón Facade/Barrel: exporta handler, service, model, dto, error y util.
export { realtimeAnalyticRouter, registerRealtimeAnalyticGateway } from "./handler/realtime_analytic.handler";
export { realtimeAnalyticService, RealtimeAnalyticService } from "./service/realtime_analytic.service";
export { RealtimeAnalyticEventModel } from "./model/realtime_analytic.model";
export * from "./dto/realtime_analytic.dto";
export { AnalyticError } from "./error/realtime_analytic.error";
export * from "./util/window.util";
