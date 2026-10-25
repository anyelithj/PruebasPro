"""AgentFactory — elige el agente según la persona de la conversación (Sprint 7.9).

[Patrón]: Factory + Strategy (cada persona es una estrategia del puerto Agent).
[Principio]: OCP (persona nueva = una entrada) + DIP (el caso de uso solo conoce el puerto) + SRP.
[Paradigma]: POO.
"""

from src.modules.assistant.domain.interfaces.agent import Agent
from src.modules.assistant.domain.value_objects.persona import Persona


class AgentFactory:
    def __init__(self, agents: dict[Persona, Agent]) -> None:
        self._agents = agents

    def for_persona(self, persona: Persona) -> Agent:
        return self._agents[persona]  # `Persona` es Literal → Pydantic ya rechazó cualquier otra en la petición
