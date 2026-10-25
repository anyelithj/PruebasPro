import os
from docx import Document

SRC = "Diagramas finales/prueba2_apa7_v2.docx"
DST = "Diagramas finales/prueba2_apa7_v2.docx"

def fix_styles_and_structure():
    doc = Document(SRC)
    
    # Indices from previous inspection:
    # Fig 33 starts at 496
    # Fig 34 starts at 500
    
    # Blocks to fix:
    # 496: Figura 33 (Figure Label)
    # 497: Prototipo... (Caption)
    # 498: Nota... (Figure Note)
    
    # 500: Figura 34 (Figure Label)
    # 501: Prototipo... (Caption)
    # 502: Nota... (Figure Note)
    
    indices = [496, 497, 498, 500, 501, 502]
    styles = ["Figure Label", "Caption", "Figure Note", "Figure Label", "Caption", "Figure Note"]
    
    for idx, style_name in zip(indices, styles):
        p = doc.paragraphs[idx]
        try:
            p.style = style_name
        except Exception as e:
            print(f"Error applying style {style_name} to para {idx}: {e}")
            
    # Also ensure the titles are correctly italicized if Caption doesn't do it
    # And check the text of the notes
    
    p498 = doc.paragraphs[498]
    # Check if "Nota. " is at the start and the rest is correct
    # Current: Nota. gestión de usuarios [Prototipo de interfaz], por , 2026.
    
    p502 = doc.paragraphs[502]
    # Current: Nota. gestión de evaluaciones [Prototipo de interfaz], por , 2026.

    doc.save(DST)
    print("Styles and structure updated for Figures 33 and 34.")

if __name__ == "__main__":
    fix_styles_and_structure()
