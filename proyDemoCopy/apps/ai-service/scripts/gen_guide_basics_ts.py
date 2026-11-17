"""Genera backend/src/modules/help/domain/guide-basics.ts desde guide_basics.py (una sola fuente de textos).
Uso (desde apps/ai-service): python scripts/gen_guide_basics_ts.py"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from src.modules.assistant.infrastructure.agents import guide_basics as g  # noqa: E402

def rx(p):
    return "/" + p.pattern.replace("/", r"\/") + "/i"

def table(rows):
    return "\n".join(f"  [{rx(p)}, {json.dumps(a, ensure_ascii=False)}]," for p, a in rows)

out = f"""import type {{ HelpLocale }} from './entities/faq.entity';
import type {{ GuideMode }} from './guide-fallback';
// [GuideBasics · Dominio · 2026-11-09]: GENERADO por ai-service/scripts/gen_guide_basics_ts.py desde agents/guide_basics.py — no editar a mano
// Saludo/agradecimiento, «sigue sin funcionar», «no encuentro X» y pasos de los temas frecuentes SIN IA | [Patrón]: Lookup Table | [Principio]: Deterministic-first

const GREETING = {rx(g._GREETING)};
const THANKS = {rx(g._THANKS)};
const STILL_FAILING = {rx(g._STILL_FAILING)};
const RESOLVED = {rx(g._RESOLVED)};
const WHERE = {rx(g._WHERE)};
const SMALL_TALK: Record<'greeting' | 'thanks' | 'still', Record<GuideMode, Record<HelpLocale, string>>> = {json.dumps(g._SMALL_TALK, ensure_ascii=False, indent=2)};

const PLACES: [RegExp, Record<HelpLocale, string>][] = [
{table(g._PLACES)}
];

const TOPICS: [RegExp, Record<HelpLocale, string>][] = [
{table(g._TOPICS)}
];

export const NO_ANSWER: Record<HelpLocale, Record<GuideMode, string>> = {{
  es: {{ support: {json.dumps(g.NO_ANSWER['support']['es'], ensure_ascii=False)}, guide: {json.dumps(g.NO_ANSWER['guide']['es'], ensure_ascii=False)} }},
  en: {{ support: {json.dumps(g.NO_ANSWER['support']['en'], ensure_ascii=False)}, guide: {json.dumps(g.NO_ANSWER['guide']['en'], ensure_ascii=False)} }},
}};

export function smallTalk(text: string, mode: GuideMode, locale: HelpLocale): string | null {{
  const kind = GREETING.test(text) ? 'greeting' : THANKS.test(text) ? 'thanks' : STILL_FAILING.test(text) ? 'still' : RESOLVED.test(text) ? 'thanks' : null;
  return kind ? SMALL_TALK[kind][mode][locale] : null;
}}

export function basicAnswer(text: string, locale: HelpLocale): string | null {{
  const rows = WHERE.test(text) ? [...PLACES, ...TOPICS] : TOPICS;
  return rows.find(([re]) => re.test(text))?.[1][locale] ?? null;
}}
"""
target = pathlib.Path(__file__).resolve().parents[2] / "backend/src/modules/help/domain/guide-basics.ts"
target.write_text(out, encoding="utf-8")
print("escrito", target)
