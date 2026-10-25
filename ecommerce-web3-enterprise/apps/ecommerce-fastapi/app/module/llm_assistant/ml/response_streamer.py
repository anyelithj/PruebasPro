# response_streamer.py (FastAPI StreamingResponse) => Server-Sent Events: cada evento es texto
# "event: <tipo>\ndata: <json>\n\n" sobre una sola respuesta HTTP (text/event-stream).
# Patrón: Observer (el cliente se suscribe a la respuesta y recibe cada token al generarse).
# Paradigma: funcional (sse es pura) + asíncrono.

import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi.responses import StreamingResponse


# sse => serializa un evento; "ensure_ascii=False" mantiene tildes y emojis legibles (menos bytes)
def sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def sse_response(events: AsyncIterator[str]) -> StreamingResponse:
    return StreamingResponse(
        events,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",  # Ningún proxy guarda la respuesta
            "X-Accel-Buffering": "no",  # Nginx reenvía cada token sin acumularlo en búfer
        },
    )
