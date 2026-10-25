"""Tests de schemas Pydantic del modulo assistant (chat)."""
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from src.modules.assistant.application.schemas.chat_request import ChatRequest
from src.modules.assistant.application.schemas.chat_response import (
    ChatResponse,
    ChatTurn,
)


class TestChatRequest:
    def test_construccion_minima(self) -> None:
        req = ChatRequest(message="hola")
        assert req.session_id is None
        assert req.topic is None

    def test_con_session_y_topic(self) -> None:
        req = ChatRequest(session_id="s1", message="hola", topic="math")
        assert req.session_id == "s1"
        assert req.topic == "math"

    def test_message_vacio_invalido(self) -> None:
        with pytest.raises(ValidationError):
            ChatRequest(message="")

    def test_message_excede_max(self) -> None:
        with pytest.raises(ValidationError):
            ChatRequest(message="x" * 2001)

    def test_extra_forbid(self) -> None:
        with pytest.raises(ValidationError):
            ChatRequest(message="hola", extra="no")

    def test_es_frozen(self) -> None:
        req = ChatRequest(message="hola")
        with pytest.raises(ValidationError):
            req.message = "otro"  # type: ignore[misc]


class TestChatResponse:
    def test_construccion_con_history(self) -> None:
        ts = datetime.now(UTC)
        turn = ChatTurn(role="user", content="hola", timestamp=ts)
        resp = ChatResponse(session_id="s1", reply="hi", history=[turn])
        assert len(resp.history) == 1
        assert resp.history[0].role == "user"
        assert resp.reply == "hi"

    def test_history_vacio_valido(self) -> None:
        resp = ChatResponse(session_id="s1", reply="hi", history=[])
        assert resp.history == []

    def test_chat_turn_frozen(self) -> None:
        turn = ChatTurn(role="user", content="x", timestamp=datetime.now(UTC))
        with pytest.raises(ValidationError):
            turn.content = "y"  # type: ignore[misc]
