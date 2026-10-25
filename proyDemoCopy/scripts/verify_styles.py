from docx import Document

doc = Document("Diagramas finales/prueba2_apa7_v2.docx")
for idx in [491, 492, 493, 496, 497, 498, 500, 501, 502]:
    p = doc.paragraphs[idx]
    is_italic = p.runs[0].italic if p.runs else False
    print(f"[{idx}] Style: {p.style.name:15} | Italic: {str(is_italic):5} | Text: {p.text}")
