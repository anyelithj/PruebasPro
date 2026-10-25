import os
import re
from docx import Document

SRC = "Diagramas finales/prueba2_apa7_v2.docx"
DST = "Diagramas finales/prueba2_apa7_v2.docx"

def full_renumber_and_fix():
    doc = Document(SRC)
    
    # 1. Clear all current figure labels to avoid confusion during renumbering
    # Actually, better to just go in order and update them.
    
    # Current figure indices and their correct numbers:
    # 1-32 are correct.
    # [496] 33 OK
    # [500] 34 OK
    
    # Let's collect all figure labels in the document
    fig_labels = []
    for i, p in enumerate(doc.paragraphs):
        if re.search(r'Figura \d+', p.text):
            fig_labels.append(i)
            
    # We also need to insert labels for the missing ones.
    # Missing 1: Paragraph 823 (Feedback IA)
    # Missing 2: Paragraph 824 (Plan Estudios IA)
    # Missing 3: Paragraph 840 (Generación Cuestionarios) -- wait, I already added 49 there in previous turn.
    
    # Let's just re-run the whole thing sequentially.
    
    current_num = 1
    for i, p in enumerate(doc.paragraphs):
        # Specific fix for malformed ones or missing ones:
        if i == 823 and "Pruebas de funcionalidades del módulo de feedback" in p.text:
             # This is a heading, the image is at 824? No, 823 has text AND image.
             # Actually let's just insert labels where images are.
             pass

    # A better way: Identify every image paragraph and ensure it has a unique, consecutive label.
    
    image_paras = []
    for i, p in enumerate(doc.paragraphs):
        has_img = any("drawing" in r._element.xml or "picture" in r._element.xml for r in p.runs)
        if has_img:
            # Check if it already has a label nearby
            # Most figures have [Label] [Title] [Image] or [Image] [Label] [Title]
            # Looking at previous turn, most are [Label] [Title] [Note] AND the label para has the image.
            image_paras.append(i)

    # This is getting complicated. Let's stick to simple sequential re-labeling.
    
    # Step 1: Sequential renumbering of all existing "Figura X"
    current_fig = 1
    for i, p in enumerate(doc.paragraphs):
        # Find Figura X (ignoring existing number)
        match = re.search(r'Figura \d+', p.text)
        if match:
            old_label = match.group(0)
            new_label = f"Figura {current_fig}"
            
            # Replace in runs
            for r in p.runs:
                if old_label in r.text:
                    r.text = r.text.replace(old_label, new_label)
            # Replace in text if runs missed it
            if old_label in p.text and new_label not in p.text:
                p.text = p.text.replace(old_label, new_label)
            
            current_fig += 1
            
        # Step 2: Insert missing ones in the gaps
        if "Figura 47" in p.text and i == 816:
             # Next missing should be at 823 and 824
             # But if I do it this way, I need to know where to insert.
             pass

    doc.save(DST)
    print("Sequential renumbering done. Now checking for missing ones.")

if __name__ == "__main__":
    # Instead of a full renumber which might be risky, let's just do exactly what's needed.
    # 1. Fix duplicate 33, 34 at 745, 751.
    # 2. Insert missing ones at 823, 824.
    # 3. Renumber everything after 33 (745) to be consecutive.
    
    doc = Document(SRC)
    
    # Mapping of current indices to new numbers:
    # 745: 33 -> 35
    # 751: 34 -> 36
    # 757: 35 -> 37
    # 763: 36 -> 38
    # 769: 37 -> 39
    # 775: 38 -> 40
    # 782: 39 -> 41
    # 788: 40 -> 42
    # 792: 41 -> 43
    # 796: 42 -> 44
    # 806: 43 -> 45
    # 811: 44 -> 46
    # 816: 45 -> 47
    
    # Gaps:
    # 823 -> 48 (Feedback)
    # 824 -> 49 (Plan Estudios)
    
    # 827: 48 -> 50
    # 840: 49 -> 51 (Gen Quiz)
    # 843: 50 -> 52 (Paso 4)
    # 847: 51 -> 53 (Paso 1 Gen)
    # 851: 52 -> 54 (Paso 2 Gen)
    # 855: 53 -> 55 (Paso 3 Gen)
    
    # Renumbering function
    def renumber_from(doc, start_idx, increment):
        for i in range(start_idx, len(doc.paragraphs)):
            p = doc.paragraphs[i]
            match = re.search(r'Figura (\d+)', p.text)
            if match:
                num = int(match.group(1))
                old_label = f"Figura {num}"
                new_label = f"Figura {num + increment}"
                for r in p.runs:
                    if old_label in r.text:
                        r.text = r.text.replace(old_label, new_label)
                if old_label in p.text and new_label not in p.text:
                    p.text = p.text.replace(old_label, new_label)

    # Apply renumbering first (from the bottom up to avoid conflicts)
    # Start renumbering from the end.
    
    # Fix duplicates 33, 34 at 745, 751 -> they should become 35, 36.
    # This means everything from 745 onwards increments by 2.
    renumber_from(doc, 745, 2)
    
    # Now the sequence is: 32, 33, 34 (Admin), 35, 36 (Unit), ... 47 (816).
    # Gaps 48, 49 are still needed.
    # Everything after 816 should increment by another 2.
    renumber_from(doc, 817, 2)
    
    # Now we have gaps for 48 and 49.
    
    # Insert 48 at 823
    p48 = doc.paragraphs[823]
    p48.text = "Figura 48" + p48.text # Prepend to heading
    p48.style = "Figure Label"
    # Actually better to insert a new para.
    new_p48 = doc.add_paragraph("Figura 48")
    p48._element.addbefore(new_p48._element)
    new_p48.style = "Figure Label"
    
    p48_title = doc.add_paragraph("Pruebas Funcionales: Módulo de Feedback con IA")
    new_p48._element.addnext(p48_title._element)
    p48_title.style = "Caption"
    
    p48_note = doc.add_paragraph("Nota. pruebas funcionales: módulo de feedback con IA, por , 2026.")
    p48_title._element.addnext(p48_note._element)
    p48_note.style = "Figure Note"
    
    # Insert 49 at 824
    p49 = doc.paragraphs[827] # shifted
    new_p49 = doc.add_paragraph("Figura 49")
    p49._element.addbefore(new_p49._element)
    new_p49.style = "Figure Label"
    
    p49_title = doc.add_paragraph("Pruebas Funcionales: Generación de Planes de Estudio con IA")
    new_p49._element.addnext(p49_title._element)
    p49_title.style = "Caption"
    
    p49_note = doc.add_paragraph("Nota. pruebas funcionales: generación de planes de estudio con IA, por , 2026.")
    p49_title._element.addnext(p49_note._element)
    p49_note.style = "Figure Note"

    doc.save(DST)
    print("Full renumbering and gap filling completed.")
