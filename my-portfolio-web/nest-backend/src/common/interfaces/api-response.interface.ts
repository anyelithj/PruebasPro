// [DRY][ISP] shape estándar de respuesta API
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message?: string;
}
