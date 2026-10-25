from docx import Document

doc = Document("Diagramas finales/prueba2_apa7_v2.docx")
for i in range(820, 860):
    p = doc.paragraphs[i]
    has_img = any("drawing" in r._element.xml or "picture" in r._element.xml for r in p.runs)
    img_mark = "[IMG]" if has_img else "     "
    print(f"[{i}] {img_mark} |{p.text}|")
