// [Errores de capa Frontend]: forma uniforme para UI | [Patrón]: Error Hierarchy | [Principio]: SRP | [Paradigma]: POO

// [Forma envelope backend]: replica HttpExceptionFilter NestJS
export interface BackendErrorBody {
  statusCode: number;
  message: string | string[];
  timestamp: string;
  path: string;
  method?: string;
}

// [Error base]: marcable como instanceof | [Patrón]: Custom Error
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// [Helper]: convierte unknown → string user-friendly | [Principio]: DRY
export function extractMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return Array.isArray(error.message)
      ? error.message.join(", ")
      : error.message;
  }
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}
