import QRCode from 'qrcode'; // [qrcode 1.5 · Sprint 7.8]: librería de la matriz para el QR de verificación (PDF + pantalla)
import {
  CEFR_LEVEL_COLOR,
  isCefrLevel,
  NEUTRAL_LEVEL_COLOR,
} from '../../../../shared/domain/cefr-level.vo';
// [certificateQrSvg]: QR vectorial (SVG) de la URL pública de verificación, pintado con el color profundo del nivel MCER | [Patrón]: Adapter (qrcode → SVG) | [Principio]: DRY (el PDF y GET /certificates/verify/:code/qr usan el mismo) | [Paradigma]: Funcional
// [Legibilidad]: color oscuro sobre blanco + nivel de corrección «M» (≈15 %) → los lectores del móvil lo leen aunque el PDF se imprima

export const levelDeepColor = (level: string | null): string =>
  (level && isCefrLevel(level) ? CEFR_LEVEL_COLOR[level] : NEUTRAL_LEVEL_COLOR)
    .deep;

export const certificateQrSvg = (
  url: string,
  level: string | null,
): Promise<string> =>
  QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: levelDeepColor(level), light: '#ffffff' },
  });
