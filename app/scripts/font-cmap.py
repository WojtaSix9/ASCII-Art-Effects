# Pokrycie znaków presetów (engine/src/data/charsets.ts) przez Geist Mono 400, odczytane z tablic cmap plików woff2.
# Niezależny wzorzec dla testu w przeglądarce (/dev/engine). Wymaga: pip install fonttools brotli
# Uruchomienie (z app/): python3 scripts/font-cmap.py  →  src/dev/fixtures/geist-mono-coverage.json
import glob, json, re
from fontTools.ttLib import TTFont

cps = set()
for f in sorted(glob.glob('node_modules/@fontsource/geist-mono/files/geist-mono-*-400-normal.woff2')):
    cps |= set(TTFont(f).getBestCmap().keys())
src = open('../engine/src/data/charsets.ts', encoding='utf8').read()
out = {}
for m in re.finditer(r"(\w+): \{ name: '[^']+', group: '\w+', ramp: '([^']*)' \}", src):
    chars = [c for c in dict.fromkeys(m.group(2)) if c != ' ']
    out[m.group(1)] = {'covered': ''.join(c for c in chars if ord(c) in cps), 'missing': ''.join(c for c in chars if ord(c) not in cps)}
open('src/dev/fixtures/geist-mono-coverage.json', 'w', encoding='utf8').write(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
print(len(out), 'presetów;', sum(1 for v in out.values() if not v['missing']), 'w pełni pokrytych')
