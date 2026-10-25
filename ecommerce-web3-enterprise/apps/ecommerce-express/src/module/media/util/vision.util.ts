// vision.util.ts (Axios + FormData nativo) => RF-06.6 cliente del motor de visión (FastAPI POST /inspect): calidad de
// la foto (resolución, nitidez, luz, contraste) y moderación de contenido ANTES de publicar una imagen de producto.
// Patrón Adapter (respuesta de FastAPI -> tipo propio) + degradación elegante: si el motor no responde, se devuelve
// null y la subida continúa (la IA ayuda, pero no bloquea el catálogo cuando está apagada).
import axios from "axios";
import { appConfig } from "../../../config/app.config";
import { signServiceToken } from "../../auth/util/token.util";
import { logger } from "../../../shared/middleware/logger.middleware";

export interface ImageInspection {
  quality: { score: number; width: number; height: number; issues: string[] }; // issues: low_resolution | blurry | ...
  moderation: { flagged: boolean; category: string | null };
}

const INSPECT_TIMEOUT_MS = 15_000; // Primera llamada carga CLIP (lento); luego responde en milisegundos

// inspectImage => null si el motor está caído o tarda demasiado (se registra para observabilidad)
export async function inspectImage(buffer: Buffer): Promise<ImageInspection | null> {
  try {
    const form = new FormData();
    form.append("file", new Blob([buffer]), "image"); // Blob nativo (Node 18+): sin dependencias extra
    const { data } = await axios.post<{ data: ImageInspection }>(`${appConfig.FASTAPI_URL}/api/v1/ml/image-recognition/inspect`, form, {
      timeout: INSPECT_TIMEOUT_MS,
      headers: { Authorization: `Bearer ${signServiceToken()}` }, // Rol SERVICE (guard RBAC de FastAPI)
    });
    return data.data;
  } catch (error) {
    logger.warn("image_inspection_unavailable", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
