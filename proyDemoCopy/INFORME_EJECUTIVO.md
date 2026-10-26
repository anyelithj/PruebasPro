# Informe ejecutivo — Plataforma de idiomas (proyDemoCopy)

**Fechas:** 24–25 de octubre de 2026 (3 rondas)
**Alcance:** backend NestJS · frontend Next 16 · frontend Angular · ai-service (FastAPI + Ollama)

## Resumen

- Se atendieron **3 rondas (23 incidencias + 1 funcionalidad nueva: Lectura)**. Todas quedaron resueltas en el código.
- Compila sin errores en las 3 aplicaciones. Pasan todas las pruebas de Angular y Next.
- En backend fallan 8 pruebas de 2 suites (certificados y facturas PDF) que ya fallaban antes de esta entrega. En ai-service falla 1 prueba por la versión de espeak-ng de la máquina de pruebas.
- **No se probó en vivo:** backend, ai-service y Ollama no estaban corriendo. Todo se validó con pruebas automáticas y revisando el código.
- **Nada está en commit.** Hay 2 migraciones nuevas: `1791992450000-CourseContent` y `1791992600000-ReadingTexts`.

---

## Ronda 1 — Recursos, perfil, canciones, versiones y rendimiento

| Incidencia | Causa encontrada | Solución |
|---|---|---|
| Falta el teléfono en «ver detalle» del perfil | El backend ya lo guardaba; la pantalla no lo mostraba | Se muestra en el detalle y en el perfil como enlace `tel:` |
| Falta el teléfono en el registro | El campo no existía en el formulario ni en el backend | Campo opcional con validación en un solo sitio (backend + `packages/shared-schemas`) |
| «¿Cuántos elementos?» no deja escribir; controles de distinta altura | Chrome deshacía la selección del número; había controles de 32, 40 y 42 px | El número se borra al hacer focus y se restaura si queda vacío; todo mide 40 px |
| «Volver a recursos» genérico | Texto fijo | Texto según el tipo: vocabulario, regla gramatical, frase de ejemplo, pronunciación, error frecuente, ejercicio |
| `ThrottlerException` al publicar más de 60 palabras («Parcial 66/69») | Unas 276 peticiones contra un límite global de 100 por minuto | Nueva petición única para el lote (`POST /curriculum/status/bulk`); reintentar completa solo lo que falta |
| PDF: «No se encontraron elementos» | El texto del PDF salía en una línea o con columnas pegadas; sin OCR | Reconstrucción de líneas y columnas, OCR para escaneados; cada elemento con idioma + español + IPA + audio |
| Gramática por IA falla; no se puede importar | Respuestas del modelo en formatos no previstos (503); gramática no era un tipo importable | Normalización de la respuesta; importa desde URL, PDF, Word, imagen y Excel, con plantilla |
| Pronunciación /ɒ/ sin reglas ni ejemplos | El esquema del recurso no tenía esos campos | Fonema, cuándo se usa, cómo se pronuncia, 5 palabras y 3 frases con IPA, traducción y audio |
| Canciones: sin opción de IA | No existía | Generación de letra con IA en el asistente de subida |
| Letra desde URL da 403 | La petición se identificaba como bot | Descarga con cabeceras de navegador, reintento y extracción solo de la letra |
| «El servicio de IPA y traducción no respondió» | Con más de 40 versos se traducía verso a verso y se superaba el límite de 90 s | Bloques de 20 versos, progreso guardado y botón «Completar IPA y traducción» |
| «Falta subir el audio» (400) | Se podía pulsar Publicar sin audio y fallaba en el servidor | Lista de requisitos; Publicar desactivado hasta subir el audio (el audio sigue siendo obligatorio: karaoke y licencia dependen de él) |
| Versiones desactualizadas | — | Next 16.4.1, Node 24.22.1, certifi 2026.10.19 y pip 26.2.2 (verificadas en npm, PyPI y Docker Hub) |
| Imágenes Docker | El Dockerfile de ai-service estaba vacío; Next no tenía Dockerfile | Se crearon; las 4 imágenes construyen correctamente |
| Navegación lenta, sobre todo en Angular | Zod completo (~490 KB) en cada pantalla; todas las pantallas se precargaban a la vez | Angular: 979 → 660 KB al arrancar. Next: 972 → 720 KB en `/login` |

## Ronda 2 — Música, actividades, conversación, cursos e IA

| Incidencia | Causa encontrada | Solución |
|---|---|---|
| Página de letras pegada como enlace de audio (400) | El enlace no se comprobaba antes de enviarlo | Se detecta antes de enviar y se ofrece «Importar la letra desde este enlace» |
| Aviso de CSP `m.stripe.network` | Stripe se cargaba en todas las pantallas | Solo se carga al abrir el formulario de pago |
| WebSocket de Vite falla en `/ng` | Next no reenvía la conexión WebSocket | En desarrollo, el cliente de Vite conecta directo al puerto 9100 |
| Actividades distintas a Recursos y con modales | Diseño antiguo | Pantalla en pasos sin modales: IA, manual o importación desde URL, PDF, Word, Excel, imagen y multimedia |
| Audio de AULA sin sonido | Probable en Windows: la voz del navegador fallaba sin avisar y el WAV traía una cabecera con tamaño falso | WAV correcto; el servidor rechaza audio en silencio; el navegador usa su propia voz si el audio llega vacío |
| PDF del curso: «El archivo no tiene texto que se pueda leer» | Sin OCR para PDF escaneados | OCR en el servidor |
| Lo importado por URL reemplaza la descripción | Se escribía directamente en la descripción | Campo nuevo «Contenido del curso» en Markdown, sin límite (migración `1791992450000-CourseContent`) |
| Aviso de `pdfjs-dist` en Next | El servidor importaba código del navegador | Aviso eliminado; `next build` termina limpio |
| Exámenes y cursos con IA: falta de RAM en Ollama | Contexto excesivo (hasta 8192), sin respaldo; el mensaje recomendaba el mismo modelo | Contexto ajustado, descarga de otros modelos, paso automático a `qwen2.5:1.5b` / `0.5b` y mensaje correcto |
| Los 3 motores fallan igual | Aya, Qwen y Mistral apuntan al mismo modelo en el `.env` | Aviso en el log; ya no se hace «respaldo» hacia el mismo modelo |
| `ECONNRESET` al generar vocabulario | Next reutilizaba conexiones justo cuando el backend las cerraba | Un reintento y error 502 claro; el backend mantiene la conexión 65 s |
| IPA en francés: 503 tras 12–16 s | La puntuación desalineaba las palabras y se lanzaba un proceso por palabra | Procesamiento en bloque con caché; una palabra fallida no tumba la petición |
| 422 en `curriculum/ai/content` | El modelo devolvía campos vacíos o con otra forma | Normalización antes de validar; error legible en español |
| Contenido de curso largo no se podía guardar | Límite de 100 KB en el backend y 1 MB en Next | Ambos subidos a 2 MB; la importación trae hasta 400 000 caracteres |

## Ronda 3 — Voz, traducciones de la conversación y nueva sección Lectura

| Incidencia | Causa encontrada | Solución |
|---|---|---|
| `POST /speech/transcribe` → 503 tras «Grabación lista» | `faster-whisper` está en `requirements.txt` pero no instalado en el entorno de Windows; se reportaba como error genérico | Error propio `SPEECH_ENGINE_MISSING` con instrucción de instalación; estado en `/health` y `GET /speech/status`; script `scripts/check_ai_deps.py`; README con notas de Windows |
| Sin alternativa cuando el servidor no transcribe | El frontend no tenía respaldo y en Biblioteca de diálogos el error ni se mostraba | Dictado del navegador o respuesta escrita; aviso accesible; la grabación se conserva en «Mis grabaciones» |
| Traducciones con JSON crudo (`{"…": "…"}`, `["…",]`) | Se guardaba la salida del modelo sin interpretarla | Intérprete tolerante en ai-service y saneador en el backend; también repara traducciones ya guardadas |
| Traducciones erróneas («yes», «Pepino verde», «cabeza de gallo», voseo) | Sin control de calidad ni glosario | Diccionario corto, glosario de comida (pico de gallo, pimiento morrón…), español neutro con «tú», validación y un reintento; si sigue mal, se muestra «—» en vez de basura |
| AULA mezcla español («El rooster's beak…») | El mismo prompt pedía la respuesta en inglés y dos traducciones al español | AULA solo responde en el idioma de práctica; las traducciones salen de un servicio aparte; corrección del artículo inicial |
| AULA repite «Interesting! Can you tell me a bit more?» | Respuestas cortadas o fuera de tiempo, claves inesperadas y memoria perdida al reiniciar | Respuesta más corta, acepta cualquier clave común, reintento acotado y pregunta de respaldo variada según el tema |
| **Nueva:** subsección Lectura | — | Gestión: textos (cuento, fábula, fauna, poema, noticia, diálogo, biografía, leyenda) por IA, a mano o importados (PDF, Word, imagen, URL). Estudiante: traducción, IPA, audio con resaltado palabra a palabra, marcador de lectura y descarga en PDF/TXT |

---

## Verificación final (todo junto)

| Aplicación | Compilación | Pruebas |
|---|---|---|
| Backend | Sin errores | 75 de 77 suites pasan; fallan `certificates` y `fixes-2026-10-19`, que ya fallaban antes |
| Next | Sin errores; `next build` limpio | 42 de 42 suites pasan |
| Angular | Sin errores | 102 de 102 suites pasan |
| ai-service | — | 244 pasan, 4 se omiten (sin `faster-whisper` en la máquina de pruebas) y 1 falla (espeak-ng 1.51 en vez de 1.52) |

## Riesgos y pendientes

1. **Sin prueba en vivo.** Probar con el stack levantado en Windows: publicar más de 60 palabras, importar PDF, generar con IA y escuchar el audio de AULA.
2. **Ollama depende de la RAM.** El respaldo solo funciona si los modelos pequeños están instalados.
3. **ESLint no corre en la máquina de pruebas** (`/home/dev/package.json` tiene `"type": "module"`). Es un problema del entorno, no del repo.
4. **Hay dos controladores para `GET /profile/me`.** Cuál responde depende del orden de carga de los módulos.
5. **Mejoras menores sin hacer:**
   - Borrar un tema de más de 100 elementos todavía hace una petición por elemento.
   - La edición de actividades sigue en Angular; solo la creación tiene el diseño nuevo.
   - No se transcriben enlaces a páginas de YouTube.
   - El editor Markdown no muestra enlaces, tablas ni código.
   - Si la IA solo propone vocabulario repetido, la generación por lotes se detiene con un 422.
   - Lectura: el PDF no dibuja caracteres chinos (el TXT sí); sin tiempos por palabra del servidor, el resaltado es estimado; pausar reanuda desde el inicio de la frase.
   - El tipo de la API de Lectura en `packages/api-client/generated.ts` se añadió a mano: regenerar con `pnpm api:types` con el backend encendido.

## Acciones para el equipo

1. Ejecutar `ollama pull qwen2.5:1.5b` (y, si es posible, `qwen2.5:0.5b`).
2. En `apps/backend/.env`: `OLLAMA_NUM_CTX=4096` y un modelo distinto en cada `OLLAMA_*_MODEL`.
3. Aplicar las migraciones pendientes (contenido de cursos y Lectura).
4. En `apps/ai-service` (Windows): `.venv\Scripts\python -m pip install -r requirements.txt` y luego `.venv\Scripts\python scripts\check_ai_deps.py`. Si falla con «DLL load failed», instalar Visual C++ Redistributable 2015–2022 x64. Confirmar con `curl http://localhost:8000/health` → `"speech": {"available": true}`.
5. Si el audio de AULA sigue en silencio y aparece «Audio descartado …» en el log, revisar `ESPEAK_NG_PATH` y la instalación de espeak-ng-data.
6. Revisar los cambios y hacer el commit.
