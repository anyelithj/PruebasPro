"""
Second-pass cleanup of build_thesis.py:
- Remove inline abbreviation parentheticals like ' (LLM)', ' (SSR)', ' (DDD)'
- Keep year citations (2025), (Zhang & Aslan, 2021), code IDs in tables.
"""
import re
from pathlib import Path

src = Path(r"C:\Users\angui\Documents\proyDemo\scripts\build_thesis.py")
text = src.read_text(encoding='utf-8')

# Patterns to delete (each is " (ABBREV)" attached to preceding word)
ABBREV_PARENS = [
    'LLM', 'SSR', 'SSG', 'DDD', 'JWT', 'CORS', 'mTLS', 'ASGI', 'JWKS',
    'ACID', 'OIDC', 'ORM', 'CSS', 'IDE', 'DOM', 'BFF', 'TTL', 'WSS',
    'SLA', 'SRP', 'DIP', 'NLP', 'RAG', 'OMG', 'OAuth', 'OpenID Connect',
    'opción múltiple', 'verdadero/falso',
]

for abbr in ABBREV_PARENS:
    pattern = r' \(' + re.escape(abbr) + r'\)'
    text = re.sub(pattern, '', text)

# Also drop "(MC|TF|OPEN)" style enum hints if they appear in prose (not in entity attrs table).
# These actually appear in table data ['type', 'ENUM[MC|TF|OPEN]'] — table content, leave alone.

# Remove " (RFC 7519)" if present in prose
text = re.sub(r' \(RFC \d+\)', '', text)

# Reduce ", por ejemplo," to ", por ejemplo,"  (no-op safety)

# Save
src.write_text(text, encoding='utf-8')
print("Done. Sample diff:")
for line in text.splitlines():
    if '(LLM)' in line or '(SSR)' in line or '(DDD)' in line:
        print(" REMAINING:", line[:120])
