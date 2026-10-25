import sys, zipfile, re
path = r"C:\Users\angui\Documents\proyDemo\FORMATO PARA ENTREGA DE DOCUMENTO FINAL - 2024 3 ent_v3.docx"

z = zipfile.ZipFile(path)
print("Files in docx:")
for n in z.namelist():
    print(" ", n)

print()
print("=== settings.xml ===")
print(z.read('word/settings.xml').decode('utf-8')[:2000])

doc = z.read('word/document.xml').decode('utf-8')
print()
print("=== Heading count ===")
print("Heading 1:", doc.count('w:val="Heading1"'))
print("Heading 2:", doc.count('w:val="Heading2"'))
print("Heading 3:", doc.count('w:val="Heading3"'))
print("Caption  :", doc.count('w:val="Caption"'))
print("SEQ Tabla:", doc.count('SEQ Tabla'))
print("SEQ Figura:", doc.count('SEQ Figura'))
print("TOC fields:", doc.count(' TOC '))

# Find Heading style entries in styles.xml
styles = z.read('word/styles.xml').decode('utf-8')
print()
print("=== Heading style entries in styles.xml ===")
for m in re.finditer(r'<w:style[^>]*w:styleId="(Heading\d|Caption)"', styles):
    print(" ", m.group(1))
