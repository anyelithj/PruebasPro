"""[SRP][ML] Clasificación NLP de mensajes de contacto — TF-IDF + LogisticRegression.

Categoriza cada mensaje en 'job' (oferta de empleo), 'freelance' o 'spam' y asigna
prioridad de notificación. Modelo clásico ligero (sin transformers): se entrena una
vez al arrancar sobre un dataset semilla bilingüe (ES/EN).
"""

from __future__ import annotations

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

# Prioridad de notificación por categoría.
_PRIORITY: dict[str, str] = {"job": "high", "freelance": "medium", "spam": "low"}

# Dataset semilla (bilingüe). Suficiente para un clasificador TF-IDF demostrable.
_SEED: list[tuple[str, str]] = [
    # --- job (oferta de empleo formal / reclutador) ---
    ("Hola, somos una empresa de tecnología y tenemos una vacante de desarrollador full-stack senior, salario competitivo, ¿te interesaría una entrevista?", "job"),
    ("Buenas, soy reclutador de una startup, buscamos un ingeniero backend con NestJS, contrato indefinido y beneficios. ¿Podemos agendar una llamada?", "job"),
    ("We have an open position for a senior frontend engineer, remote, full-time with equity. Would you be open to an interview?", "job"),
    ("Te contacto por una oferta laboral de tiempo completo como arquitecto de software, incluye seguro médico y bonos anuales.", "job"),
    ("Our company is hiring a Python developer, permanent role, competitive salary and benefits. Are you available for a call this week?", "job"),
    ("Vi tu perfil y encaja con una posición de líder técnico en nuestra planilla, jornada completa. ¿Te gustaría postular?", "job"),
    ("We're recruiting for a full-time DevOps engineer position with relocation package. Interested in scheduling an interview?", "job"),
    ("Tenemos una vacante permanente de desarrollador móvil, salario mensual fijo y prestaciones de ley. ¿Cuándo podrías entrevistarte?", "job"),
    ("Hola, trabajo en Recursos Humanos y tenemos una posición abierta de ingeniero de datos, jornada completa, ¿podemos coordinar una entrevista técnica?", "job"),
    ("We came across your GitHub and would like to invite you to interview for a full-time staff engineer role, great benefits and stock options.", "job"),
    ("Buscamos incorporar a nuestro equipo un desarrollador React de planta, con salario fijo, vacaciones pagadas y seguro. ¿Te interesa aplicar?", "job"),
    ("Our HR team is offering a permanent remote position as a backend developer with health insurance and annual bonus. Are you open to an interview?", "job"),
    ("Te escribo de la empresa para ofrecerte un puesto de tiempo completo como tech lead, contrato indefinido. ¿Cuándo tienes disponibilidad para entrevista?", "job"),
    # --- freelance (proyecto puntual / cliente) ---
    ("Hola, necesito que me desarrolles una landing page para mi negocio, es un proyecto corto, ¿cuánto cobras por hora?", "freelance"),
    ("Quisiera cotizar el desarrollo de una app pequeña, es freelance, pago por el proyecto. ¿Me pasas presupuesto?", "freelance"),
    ("Hi, I need a freelancer to build a REST API for my startup, one-off project, what's your rate per hour?", "freelance"),
    ("Busco alguien que me haga una tienda online por contrato, trabajo puntual, ¿tienes disponibilidad esta semana?", "freelance"),
    ("Can you do a small gig fixing bugs on my website? It's a one-time paid task, please send a quote.", "freelance"),
    ("Necesito un desarrollador por proyecto para integrar un pago con Stripe, ¿cuál es tu tarifa?", "freelance"),
    ("Looking to hire a contractor for a short website redesign, fixed budget, can you send an estimate?", "freelance"),
    ("Tengo un proyecto freelance de scraping de datos, pago único al terminar, ¿te interesa cotizarlo?", "freelance"),
    ("Hola, quiero contratar por horas a alguien que integre un chatbot en mi web, es un encargo puntual, ¿cuál es tu tarifa?", "freelance"),
    ("I have a one-off project to migrate a WordPress site, freelance, paid per deliverable. Can you quote it?", "freelance"),
    ("Necesito cotización para desarrollar un dashboard a medida, trabajo por proyecto, sin relación laboral. ¿Presupuesto?", "freelance"),
    ("Would you take a short contract gig to add Stripe payments to my app? One-time fee, what do you charge?", "freelance"),
    ("Busco un freelancer para automatizar reportes en Python, pago por entrega, ¿tienes tiempo esta semana?", "freelance"),
    # --- spam / phishing / basura ---
    ("¡¡FELICIDADES!! Has ganado un iPhone gratis, haz clic aquí para reclamar tu premio ahora mismo!!!", "spam"),
    ("Increíble oportunidad de inversión en cripto, duplica tu dinero en 24 horas, escríbeme ya al WhatsApp.", "spam"),
    ("Buy cheap followers and likes now!!! Best SEO backlinks, visit our website to boost your ranking instantly.", "spam"),
    ("Estimado cliente, su cuenta ha sido bloqueada, verifique sus datos bancarios en este enlace urgente.", "spam"),
    ("Make $5000 a week working from home, no experience needed, click the link to start earning today!!!", "spam"),
    ("Viagra y pastillas baratas, envío discreto, mejores precios garantizados, compra en nuestra web.", "spam"),
    ("You have an unclaimed prize of $1,000,000, send your bank details to claim your lottery winnings.", "spam"),
    ("Promoción exclusiva de préstamos rápidos sin aval, dinero inmediato, responde con tus datos personales.", "spam"),
    ("Aumenta tus ventas YA con nuestro curso secreto, plazas limitadas, paga ahora y hazte rico en semanas.", "spam"),
    ("Congratulations! Your email was selected for a free gift card, click now and enter your card number to redeem.", "spam"),
    ("Vendo bases de datos de correos y números, marketing masivo garantizado, escríbeme por Telegram ahora.", "spam"),
    ("Hot singles in your area are waiting, sign up free today and meet them tonight, limited offer click here!!!", "spam"),
    ("Oferta única: hosting ilimitado a 1 dólar, backlinks SEO y tráfico garantizado, compra en nuestro sitio ya.", "spam"),
]


class ContactClassifierService:
    """Se instancia una vez; entrena el pipeline TF-IDF + LogisticRegression al inicio."""

    def __init__(self) -> None:
        texts = [t for t, _ in _SEED]
        labels = [label for _, label in _SEED]
        self._pipeline = Pipeline(
            [
                ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True)),
                ("clf", LogisticRegression(max_iter=1000, class_weight="balanced")),
            ]
        )
        self._pipeline.fit(texts, labels)

    def classify(self, message: str) -> dict[str, object]:
        proba = self._pipeline.predict_proba([message])[0]
        classes = list(self._pipeline.classes_)
        top = int(proba.argmax())
        category = str(classes[top])
        return {
            "category": category,
            "confidence": round(float(proba[top]), 4),
            "priority": _PRIORITY[category],
            "scores": {c: round(float(p), 4) for c, p in zip(classes, proba)},
        }
