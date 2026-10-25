import os
from docx import Document

SRC = "Diagramas finales/prueba2_apa7_v2.docx"

def inspect_range_45_46():
    if not os.path.exists(SRC):
        print(f"Error: {SRC} not found")
        return

    doc = Document(SRC)
    start_idx = -1
    end_idx = -1
    
    for i, p in enumerate(doc.paragraphs):
        if "Figura 45" in p.text:
            start_idx = i
        if "Figura 46" in p.text:
            end_idx = i
            break
            
    if start_idx == -1:
        print("Figura 45 not found")
        return
    if end_idx == -1:
        # Maybe it's further down, let's keep searching but print what we have
        print("Figura 46 not found yet, searching further...")
        end_idx = len(doc.paragraphs)

    print(f"--- Inspection from Figura 45 (index {start_idx}) to Figura 46 (index {end_idx}) ---")
    for i in range(start_idx, min(end_idx + 10, len(doc.paragraphs))):
        p = doc.paragraphs[i]
        text = p.text.strip()
        has_image = any("drawing" in r._element.xml or "picture" in r._element.xml for r in p.runs)
        img_mark = "[IMAGE]" if has_image else ""
        style = p.style.name
        print(f"[{i}] {img_mark} Style: {style:15} | Text: {text}")

if __name__ == "__main__":
    inspect_range_45_46()
