import os
import re
from docx import Document
from docx.shared import Pt, Inches

SRC = "Diagramas finales/prueba2_apa7_v2.docx"
DST = "Diagramas finales/prueba2_apa7_v2.docx"

def fix_all_figures_preserving_images():
    doc = Document(SRC)
    
    # Identify paragraphs with images
    image_indices = []
    for i, p in enumerate(doc.paragraphs):
        if any("drawing" in r._element.xml or "picture" in r._element.xml for r in p.runs):
            image_indices.append(i)
            
    print(f"Total paragraphs with images: {len(image_indices)}")

    # We will identify the sequence of tests figures starting from Fig 33 (Admin)
    # Figura 32 is at 431.
    # The Admin images are:
    # 432 (empty text + image) -> should be Fig 33
    # 433 (empty text + image) -> should be Fig 34
    
    # Then Frontend unit:
    # 679 (Fig 33 text + image) -> should be Fig 35
    # 683 (Fig 34 text + image) -> should be Fig 36
    
    # 1. First, fix the Admin images at 432 and 433 which are unlabeled
    # Note: 432 is AFTER 431 (Fig 32)
    p33 = doc.paragraphs[432]
    # We must not delete the image. Prepend text.
    p33.text = "Figura 33" # In python-docx, setting .text clears runs.
    # TO PRESERVE IMAGE: Add a run at the start.
    # BUT p.text = ... is bad.
    
    def prepend_text_to_image_para(p, text, style=None):
        # Create a new run at the beginning
        from docx.oxml import OxmlElement
        new_run = p.insert_paragraph_before().add_run(text)
        if style:
            # Applying style to the whole paragraph is easier
            p.insert_paragraph_before().style = style
        # Move the newly created paragraph's content to the target paragraph
        # This is complex. Simpler: 
        # Add a paragraph BEFORE the image paragraph for the Label.
        # Add another for the Title.
        return
        
    def add_label_and_title_before(target_p, fig_num, title, note_text):
        # target_p is the one with the image
        label_p = target_p.insert_paragraph_before(f"Figura {fig_num}")
        label_p.style = "Figure Label"
        
        title_p = target_p.insert_paragraph_before(title)
        title_p.style = "Caption"
        for r in title_p.runs: r.italic = True
        
        # The note is usually after the image.
        note_p = doc.add_paragraph(note_text)
        target_p._element.addnext(note_p._element)
        note_p.style = "Figure Note"

    # Let's perform a safer sequence from Fig 33 onwards.
    # Since I cannot easily detect which image is which automatically without risking errors,
    # I will perform a manual-like sequence based on the verified indices.
    
    # Figure 33 & 34 (Admin)
    # Index 432 has the first Admin image
    # Index 433 has the second Admin image
    
    # Figure 35 (Frontend Unit 1) - index 679 (already has "Figura 33")
    # Figure 36 (Frontend Unit 2) - index 683 (already has "Figura 34")
    
    # Step 1: Sequential renumbering of all EXISTING "Figura X" from 1 to 55
    # This will fix the 33, 34 duplicates and the wrong numbers.
    current_fig = 1
    for i, p in enumerate(doc.paragraphs):
        match = re.search(r'Figura (\d+)', p.text)
        if match:
            # Split Fig 48 malformed if found
            if "Figura 48" in p.text and len(p.text) > 20:
                 # Extract title
                 pass
            
            old_label = match.group(0)
            new_label = f"Figura {current_fig}"
            
            # Preserve runs (images)
            for r in p.runs:
                if old_label in r.text:
                    r.text = r.text.replace(old_label, new_label)
            
            if old_label in p.text and new_label not in p.text:
                p.text = p.text.replace(old_label, new_label)
            
            current_fig += 1
            
    # Step 2: Now insert the labels for the images that were truly missing labels (432, 433)
    # AND the feedback ones (around 730).
    
    doc.save(DST)
    print("Renumbering complete. Now adding missing ones.")

if __name__ == "__main__":
    # I will use a different strategy: 
    # Just fix the specific reported gap after Figura 48 (which was Paso 3).
    # In the restored document, Figura 45 is at 726.
    # Then there is text at 727.
    # Then there is Figura 46 at 739.
    
    # Gap after 726:
    # 728: heading "Pruebas de funcionalidades del módulo de feedback"
    # 729: image paragraph
    # 730: image paragraph
    
    doc = Document(SRC)
    
    # Renumber from 46 upwards (+2) to make room for Feedback and Plan Estudio
    def renum(start_num, incr):
        for p in reversed(doc.paragraphs):
            m = re.search(r'Figura (\d+)', p.text)
            if m:
                n = int(m.group(1))
                if n >= start_num:
                    old = f"Figura {n}"
                    new = f"Figura {n + incr}"
                    for r in p.runs:
                        if old in r.text: r.text = r.text.replace(old, new)
                    if old in p.text and new not in p.text:
                        p.text = p.text.replace(old, new)

    renum(46, 2)
    
    # Insert Figura 46 at 729
    p46_img = doc.paragraphs[729]
    p46_label = p46_img.insert_paragraph_before("Figura 46")
    p46_label.style = "Figure Label"
    p46_title = p46_img.insert_paragraph_before("Pruebas Funcionales: Módulo de Feedback con IA")
    p46_title.style = "Caption"
    for r in p46_title.runs: r.italic = True
    p46_note = doc.add_paragraph("Nota. pruebas funcionales: módulo de feedback con IA, por , 2026.")
    p46_img._element.addnext(p46_note._element)
    p46_note.style = "Figure Note"
    
    # Insert Figura 47 at 730 (which is now 733 due to insertions)
    p47_img = doc.paragraphs[733]
    p47_label = p47_img.insert_paragraph_before("Figura 47")
    p47_label.style = "Figure Label"
    p47_title = p47_img.insert_paragraph_before("Pruebas Funcionales: Generación de Planes de Estudio con IA")
    p47_title.style = "Caption"
    for r in p47_title.runs: r.italic = True
    p47_note = doc.add_paragraph("Nota. pruebas funcionales: generación de planes de estudio con IA, por , 2026.")
    p47_img._element.addnext(p47_note._element)
    p47_note.style = "Figure Note"

    # Also fix the duplicate 33, 34 at 679 and 683
    # Shift everything from 33 (679) upwards by 2
    # Wait, 33 and 34 were Admin ones? No, Admin was 31, 32... 
    # Let's check Admin again.
    # 431: Figura 32. 
    # 432: Image (Admin 1)
    # 433: Image (Admin 2)
    
    # Re-running renumbering to include Admin fix
    # Shift everything from 33 upwards (which currently is at 679) by 2.
    # No, first insert 33 and 34.
    
    doc.save(DST)
    print("Feedback figures added. Now fixing Admin figures.")
