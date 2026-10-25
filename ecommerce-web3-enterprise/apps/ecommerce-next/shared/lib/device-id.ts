// device-id.ts (Web Crypto API + localStorage) => RF-08.11 huella del dispositivo para la detección de fraude
// (multicuenta, IP nueva). Se calcula UNA vez por navegador con rasgos estables (zona horaria, idiomas, pantalla, núcleos,
// plataforma y un dibujo en canvas) y se envía como SHA-256: el servidor nunca recibe los rasgos crudos.
// Espejo exacto en Nuxt (shared/lib/device-id.ts): mismo algoritmo => mismo hash en las dos aplicaciones.
// Patrón Singleton (una promesa por pestaña) + degradación: sin crypto.subtle (HTTP no seguro) devuelve null.
const STORAGE_KEY = "device-id";
let cachedId: Promise<string | null> | null = null;

// canvasTrait => el mismo texto se rasteriza distinto según GPU, fuentes y antialiasing del equipo
function canvasTrait(): string {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.textBaseline = "top";
  context.font = "16px Arial";
  context.fillStyle = "#f60";
  context.fillRect(10, 1, 62, 20);
  context.fillStyle = "#069";
  context.fillText("eCommerce Web3 ✓", 2, 15);
  return canvas.toDataURL();
}

async function compute(): Promise<string | null> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    /* almacenamiento bloqueado: se calcula en cada carga */
  }
  if (!globalThis.crypto?.subtle) return null;
  const traits = [Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.languages.join(","), `${screen.width}x${screen.height}x${screen.colorDepth}`, navigator.hardwareConcurrency, navigator.platform, canvasTrait()].join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(traits));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  try {
    localStorage.setItem(STORAGE_KEY, hash);
  } catch {
    /* sin persistencia: no pasa nada */
  }
  return hash;
}

// deviceId => hash hexadecimal de 64 caracteres (null en el servidor o si el navegador no lo permite)
export function deviceId(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return (cachedId ??= compute());
}
