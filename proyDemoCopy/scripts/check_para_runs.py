import os
from docx import Document

SRC = "Diagramas finales/prueba2_apa7_v2.docx"

def check_para_runs(idx):
    doc = Document(SRC)
    p = doc.paragraphs[idx]
    print(f"Para {idx} text: '{p.text}'")
    for r in p.runs:
        has_image = "drawing" in r._element.xml or "picture" in r._element.xml
        print(f"  Run text: '{r.text}' - Has Image: {has_image}")

if __name__ == "__main__":
    check_para_runs(491)
    print("---")
    check_para_runs(496)
    print("---")
    check_para_runs(499)
