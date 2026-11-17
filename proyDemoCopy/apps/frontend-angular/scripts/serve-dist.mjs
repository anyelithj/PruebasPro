// [serve-dist · 2026-11-06 · Navegación lenta]: sirve el build de producción de Angular (ng build) en :9100 bajo /ng/ — sin `ng serve` (que compila en caliente)
// Next.js reescribe /ng/* y las pantallas Angular hacia aquí (igual que con `ng serve`) | archivo existente → se sirve con caché larga (nombres con hash) · resto → index.html (router de Angular)
// Solo stdlib de Node (http, fs, path) → sin dependencias nuevas
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../dist/frontend-angular/browser/', import.meta.url));
const PORT = Number(process.env.PORT ?? 9100);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error(`No hay build en ${ROOT}. Ejecuta antes: pnpm build`);
  process.exit(1);
}

createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/ng(\/|$)/, '/');
  const file = normalize(join(ROOT, path));
  const inside = file.startsWith(ROOT); // Sin «../» fuera de la carpeta del build
  const found = inside && existsSync(file) && statSync(file).isFile();
  const target = found ? file : join(ROOT, 'index.html');
  res.writeHead(200, {
    'Content-Type': TYPES[extname(target)] ?? 'application/octet-stream',
    // [Fix 2026-11-16 · «no se aplica nada»]: `outputHashing: none` → main.js y styles.css se llaman IGUAL en cada build; con `immutable` el navegador
    // seguía usando el main.js viejo durante un año. Solo los chunk-<hash>.js (nombre nuevo si cambia el contenido) son inmutables; lo demás se revalida
    'Cache-Control': found && /^chunk-[A-Za-z0-9_-]{8}\.js$/.test(basename(target)) ?'public, max-age=31536000, immutable' : 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });
  // [2026-11-16 · versión en la URL]: index.html pide main.js/styles.css/polyfills.js con `?v=<fecha del build>` → un build nuevo = URL nueva,
  // así el navegador no reutiliza la copia vieja que el servidor anterior marcó como `immutable` (la ruta del archivo ignora el `?v=`)
  if (basename(target) === 'index.html') {
    const v = statSync(target).mtimeMs.toFixed(0);
    return res.end(readFileSync(target, 'utf8').replace(/\b(main\.js|styles\.css|polyfills\.js)"/g, `$1?v=${v}"`));
  }
  createReadStream(target).pipe(res);
}).listen(PORT, '::', () => console.log(`Angular (build) en http://localhost:${PORT}/ng/`));
