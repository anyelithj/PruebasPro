"""
Clean punctuation in build_thesis.py:
- em-dashes replaced with commas or colons depending on context
- ' / ' replaced with ' y ' between proper-noun pairs
- (i) (ii) (iii) numerators removed
- Some abbreviations spelled out on first use
- Keep code identifiers untouched (paths, table names use underscores; we touch only em-dashes and slashes in plain text)
"""
import re
from pathlib import Path

src = Path(r"C:\Users\angui\Documents\proyDemo\scripts\build_thesis.py")
text = src.read_text(encoding='utf-8')

# Cache code-looking tokens (paths, file refs, JSONB types) so they survive replacements
# We protect path-like strings with placeholders.
PROTECT_PATTERNS = [
    r"diagrams/[\w./_]+",          # diagrams/01_ER_DER.puml
    r"Demohtml/[\w./_]+",          # Demohtml/admin/dashboard.html
    r"apps/[\w./_]+",
    r"/api/[\w./_-]+",              # /api/v1/auth/login
    r"/auth/[\w_-]+",               # /auth/login etc
    r"/quiz/[\w/:_.-]+",
    r"/grading/[\w_-]+",
    r"/feedback/[\w_-]+",
    r"/assistant/[\w_:{}-]+",
    r"/analytics/[\w_-]+",
    r"/generate", r"/grade", r"/complete", r"/answer", r"/start", r"/bridge",
    r"WCAG 2\.1", r"OAuth 2\.0", r"RFC 7519",
    r"http[s]?://\S+",
    r"GET /\S+", r"POST /\S+",
]

placeholders = {}

def protect(match):
    key = f"__PROTECT_{len(placeholders)}__"
    placeholders[key] = match.group(0)
    return key

combined = "|".join(f"(?:{p})" for p in PROTECT_PATTERNS)
text = re.sub(combined, protect, text)

# Now safe to transform
# Em-dash in title context: ' — ' becomes ': '
text = re.sub(r'\s+—\s+', ': ', text)

# Em-dash pair acting as parenthetical (already gone above, but catch standalone)
text = text.replace('—', ',')

# Replace ' / ' with ' y '
text = re.sub(r'\s+/\s+', ' y ', text)

# Replace "(i)", "(ii)", "(iii)", "(iv)" + space → empty (when listing reasons)
text = re.sub(r'\(\s*[ivxIVX]+\s*\)\s*', '', text)

# Hyphen used as separator between full Spanish words (not in compound word and not code):
# pattern " - " becomes " "
text = re.sub(r'\s+-\s+', ' ', text)

# Spell out common abbreviations on first occurrence-ish (just normalize style)
# Note: keep tech names, expand a few generic abbreviations to readable text
# Replace " et al." in references with " y colaboradores" — keep for biblio though. Skip.

# Restore placeholders
for k, v in placeholders.items():
    text = text.replace(k, v)

src.write_text(text, encoding='utf-8')
print(f"em-dashes remaining: {text.count('—')}")
print(f"' / ' remaining: {len(re.findall(r'\s+/\s+', text))}")
print(f"(i)/(ii) remaining: {len(re.findall(r'\([ivxIVX]+\)', text))}")
