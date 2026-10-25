# knowledge_indexer.py (Celery + pgvector + embeddings de Ollama) => indexación semántica del
# conocimiento de la tienda (Plan 5B.2): catálogo (public.products de Express), FAQ y políticas en
# español e inglés. Cada documento se parte en fragmentos solapados, se calcula su embedding y se
# guarda en ml.knowledge_chunks (índice HNSW).
# Patrón: Pipeline (documentos -> fragmentos -> huella -> embeddings solo de lo nuevo -> upsert) +
# Data-Driven (FAQ y políticas son datos: agregar una = agregar un dict).
# Paradigma: funcional (chunk_text y _chunks son puras) + asíncrono (E/S de BD).
# Ahorro de recursos: re-indexar es incremental (la huella SHA-256 evita recalcular embeddings de
# fragmentos sin cambios), embeddings por lotes (un viaje HTTP por lote) y corre en el worker de
# Celery (la API no gasta CPU). La re-indexación por evento de producto solo procesa esos IDs.

import asyncio
from collections.abc import Iterable
from typing import Any, Literal

from sqlalchemy import bindparam, delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.module.llm_assistant.model.llm_model import KnowledgeChunk
from app.module.natural_language.ml.llm_connector import embed
from app.shared.constants.ml_constants import KNOWLEDGE_CHUNK_CHARS, KNOWLEDGE_CHUNK_OVERLAP
from app.shared.decorator.cache_decorator import content_hash

type KnowledgeSource = Literal["products", "faq", "policies"]
SOURCES: tuple[KnowledgeSource, ...] = ("products", "faq", "policies")
SOURCE_KIND = {"products": "product", "faq": "faq", "policies": "policy"}  # Valor en la tabla
EMBED_BATCH = 64  # Fragmentos por llamada a Ollama (lotes grandes = menos viajes HTTP)
MAX_PRODUCT_CHARS = 1800  # 3 fragmentos por producto: lo esencial de la descripción

# FAQ y políticas (es/en). Sin teléfonos ni correos: los guardrails los redactarían en la salida
FAQ: list[dict[str, str]] = [
    {
        "key": "shipping",
        "lang": "es",
        "title": "Envíos y tiempos de entrega",
        "content": "Enviamos a todo el país. Ciudades principales: 1 a 3 días hábiles; resto del "
        "país: 3 a 7 días hábiles. El envío es gratis en compras desde 150.000 COP. El número de "
        "guía aparece en Mi cuenta → Mis pedidos cuando el pedido pasa a ENVIADO.",
    },
    {
        "key": "shipping",
        "lang": "en",
        "title": "Shipping and delivery times",
        "content": "We ship nationwide. Main cities: 1 to 3 business days; rest of the country: "
        "3 to 7 business days. Shipping is free on orders from 150,000 COP. The tracking number "
        "appears in My account → My orders once the order is SHIPPED.",
    },
    {
        "key": "order-status",
        "lang": "es",
        "title": "Estados de un pedido",
        "content": "PENDIENTE: esperando pago. PAGADO: pago confirmado. EN PREPARACIÓN: "
        "empacando. ENVIADO: en camino con guía. ENTREGADO: recibido. CANCELADO: anulado y, si "
        "hubo pago, reembolsado al mismo medio.",
    },
    {
        "key": "order-status",
        "lang": "en",
        "title": "Order statuses",
        "content": "PENDING: awaiting payment. PAID: payment confirmed. PROCESSING: being packed. "
        "SHIPPED: on its way with tracking. DELIVERED: received. CANCELLED: voided and, if paid, "
        "refunded to the same payment method.",
    },
    {
        "key": "payments",
        "lang": "es",
        "title": "Medios de pago",
        "content": "Aceptamos tarjetas de crédito y débito (Stripe) y criptomonedas desde tu "
        "billetera Web3. La tienda nunca pide tu frase semilla ni tu clave privada: las "
        "transacciones las firmas tú en tu billetera.",
    },
    {
        "key": "payments",
        "lang": "en",
        "title": "Payment methods",
        "content": "We accept credit and debit cards (Stripe) and cryptocurrencies from your Web3 "
        "wallet. The store never asks for your seed phrase or private key: you sign every "
        "transaction in your own wallet.",
    },
]
POLICIES: list[dict[str, str]] = [
    {
        "key": "returns",
        "lang": "es",
        "title": "Política de devoluciones",
        "content": "Tienes 30 días desde la entrega para devolver un producto sin uso y con su "
        "empaque. Solicítalo en Mi cuenta → Mis pedidos → Devolver. El reembolso se hace al mismo "
        "medio de pago en 5 a 10 días hábiles después de recibir el producto.",
    },
    {
        "key": "returns",
        "lang": "en",
        "title": "Return policy",
        "content": "You have 30 days from delivery to return an unused product in its packaging. "
        "Request it in My account → My orders → Return. The refund goes to the same payment "
        "method within 5 to 10 business days after we receive the product.",
    },
    {
        "key": "warranty",
        "lang": "es",
        "title": "Garantía",
        "content": "Todos los productos tienen garantía legal de 1 año por defectos de fábrica. "
        "Para hacerla efectiva abre una solicitud desde el pedido y adjunta fotos del defecto.",
    },
    {
        "key": "warranty",
        "lang": "en",
        "title": "Warranty",
        "content": "Every product has a 1-year legal warranty against manufacturing defects. To "
        "claim it, open a request from the order and attach photos of the defect.",
    },
    {
        "key": "privacy",
        "lang": "es",
        "title": "Privacidad de datos",
        "content": "Usamos tus datos solo para procesar pedidos y mejorar tu experiencia. Puedes "
        "borrar tus conversaciones con el asistente en cualquier momento y pedir la eliminación "
        "de tu cuenta desde Mi cuenta → Privacidad.",
    },
    {
        "key": "privacy",
        "lang": "en",
        "title": "Data privacy",
        "content": "We use your data only to process orders and improve your experience. You can "
        "delete your assistant conversations at any time and request account deletion from My "
        "account → Privacy.",
    },
]

# Catálogo activo con su categoría. "{ids}" se completa con un filtro IN fijo (nunca con datos del
# usuario: los IDs viajan como parámetro "expanding" => re-indexa solo los productos del evento)
PRODUCTS_SQL = """
    SELECT p.id, p.name, p.description, p."minPriceCents" AS price_cents, p.currency,
           c.name AS category
    FROM public.products p LEFT JOIN public.categories c ON c.id = p."categoryId"
    WHERE p.status = 'ACTIVE' {ids}
    ORDER BY p."updatedAt" DESC LIMIT 5000
"""


# chunk_text => ventanas de ~size caracteres cortadas en espacios, con "overlap" de solapamiento
def chunk_text(
    content: str, size: int = KNOWLEDGE_CHUNK_CHARS, overlap: int = KNOWLEDGE_CHUNK_OVERLAP
) -> list[str]:
    words, chunks, current = content.split(), [], []  # "split()" también normaliza espacios
    for word in words:
        if current and len(" ".join([*current, word])) > size:
            chunks.append(" ".join(current))
            tail: list[str] = []  # Últimas palabras del fragmento anterior (solapamiento)
            while current and len(" ".join([current[-1], *tail])) <= overlap:
                tail.insert(0, current.pop())
            current = tail
        current.append(word)
    if current:
        chunks.append(" ".join(current))
    return chunks


def _document(
    source: KnowledgeSource, source_id: str, lang: str, title: str, body: str, category: str | None
) -> dict[str, Any]:
    return {
        "source": SOURCE_KIND[source],
        "source_id": source_id,
        "lang": lang,
        "title": title[:160],
        "category": category,
        "content": body,
    }


async def _product_documents(
    session: AsyncSession, product_ids: list[str] | None
) -> list[dict[str, Any]]:
    query = text(PRODUCTS_SQL.format(ids="AND p.id IN :ids" if product_ids else ""))
    params: dict[str, Any] = {}
    if product_ids:
        query = query.bindparams(bindparam("ids", expanding=True))
        params["ids"] = product_ids
    rows = (await session.execute(query, params)).all()
    return [
        _document(
            "products",
            row.id,
            "es",  # Catálogo en español: el modelo de embeddings es multilingüe (busca en inglés)
            row.name,
            f"{row.name}. {row.description[:MAX_PRODUCT_CHARS]} "
            f"Precio desde {row.price_cents / 100:,.0f} {row.currency}.",
            row.category,
        )
        for row in rows
    ]


def _static_documents(source: KnowledgeSource, items: list[dict[str, str]]) -> list[dict]:
    return [
        _document(source, item["key"], item["lang"], item["title"], item["content"], item["key"])
        for item in items
    ]


# _chunks => fragmentos con su huella (incluye fuente e ID: dos productos con el mismo texto no
# chocan en la restricción UNIQUE)
def _chunks(documents: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        doc
        | {"content": piece, "content_hash": content_hash(doc["source"], doc["source_id"], piece)}
        for doc in documents
        for piece in chunk_text(doc["content"])
    ]


async def index_knowledge(
    session: AsyncSession,
    sources: Iterable[KnowledgeSource] = SOURCES,
    product_ids: list[str] | None = None,
) -> dict[str, int]:
    sources = tuple(sources)
    documents: list[dict[str, Any]] = []
    if "products" in sources:
        documents += await _product_documents(session, product_ids)
    if "faq" in sources:
        documents += _static_documents("faq", FAQ)
    if "policies" in sources:
        documents += _static_documents("policies", POLICIES)
    chunks = _chunks(documents)
    hashes = {chunk["content_hash"] for chunk in chunks}

    # Fragmentos obsoletos: los del alcance re-indexado cuya huella ya no existe (texto editado,
    # producto archivado o borrado)
    stale = delete(KnowledgeChunk).where(KnowledgeChunk.content_hash.not_in(hashes))
    if product_ids:
        stale = stale.where(
            KnowledgeChunk.source == "product", KnowledgeChunk.source_id.in_(product_ids)
        )
    else:
        stale = stale.where(KnowledgeChunk.source.in_([SOURCE_KIND[s] for s in sources]))
    deleted = (await session.execute(stale)).rowcount

    existing = set(
        (
            await session.execute(
                select(KnowledgeChunk.content_hash).where(KnowledgeChunk.content_hash.in_(hashes))
            )
        ).scalars()
    )
    new = [chunk for chunk in chunks if chunk["content_hash"] not in existing]
    for start in range(0, len(new), EMBED_BATCH):
        batch = new[start : start + EMBED_BATCH]
        # Título + texto: el embedding sabe de qué producto/tema habla cada fragmento.
        # "to_thread" => el cliente de Ollama es síncrono: no bloquea el event loop
        vectors = await asyncio.to_thread(
            embed, [f"{chunk['title']}. {chunk['content']}" for chunk in batch]
        )
        session.add_all(
            KnowledgeChunk(**chunk, embedding=vector.tolist())
            for chunk, vector in zip(batch, vectors, strict=True)
        )
        await session.flush()  # Un INSERT por lote: la memoria no crece con todo el catálogo
    await session.commit()
    return {
        "documents": len(documents),
        "chunks": len(chunks),
        "embedded": len(new),
        "deleted": deleted,
    }
