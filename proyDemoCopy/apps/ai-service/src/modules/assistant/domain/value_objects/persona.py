"""Value Object Persona — qué agente atiende la conversación (Sprint 7.9).

[Patrón]: Value Object (tipo literal) + clave de Strategy (AgentFactory elige el agente por persona).
[Principio]: OCP — una persona nueva = un literal + un agente, sin tocar el caso de uso.
[Paradigma]: Tipado estático (`typing.Literal`).

- tutor: enseña el idioma (RAG sobre el currículo aprobado).
- guide: orienta sobre el uso de la plataforma (FAQ → manual → LLM).
- game: compañero de juegos (Sprint 8.7): motor determinista primero, LLM solo para la jugada libre.
- dialogue: avatar de conversación (Sprint 9.6): apertura determinista por tema, LLM dentro del tema y del nivel.
- support: soporte y atención al usuario (2026-10-19): misma cadena que el guía (FAQ → manual → LLM) con tono de soporte (problemas, cuenta, pagos, audio).
"""

from typing import Literal

Persona = Literal["tutor", "guide", "game", "dialogue", "support"]
