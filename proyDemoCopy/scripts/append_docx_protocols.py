"""Append protocols + Redis + Docker validation section to Auth_y_Docker.docx.

Idempotente: si la sección ya existe la reescribe en su lugar borrando todo a partir del marcador.
"""
from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT

DOCX_PATH = Path(
    r"C:/Users/angui/Documents/proyDemo/documentos proyecto/Auth_y_Docker.docx"
)

MARKER_H1 = "9. Protocolos, API Gateway, Redis y Validación Docker"


def remove_existing_section(doc: Document) -> None:
    """Borra paragraphs desde el marcador en adelante si ya existe."""
    body = doc.element.body
    paragraphs = list(doc.paragraphs)
    start_idx: int | None = None
    for i, p in enumerate(paragraphs):
        if p.text.strip() == MARKER_H1:
            start_idx = i
            break
    if start_idx is None:
        return
    # quitar el sentinel "— Fin del documento —" también si está después
    for p in paragraphs[start_idx:]:
        body.remove(p._element)


def add_bullet(doc: Document, text: str) -> None:
    doc.add_paragraph(text, style="List Bullet")


def add_number(doc: Document, text: str) -> None:
    doc.add_paragraph(text, style="List Number")


def add_code(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = None
    run = p.add_run(text)
    run.font.name = "Consolas"
    run.font.size = None  # heredar


def main() -> None:
    doc = Document(str(DOCX_PATH))

    # Quitar marker "— Fin del documento —" final si existe (último párrafo)
    last_paragraphs = doc.paragraphs[-3:]
    body = doc.element.body
    for p in last_paragraphs:
        if "Fin del documento" in p.text:
            body.remove(p._element)
            break

    remove_existing_section(doc)

    doc.add_heading(MARKER_H1, level=1)

    # 9.1 Protocolos
    doc.add_heading("9.1 Protocolos de comunicación", level=2)
    doc.add_paragraph(
        "Durante el análisis del proyecto se evaluaron los siguientes protocolos "
        "para integración inter-servicios. Se documenta cuál está en uso real, "
        "cuál aparece solamente como dependencia transitiva y cuál fue descartado:"
    )

    add_bullet(
        doc,
        "GraphQL: no se utiliza en el proyecto. Únicamente figura como dependencia "
        "transitiva en pnpm-lock.yaml. El backend NestJS expone exclusivamente "
        "endpoints REST documentados con Swagger (@nestjs/swagger).",
    )
    add_bullet(
        doc,
        "gRPC: no se utiliza. Aparece sólo en pnpm-lock.yaml como dependencia indirecta. "
        "No existe definición .proto ni servidor gRPC instanciado.",
    )
    add_bullet(
        doc,
        "MCP (Model Context Protocol): no se utiliza en el código fuente. Está "
        "mencionado únicamente en los documentos de arquitectura propuesta "
        "(documentos proyecto/next_estructura.md) como vía de extensión futura.",
    )
    add_bullet(
        doc,
        "REST / HTTP + JSON (en uso): es el protocolo activo entre todos los servicios. "
        "El backend NestJS expone @Controller('quiz') con verbos HTTP estándar. "
        "El frontend Next.js consume vía Route Handlers (app/api/quiz/route.ts). "
        "El servicio FastAPI (apps/ai-service) y Ollama local también se invocan vía REST.",
    )

    # 9.2 API Gateway
    doc.add_heading("9.2 Implementación del API Gateway", level=2)
    doc.add_paragraph(
        "El proyecto no incluye un API Gateway dedicado tipo Kong, Tyk o Apigee. "
        "El patrón implementado es Backend-For-Frontend (BFF) usando los Route Handlers "
        "de Next.js como capa intermedia. Las responsabilidades del gateway se distribuyen "
        "de la siguiente manera:"
    )
    add_bullet(
        doc,
        "BFF Proxy: apps/frontend-next/src/app/api/**/route.ts reenvía las peticiones del cliente "
        "al backend NestJS, evitando exponer la URL del backend al navegador y permitiendo "
        "adjuntar cookies/headers del lado servidor.",
    )
    add_bullet(
        doc,
        "Guards globales en NestJS (apps/backend/src/app.module.ts): JwtAuthGuard valida "
        "el token JWT en todas las rutas; CustomThrottlerGuard aplica rate limiting global; "
        "HttpExceptionFilter unifica el formato de errores.",
    )
    add_bullet(
        doc,
        "Interceptors globales: LoggingInterceptor, TimeoutInterceptor y TransformInterceptor "
        "se ejecutan top-down para registrar, limitar tiempo y normalizar respuestas.",
    )
    add_bullet(
        doc,
        "ConfigModule.forRoot con isGlobal=true centraliza la configuración del entorno "
        "(database, jwt, redis, throttler) y cumple el rol de configuration server.",
    )

    # 9.3 Redis
    doc.add_heading("9.3 Uso de Redis", level=2)
    doc.add_paragraph(
        "Redis se ejecuta como contenedor Docker (servicio 'redis' en "
        "docker-compose.dev.yml) con persistencia AOF activada y healthcheck PING/PONG. "
        "Cumple los siguientes roles dentro del sistema:"
    )
    add_bullet(
        doc,
        "Caché de preguntas Open Trivia: FetchTriviaQuestionsUseCase aplica patrón "
        "Cache-Aside con TTL de 1 hora, evitando golpear la API externa en cada request.",
    )
    add_bullet(
        doc,
        "Caché de preguntas generadas por IA: GenerateAIQuestionsUseCase cachea las "
        "respuestas de Qwen3:8b y Mistral Nemo durante 1 hora, indexadas por "
        "(topic + amount + provider + category + difficulty + language).",
    )
    add_bullet(
        doc,
        "Caché de leaderboard: GetLeaderboardUseCase cachea el top global durante 60 s "
        "para no recomputarlo en cada lectura.",
    )
    add_bullet(
        doc,
        "Historial conversacional del servicio de IA (apps/ai-service): "
        "conversation_repo.py persiste el contexto de los turnos del asistente en Redis.",
    )
    add_bullet(
        doc,
        "Configuración central: shared/config/redis.config.ts expone host, puerto, "
        "password y TTL via @nestjs/config (namespace 'redis').",
    )
    add_bullet(
        doc,
        "Preparado para colas Bull (jobs asíncronos) y rate-limit distribuido en Sprints "
        "posteriores; la fábrica de CacheModule se conectará a Redis cuando deje de "
        "usarse el store in-memory por defecto.",
    )

    # 9.4 Validación Docker
    doc.add_heading("9.4 Validación de servicios en Docker", level=2)
    doc.add_paragraph(
        "Procedimiento paso a paso para verificar que la base de datos y el resto de "
        "servicios definidos en docker-compose.dev.yml estén funcionando correctamente:"
    )
    add_number(doc, "Levantar el stack: docker compose -f docker-compose.dev.yml up -d")
    add_number(doc, "Listar contenedores y su estado: docker compose -f docker-compose.dev.yml ps")
    add_number(
        doc,
        "Comprobar healthchecks individuales: "
        "docker inspect --format='{{.State.Health.Status}}' languageProject_postgres "
        "y la misma orden para languageProject_redis. Debe devolver 'healthy'.",
    )
    add_number(
        doc,
        "Validar PostgreSQL accesible y con extensiones cargadas: "
        "docker exec -it languageProject_postgres psql -U postgres -d proydemo -c \"SELECT version();\" "
        "y luego \\dx para listar extensiones del init script.",
    )
    add_number(
        doc,
        "Validar Redis: docker exec -it languageProject_redis redis-cli PING (debe responder PONG). "
        "Opcional: redis-cli INFO server para versión.",
    )
    add_number(
        doc,
        "Abrir pgAdmin en http://localhost:5050 con admin@proydemo.local / admin y conectar "
        "al host 'postgres' puerto 5432 usuario postgres.",
    )
    add_number(doc, "Abrir MailHog UI en http://localhost:8025 para verificar el SMTP de pruebas.")
    add_number(
        doc,
        "Comprobar puertos en el host (PowerShell): Test-NetConnection -ComputerName localhost "
        "-Port 5432, -Port 6379, -Port 5050, -Port 8025.",
    )
    add_number(
        doc,
        "Ver logs si algún servicio no levanta: docker compose -f docker-compose.dev.yml logs -f postgres "
        "(reemplazar nombre del servicio según corresponda).",
    )
    add_number(
        doc,
        "Validar backend conectado: tras arrancar 'pnpm dev' en apps/backend, llamar a su "
        "endpoint /api/health o intentar autenticarse para confirmar que Postgres y Redis "
        "están integrados correctamente.",
    )

    # Resultado esperado
    doc.add_heading("9.5 Resultado esperado", level=2)
    add_bullet(doc, "postgres: estado 'healthy', SELECT version() responde.")
    add_bullet(doc, "redis: estado 'healthy', PING responde PONG.")
    add_bullet(doc, "pgadmin: UI accesible en :5050.")
    add_bullet(doc, "mailhog: UI accesible en :8025 y SMTP en :1025.")
    add_bullet(doc, "Sin errores en docker compose logs.")

    # Cierre
    p = doc.add_paragraph("— Fin del documento —")
    p.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER

    doc.save(str(DOCX_PATH))
    print(f"OK: seccion 9 agregada -> {DOCX_PATH}")


if __name__ == "__main__":
    main()
