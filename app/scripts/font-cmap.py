# Wzorzec pokrycia znaków presetów (engine/src/data/charsets.ts) odczytany z tablic cmap plików woff2 czcionek silnika,
# w kolejności stosu z src/engine/fonts.ts. Niezależny od przeglądarki wzorzec dla testu /dev/engine.
# Wymaga: pip install fonttools brotli. Uruchomienie (z app/): python3 scripts/font-cmap.py  →  src/dev/fixtures/glyph-coverage.json
import glob, json, re
from fontTools.ttLib import TTFont

STACK = [
    ('Geist Mono', 'node_modules/@fontsource/geist-mono/files/geist-mono-*-400-normal.woff2'),
    ('Noto Sans Mono', 'node_modules/@fontsource/noto-sans-mono/files/noto-sans-mono-greek-400-normal.woff2'),
    ('Noto Sans JP', 'node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-*-400-normal.woff2'),
]
cmaps = []
for family, pattern in STACK:
    cps = set()
    for f in sorted(glob.glob(pattern)): cps |= set(TTFont(f).getBestCmap().keys())
    cmaps.append((family, cps))
src = open('../engine/src/data/charsets.ts', encoding='utf8').read()
out = {}
for m in re.finditer(r"(\w+): \{ name: '[^']+', group: '\w+', ramp: '([^']*)' \}", src):
    out[m.group(1)] = {c: next((fam for fam, cps in cmaps if ord(c) in cps), 'none') for c in dict.fromkeys(m.group(2)) if c != ' '}
open('src/dev/fixtures/glyph-coverage.json', 'w', encoding='utf8').write(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
none = {k: ''.join(c for c, v in d.items() if v == 'none') for k, d in out.items()}
print(len(out), 'presetów; bez żadnej czcionki:', {k: v for k, v in none.items() if v})
