# test_social_insights.py (pytest) => RF-15.10 emociones y RF-15.11 causas de lo negativo.

from app.module.sentiment_analysis.ml.social_insights import analyze_text, insights


def test_analyze_text_labels_and_emotions() -> None:
    assert analyze_text("Me encanta, excelente calidad")["label"] == "positive"
    assert analyze_text("No es bueno")["label"] == "negative"  # Negación invierte la polaridad
    mixed = analyze_text("Excelente producto pero llegó tarde, malo el envío")
    assert mixed["label"] == "mixed"
    assert mixed["emotions"]["frustration"] > 0


def test_insights_groups_negative_causes_with_examples() -> None:
    texts = [
        {"id": "1", "text": "El envío llegó tarde, pésimo"},
        {"id": "2", "text": "Horrible, la entrega demora mucho"},
        {"id": "3", "text": "Me encanta, excelente"},
    ]
    result = insights(texts)
    assert result["summary"]["total"] == 3
    assert result["negative_causes"][0]["cause"] == "entrega"
    assert result["negative_causes"][0]["count"] == 2
    assert "entrega" in result["conclusion"]
