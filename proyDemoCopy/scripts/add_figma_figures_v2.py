import os
from docx import Document
from docx.shared import Pt

SRC = "Diagramas finales/prueba2_apa7_v2.docx"
DST = "Diagramas finales/prueba2_apa7_v2.docx"

def add_figures():
    doc = Document(SRC)
    
    # We will find the empty paragraphs with images at 496 and 499 (index might shift if we are not careful)
    # Actually, I'll search for the text preceding them to be safer.
    
    # Preceding 496: "STUDENT, TEACHER y ADMIN."
    # Preceding 499: "evaluaciones de la plataforma."
    
    idx_33 = -1
    idx_34 = -1
    
    for i, p in enumerate(doc.paragraphs):
        if "STUDENT, TEACHER y ADMIN." in p.text:
            # The next empty para should be for Figure 33
            for j in range(i+1, i+5):
                if not doc.paragraphs[j].text.strip():
                    idx_33 = j
                    break
        if "evaluaciones de la plataforma." in p.text:
            # The next empty para should be for Figure 34
            for j in range(i+1, i+5):
                if not doc.paragraphs[j].text.strip():
                    idx_34 = j
                    break
        if idx_33 != -1 and idx_34 != -1:
            break
            
    print(f"Found idx_33: {idx_33}, idx_34: {idx_34}")
    
    if idx_33 != -1:
        p33 = doc.paragraphs[idx_33]
        # Instead of p33.text = "Figura 33", we add a run to avoid deleting the image
        r = p33.add_run("Figura 33")
        r.bold = True
        
        p33_title = doc.add_paragraph()
        p33._element.addnext(p33_title._element)
        rt = p33_title.add_run("Prototipo: Gestión de Usuarios del Administrador")
        rt.italic = True
        
        p33_note = doc.add_paragraph()
        p33_title._element.addnext(p33_note._element)
        rn = p33_note.add_run("Nota. gestión de usuarios [Prototipo de interfaz], por , 2026.")
        
    if idx_34 != -1:
        # Recalculate idx_34 because we added 2 paras
        # Actually let's just find it again or use a marker
        pass

    # Re-searching for 34 after first insertion
    idx_34 = -1
    for i, p in enumerate(doc.paragraphs):
        if "evaluaciones de la plataforma." in p.text:
            for j in range(i+1, i+5):
                if not p.text.strip() and not doc.paragraphs[j].text.strip(): # Look for the empty one
                     # Actually simpler:
                     pass
    
    # Let's just do it in one go with a more robust method
    doc.save("temp.docx") # Just in case

def add_figures_safe():
    doc = Document(SRC)
    
    # Target 1: After "STUDENT, TEACHER y ADMIN."
    # Target 2: After "evaluaciones de la plataforma."
    
    targets = [
        ("STUDENT, TEACHER y ADMIN.", "Figura 33", "Prototipo: Gestión de Usuarios del Administrador", "Nota. gestión de usuarios [Prototipo de interfaz], por , 2026."),
        ("evaluaciones de la plataforma.", "Figura 34", "Prototipo: Gestión de Evaluaciones del Administrador", "Nota. gestión de evaluaciones [Prototipo de interfaz], por , 2026.")
    ]
    
    for search_text, fig_num, title, note in targets:
        for i, p in enumerate(doc.paragraphs):
            if search_text in p.text:
                # Find the next empty paragraph
                for j in range(i+1, i+5):
                    target_p = doc.paragraphs[j]
                    if not target_p.text.strip():
                        # Found the placeholder para with image
                        # Add Figure Number text to it
                        r = target_p.add_run(fig_num)
                        r.bold = True
                        
                        # Add Title para after it
                        p_title = doc.add_paragraph()
                        target_p._element.addnext(p_title._element)
                        rt = p_title.add_run(title)
                        rt.italic = True
                        
                        # Add Note para after Title
                        p_note = doc.add_paragraph()
                        p_title._element.addnext(p_note._element)
                        p_note.add_run(note)
                        break
                break # Move to next target

    doc.save(DST)
    print("Figures 33 and 34 added safely.")

if __name__ == "__main__":
    add_figures_safe()
