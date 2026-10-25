from docx import Document

doc = Document("Diagramas finales/prueba2_apa7_v2.docx")
for i in range(491, 495):
    p = doc.paragraphs[i]
    print(f"[{i}] '{p.text}'")
    for r in p.runs:
        has_img = "drawing" in r._element.xml or "picture" in r._element.xml
        print(f"  Run: '{r.text}' - Image: {has_img}")
