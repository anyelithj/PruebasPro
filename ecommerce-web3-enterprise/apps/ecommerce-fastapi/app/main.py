# main.py (Python + FastAPI) => punto de entrada ASGI del motor IA/ML.
# Patrón: Composition Root / Facade (aquí se ensamblan routers REST, el esquema GraphQL y los
# manejadores de error; la lógica vive en app/module/*).
# Paradigma: orientado a objetos (instancia FastAPI) + declarativo (registro de rutas por datos).

from typing import Annotated, Any

import strawberry
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import (
    CORSMiddleware,
)  # Starlette: cabeceras CORS y respuesta al preflight
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.fastapi import GraphQLRouter  # Monta un esquema Strawberry como router de FastAPI
from strawberry.tools import merge_types  # Une los Query/Mutation de cada módulo en un solo tipo

from app.config.app_config import get_settings
from app.config.database_config import get_session
from app.module.customer_analytics.controller import customer_analytics_controller as customers
from app.module.customer_analytics.route.customer_analytics_route import router as customers_router
from app.module.demand_forecasting.controller import forecasting_controller as forecasting
from app.module.demand_forecasting.route.forecasting_route import router as forecasting_router
from app.module.email_parser.controller import email_parser_controller as emails
from app.module.email_parser.route.email_parser_route import router as emails_router
from app.module.fraud_detection.controller import fraud_detection_controller as fraud
from app.module.fraud_detection.route.fraud_detection_route import router as fraud_router
from app.module.image_recognition.controller import image_recognition_controller as images
from app.module.image_recognition.route.image_recognition_route import router as images_router
from app.module.llm_assistant.controller import llm_controller as llm
from app.module.llm_assistant.route.llm_route import router as llm_router
from app.module.ml_prediction.controller import ml_prediction_controller as predictions
from app.module.ml_prediction.route.ml_prediction_route import router as predictions_router
from app.module.natural_language.controller import nlp_controller as nlp
from app.module.natural_language.route.nlp_route import router as nlp_router
from app.module.natural_language.route.nlp_route import training_router as nlp_training_router
from app.module.personalization.controller import personalization_controller as personalization
from app.module.personalization.route.personalization_route import router as personalization_router
from app.module.price_optimization.controller import pricing_controller as pricing
from app.module.price_optimization.route.pricing_route import router as pricing_router
from app.module.sentiment_analysis.controller import sentiment_controller as sentiment
from app.module.sentiment_analysis.route.sentiment_route import router as sentiment_router
from app.shared.middleware.auth_middleware import AuthUser, get_current_user, require_roles
from app.shared.middleware.error_middleware import register_error_handlers

# "app" => instancia ASGI que uvicorn ejecuta con "uvicorn app.main:app"
# title/version => aparecen en la documentación OpenAPI generada automáticamente en /docs
app = FastAPI(title="ecommerce-fastapi", version="0.1.0")

# Chain of Responsibility: excepción de dominio / validación / inesperada -> JSON (contrato Express)
register_error_handlers(app)
# CORS => el navegador (Next.js en otro puerto) puede llamar al chat con "Authorization: Bearer";
# sin cookies. X-Device-Id (lo agregan los clientes Axios de Next/Nuxt a toda petición) e Idempotency-Key
# (reintentos sin conexión, RF-28.7) deben estar permitidos: si falta uno, el preflight OPTIONS responde 400
# y el navegador bloquea la llamada (error "CORS ... does not have HTTP ok status")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().CORS_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Accept-Language", "X-Device-Id", "Idempotency-Key"],
)

# Fase 5: 5.1 predicciones y pronóstico de demanda · 5.2 visión · 5.3 sentimiento, correos y
# chatbot · 5.4 clientes · 5.5 fraude, personalización y precios · 5B asistente LLM (gateway, RAG,
# tool use, chat SSE y evaluaciones).
# Lista de datos: agregar un módulo = una línea (OCP)
for router in (
    predictions_router,
    forecasting_router,
    images_router,
    sentiment_router,
    emails_router,
    nlp_router,
    nlp_training_router,  # RF-17.12 / RF-17.13
    customers_router,
    fraud_router,
    personalization_router,
    pricing_router,
    llm_router,
):
    app.include_router(router)


# graphql_context => contexto por petición GraphQL: la misma AsyncSession que usa REST (Unit of
# Work) y el usuario autenticado (para las reglas de propietario de chat y recomendaciones)
async def graphql_context(
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[AuthUser, Depends(get_current_user)],
) -> dict[str, Any]:
    return {"session": session, "user": user}


# Un solo esquema GraphQL para todo el motor IA: cada módulo aporta su Query (lectura por ID)
schema = strawberry.Schema(
    query=merge_types(
        "Query",
        (
            predictions.PredictionQuery,
            forecasting.ForecastingQuery,
            images.ImageRecognitionQuery,
            sentiment.SentimentQuery,
            emails.EmailParserQuery,
            nlp.NlpQuery,
            customers.CustomerAnalyticsQuery,
            fraud.FraudQuery,
            personalization.PersonalizationQuery,
            pricing.PricingQuery,
            llm.LlmQuery,
        ),
    ),
    mutation=merge_types("Mutation", (predictions.PredictionMutation,)),
)
graphql_router = GraphQLRouter(
    schema,
    context_getter=graphql_context,
    # Sin IDE embebido: no se sirve su HTML/JS (menos tráfico y superficie expuesta)
    graphql_ide=None,
    dependencies=[Depends(require_roles("ADMIN"))],  # Mismo guard RBAC que REST
)
app.include_router(graphql_router, prefix="/graphql")


# "@app.get" => decorador (patrón Decorator) que registra la función como handler de GET /health
# "async def" => corrutina: FastAPI la ejecuta en el event loop sin bloquear otras peticiones
@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "ecommerce-fastapi"}  # Liveness probe para Docker/Kubernetes
