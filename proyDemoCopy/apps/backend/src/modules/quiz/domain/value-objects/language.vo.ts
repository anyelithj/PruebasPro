// [Re-export del Shared Kernel]: el VO Language vive en src/shared/domain para que quiz, courses y curriculum usen la misma definición | [Patrón]: Shared Kernel (DDD) + Facade de módulo | [Principio]: DRY + SSOT
// `export * from` (ES Modules): reexporta todos los símbolos, así los imports existentes del módulo quiz siguen funcionando sin cambios
export * from '../../../../shared/domain/language.vo';
