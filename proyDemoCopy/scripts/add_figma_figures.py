import os
from docx import Document
from docx.shared import Pt

SRC = "Diagramas finales/prueba2_apa7_v2.docx"
DST = "Diagramas finales/prueba2_apa7_v2.docx" # Overwrite

def add_missing_figures():
    if not os.path.exists(SRC):
        return

    doc = Document(SRC)
    
    # We found Figura 32 at index 491 (in the previous script run)
    # Let's find it again to be sure
    fig32_idx = -1
    for i, p in enumerate(doc.paragraphs):
        if "Figura 32" in p.text:
            fig32_idx = i
            break
            
    if fig32_idx == -1:
        print("Figura 32 not found")
        return

    # Image 1 is at index 496 (relative to start of section, but let's use search)
    # Paragraph 496 is empty but has an image.
    # Paragraph 499 is empty but has an image.
    
    # I will insert paragraphs AFTER the images or BEFORE?
    # Usually it's:
    # [IMAGE]
    # Figura XX
    # Título
    # Nota
    
    # Or:
    # Figura XX
    # Título
    # [IMAGE]
    # Nota
    
    # Looking at Figura 32 (491):
    # [491] [IMAGE] Figura 32
    # [492] [IMAGE] Prototipo: Dashboard del Administrador
    # [493] [IMAGE] Nota. dashboard del administrador...
    
    # Wait, 491 has the image AND the text "Figura 32"? 
    # Let's re-examine 491 runs.
    
    # Actually, I'll just insert them where 496 and 499 are.
    
    # For 496:
    p496 = doc.paragraphs[496]
    p496.text = "Figura 33"
    # Add Title and Note after 496
    p33_title = doc.add_paragraph("Prototipo: Gestión de Usuarios del Administrador")
    p496._element.addnext(p33_title._element)
    p33_note = doc.add_paragraph("Nota. gestión de usuarios [Prototipo de interfaz], por , 2026.")
    p33_title._element.addnext(p33_note._element)
    
    # For 499:
    # Indices shift! So I should find them by content or index from the end or just carefully.
    # If I insert 2 paras after 496, then 499 becomes 501.
    
    p499 = doc.paragraphs[501] # 499 + 2
    p499.text = "Figura 34"
    p34_title = doc.add_paragraph("Prototipo: Gestión de Evaluaciones del Administrador")
    p499._element.addnext(p34_title._element)
    p34_note = doc.add_paragraph("Nota. gestión de evaluaciones [Prototipo de interfaz], por , 2026.")
    p34_title._element.addnext(p34_note._element)

    doc.save(DST)
    print("Figures 33 and 34 added.")

if __name__ == "__main__":
    add_missing_figures()
