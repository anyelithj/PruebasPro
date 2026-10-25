# tool_registry.py (Pydantic v2) => catálogo de herramientas que el LLM puede pedir (Plan 5B.3):
# buscar productos, estado de un pedido y stock de un producto, todas contra la API REST de Express.
# Cada herramienta declara sus argumentos con Pydantic (el JSON Schema que ve el modelo sale de ahí
# y los argumentos que devuelve el modelo se validan con el mismo modelo: una sola fuente, DRY),
# la ruta GET que consulta y cómo resumir la respuesta (menos tokens para el LLM).
# Web3 solo lectura: el registro solo admite GET; ninguna herramienta firma ni envía transacciones.
# Patrón: Registry (dict nombre -> Tool) + Factory (schema() fabrica la definición para Ollama) +
# Value Object (Tool inmutable). Paradigma: declarativo (las herramientas son datos) + funcional.

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class SearchProductsArgs(BaseModel):
    query: str = Field(min_length=1, max_length=100, description="Qué busca el cliente")


class OrderStatusArgs(BaseModel):
    order_id: UUID = Field(description="ID del pedido (UUID) que indica el cliente")


class ProductStockArgs(BaseModel):
    product_id: UUID = Field(description="ID del producto (UUID) obtenido de search_products")


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    args: type[BaseModel]
    # path => (ruta GET de Express, query string) a partir de los argumentos ya validados
    path: Callable[[Any], tuple[str, dict[str, Any]]]
    # summarize => JSON de Express ("data" del sobre) -> solo los campos útiles para responder
    summarize: Callable[[Any], Any]

    # schema => definición "function" que entiende Ollama (formato OpenAI tools)
    def schema(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.args.model_json_schema(),
            },
        }


def _money(cents: int, currency: str) -> str:
    return f"{cents / 100:,.0f} {currency}"


def _products(data: list[dict]) -> list[dict]:
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "price": _money(p["minPriceCents"], p["currency"]),
            "in_stock": p["inStock"],
        }
        for p in data
    ]


def _order(data: dict) -> dict:
    return {
        "order_number": data["orderNumber"],
        "status": data["status"],
        "total": _money(data["totalCents"], data["currency"]),
        "items": data["itemCount"],
        "placed_at": data["placedAt"],
    }


def _stock(data: dict) -> dict:
    return {
        "name": data["name"],
        "variants": [
            {"sku": v["sku"], "name": v["name"], "available": v["available"]}
            for v in data["variants"]
            if v["isActive"]
        ],
    }


TOOLS: dict[str, Tool] = {
    tool.name: tool
    for tool in (
        Tool(
            "search_products",
            "Busca productos activos del catálogo por texto (nombre, tipo, marca)",
            SearchProductsArgs,
            lambda a: ("/api/v1/product", {"q": a.query, "limit": 5}),
            _products,
        ),
        Tool(
            "get_order_status",
            "Estado actual de un pedido del cliente autenticado",
            OrderStatusArgs,
            lambda a: (f"/api/v1/order/{a.order_id}", {}),
            _order,
        ),
        Tool(
            "get_product_stock",
            "Unidades disponibles por variante de un producto",
            ProductStockArgs,
            lambda a: (f"/api/v1/product/{a.product_id}", {}),
            _stock,
        ),
    )
}


# TOOL_SCHEMAS => lista que recibe el LLM (se calcula una vez: las herramientas no cambian)
TOOL_SCHEMAS: list[dict[str, Any]] = [tool.schema() for tool in TOOLS.values()]
