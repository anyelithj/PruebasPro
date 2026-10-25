// image.util.ts => middleware Multer (memoria) para recibir imágenes con validación de tipo y tamaño.
// La subida a Cloudinary vive en media.repository.ts; aquí solo se controla lo que ENTRA por HTTP.
import multer from "multer"; // Middleware multipart/form-data (subida de archivos)
import { InvalidImageTypeException } from "../exception/media.exception";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB por imagen
// Lista blanca de MIME types: se rechaza cualquier otra cosa (SVG excluido: puede contener scripts)
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

// RF-26.7 videos: MP4/WebM/MOV hasta 100 MB (Cloudinary los transcodifica a MP4/WebM 720p)
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime"]);
export const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 3 },
  fileFilter: (_req, file, cb) => (VIDEO_MIME.has(file.mimetype) ? cb(null, true) : cb(new InvalidImageTypeException())),
});

// imageUpload => instancia de Multer que guarda el archivo en MEMORIA (Buffer): nunca toca el disco del contenedor
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 10 },
  // "fileFilter" => callback de Multer; "cb(error)" rechaza el archivo antes de leerlo completo
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new InvalidImageTypeException());
    cb(null, true);
  },
});
