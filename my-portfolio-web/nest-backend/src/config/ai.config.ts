// [SRP] configuración IA aislada — Ollama (open source, sin API keys de terceros)
import { registerAs } from '@nestjs/config';

export const aiConfig = registerAs('ai', () => ({
  // Provider por defecto: Ollama. Sin OpenAI ni claves de terceros.
  provider: process.env.AI_PROVIDER ?? 'ollama',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
  chatModel: process.env.OLLAMA_CHAT_MODEL ?? 'qwen2.5:7b',
  temperature: parseFloat(process.env.AI_TEMPERATURE ?? '0.7'),
  // RAG se delega a FastAPI (LlamaIndex): URL base del backend Python.
  fastapiBaseUrl: process.env.FASTAPI_BASE_URL ?? 'http://localhost:8000',
}));
