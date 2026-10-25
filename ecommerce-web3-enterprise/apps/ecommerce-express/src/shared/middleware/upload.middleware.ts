// upload.middleware.ts (Express · Multer) => subida de HOJAS DE CÁLCULO para importaciones masivas (RF-04.3).
// En MEMORIA (Buffer): el archivo nunca toca el disco del contenedor. Lista blanca por extensión Y tipo MIME
// (los navegadores reportan .csv con MIME distintos: text/csv, application/vnd.ms-excel...). Patrón: Factory configurada.
import multer from "multer"; // Middleware multipart/form-data
import { BadRequestException } from "../filter/http-exception.filter";

const MAX_SPREADSHEET_BYTES = 5 * 1024 * 1024; // 5 MB (miles de filas de texto; frena archivos abusivos)
const ALLOWED = /\.(xlsx|csv)$/i; // Solo Excel moderno (Office Open XML) o CSV

export const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SPREADSHEET_BYTES, files: 1 },
  // "cb(error)" => rechaza antes de leer el archivo completo; "cb(null, true)" => lo acepta
  fileFilter: (_req, file, cb) => (ALLOWED.test(file.originalname) ? cb(null, true) : cb(new BadRequestException("Solo se aceptan archivos .xlsx o .csv"))),
});
