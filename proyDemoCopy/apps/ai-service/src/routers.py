"""Registro central de routers de la app.

[Patron]: Facade — un unico punto desde main.py para registrar todos los routers.
[Principio]: SSOT + OCP.
[Paradigma]: Funcional.
"""
from fastapi import FastAPI

from src.modules.alignment.presentation.alignment_router import router as alignment_router
from src.modules.analytics.presentation.analytics_router import router as analytics_router

from src.modules.assistant.presentation.assistant_router import (
    router as assistant_router,
)
from src.modules.feedback.presentation.feedback_router import router as feedback_router
from src.modules.grading.presentation.grading_router import router as grading_router
from src.modules.level_classifier.presentation.level_classifier_router import router as level_classifier_router
from src.modules.language_tools.presentation.language_tools_router import (
    router as language_tools_router,
)
from src.modules.own_llm.presentation.own_llm_router import router as own_llm_router
from src.modules.speech.presentation.speech_router import router as speech_router


def register_routers(app: FastAPI, prefix: str = "/api/v1") -> None:
    """Engancha todos los routers de modulos bajo el prefix global."""
    app.include_router(grading_router, prefix=prefix)
    app.include_router(feedback_router, prefix=prefix)
    app.include_router(assistant_router, prefix=prefix)
    app.include_router(language_tools_router, prefix=prefix)  # [Sprint 4.7]: voz local para la pronunciación
    app.include_router(analytics_router, prefix=prefix)  # [Sprint 5.4]: dificultad real y anomalías (docente/admin)
    app.include_router(own_llm_router, prefix=prefix)  # [Sprint 5.6]: LLM propio, corrector de redacciones (RF-144)
    app.include_router(speech_router, prefix=prefix)  # [Sprint 8.6]: voz a texto y métricas de fluidez (juegos orales)
    app.include_router(alignment_router, prefix=prefix)  # [Sprint 9.4]: inicio y fin de cada línea (canciones y diálogos)
    app.include_router(level_classifier_router, prefix=prefix)  # [Sprint 9.5]: nivel CEFR estimado de diálogos (el docente confirma)
