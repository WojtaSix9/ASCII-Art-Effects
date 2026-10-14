# Silnik efektów obrazkowych v1: stan i przekazanie

Stan na 14 X 2026. Kod: `ascii-effects-engine-v1.zip` (po rozpakowaniu `npm install`; Node 22 uruchamia `.ts` bezpośrednio: bez parameter properties, importy z rozszerzeniem `.ts`). Uzupełnia `00-brief-dla-claude-code.md` i `05-ui-dla-claude-code.md`.

Oznaczenia: `test` = sprawdzone testem (Node 22, piaskownica), `oko` = oceniłem wzrokowo na obrazie syntetycznym, `proj` = decyzja projektowa, `docs` = z plików 01–02, `BRAK` = nie zrobione.

---

## 1. Co jest

**Architektura (`proj`):** czysty TypeScript na buforach RGBA (`Uint8ClampedArray`), **bez DOM**: ten sam kod działa w Node i w przeglądarce (docelowo Web Worker). Silnik jest wzorcem referencyjnym (CPU); jeśli któryś efekt okaże się za wolny na żywo, Claude Code może go przenieść na WebGL i porównywać z wersją CPU.

| Element | Status |
|---|---|
| **18 efektów Fazy 1** (plik 02, sekcja 12): Characters, Block, Braille, Dots, Cross, Diamond, Lines, Diagonal, Pixel Art, Mosaic, LEGO, Hex Mosaic, Disco, Halftone, Posterize, Duotone, Gradient Map, Dither | `test` + `oko` |
| **Dither:** 15 algorytmów (Bayer 2/4/8/16, klastrowy, radialny, linie H/V/D, szum biały i niebieski, Floyd–Steinberg, Atkinson, Stucki, Sierra Lite) × 15 palet | `test` |
| **Eksport tekstowy** (Characters, Block, Braille) | `test` |
| **Backdrop** (blur, solid, original, none, softness, opacity), parametry wspólne (coverage, brightness, contrast, invert, seed) | `test` |
| **Color:** 8 presetów, tint + blend, saturation, vibrance, hue, grayscale, invert | `test` |
| **Post FX: 13 z 16 darmowych:** blur, vignette, scan lines, bloom, chromatic, RGB split, CRT curvature, glitch, film grain, pixelate, film dust, sharpen, noise (stała kolejność) | `test` |
| **Skala eksportu:** ten sam render w skali 1–8× (wartości w px mnożone przez skalę) | `test` |
| **Rejestr 91 efektów** `src/data/effects.json` wygenerowany z pliku 02 (id, nazwa, kategoria, silnik, złożoność, opis, faza, status `ready`/`soon`) | `test` |

**Nie ma (`BRAK`):** 73 efekty Faz 2–3; post FX Character Bloom, Character Chroma, Halftone (post); Lights; warstwa tekstu; Levels i Curves; Photo Filter i Gradient Map w zakładce Color; animacje; testy w Safari i Firefoksie; ocena na prawdziwych zdjęciach. Integracja z przeglądarką (Worker, OffscreenCanvas, webfont) i test w Chromium: sekcja 7.

## 2. API (`src/index.ts`)

```ts
import { render, renderText, EFFECTS, getEffect, canvasGlyphs } from './src/index.ts';
const glyphs = canvasGlyphs((w, h) => new OffscreenCanvas(w, h), '"Geist Mono", monospace'); // w Node: @napi-rs/canvas
const { img, info } = render(src /* {w,h,data:RGBA} */, {
  style: { id: 'dither', params: { algorithm: 'floyd', palette: 'gameboy' } },
  postFx: { vignette: { intensity: 40 }, noise: true },   // true = parametry domyślne; false/brak = wyłączony
  color: { preset: 'sepia' },
}, { scale: 2, glyphs });                                   // scale: 0,1–8 (eksport = ten sam render w większej skali)
const txt = renderText(src, { style: { id: 'braille' } });  // null dla efektów bez wersji tekstowej
```
- Każdy efekt deklaruje `params` (`ParamDef`: `kind` range/select/toggle/color/text/seed/gradient, `min`, `max`, `default`, `level` main/advanced, `px`), z których UI ma budować panel. `resolveParams` uzupełnia domyślne, **obcina zakresy** i **rzuca błąd** dla nieznanego klucza, złej opcji, NaN i złego koloru.
- `info` (np. `cols`, `rows`, `cells`) służy testom i UI.
- Glify: tylko `characters` potrzebuje `GlyphProvider`; pozostałe rysują kształty własnym kodem (pola odległości z antyaliasingiem), więc **nie zależą od czcionki**.

## 3. Wyniki testów (`node scripts/check-engine.ts` → `reports/engine-check.txt`): 81 z 81

Testy sprawdzają **własności**, nie tylko „uruchamia się”:
- Każdy efekt: wymiary, dwa renderowania bit w bit, alfa 255.
- **Skala 2×:** identyczna liczba komórek dla wszystkich 18 efektów; obraz po zmniejszeniu podobny do renderu 1× (PSNR ≥ 17,6 dB; najniżej mosaic 18 dB i dither 18 dB).
- **Coverage:** 100% = wszystkie komórki, 0% = brak, malejąco; komórki widoczne przy 50% są podzbiorem widocznych przy 80% (stabilne w animacji).
- **Characters:** jaśniejszy ton = gęstszy znak (monotonicznie), `invert` odwraca, tekst zgodny z obrazem (0 z 1000 niezgodnych).
- **Dither:** mono daje tylko czerń i biel; średnia jasność zachowana (odchylenie ≤ 0,002 na gradiencie); 210 kombinacji algorytm × paleta używa wyłącznie kolorów palety; udział bieli rośnie z tonem; szum niebieski jest permutacją rang, a wariancja gęstości w blokach 8×8 to 1,41 wobec 16,17 dla białego szumu.
- Posterize, Duotone, Gradient Map (dokładne wartości), Pixel Art/Mosaic (jednolite bloki), Hex Mosaic (liczba komórek ≈ pole / 2,598 R² ±20%), Halftone (ciemniej = więcej tuszu), Backdrop (solid, original, none, blur), Post FX (wartości neutralne = bez zmian, stała kolejność, seed, skalowanie px), Color (B&W, saturacja 0, podwójne odwrócenie, hue ×2).
- **Błędy testów, które znalazłem po drodze:** szarości 32/96/160/224 leżały dokładnie na progach Bayera 2×2 (test źle dobrany); Atkinson ma z natury odchylenie do 0,12 na skrajnych tonach (rozprasza tylko 6/8 błędu); progi tolerancji dla bayer2, atkinson i linesH/V ustawiłem **po pomiarze** (0,13), a próg PSNR szybkiego rozmycia tła (35 dB) po pomiarze 36,5 dB.

## 4. Wydajność (`reports/bench.txt`, obraz 1600×1067, mediana z 3, piaskownica, orientacyjnie)

pixel 29 ms, disco 24, mosaic 32, duotone 43, dither 58 (Bayer 8×8; bayer8 + szum niebieski + Floyd z paletą PICO-8 łącznie 487 ms), posterize 61, diamond 129, block 130, gradientmap 140, dots 152, lines 152, braille 153, characters 166, diagonal 194, lego 212, cross 230, hexmosaic 255, **halftone 636 ms**. Post FX przy stylu pixel: od 24 ms (dust, glitch) do 422 ms (bloom) i 342 ms (blur).
- Do podglądu na żywo (suwak) cel ~100 ms jest spełniony tylko przez część efektów. Halftone, bloom, blur i sharpen są kandydatami do optymalizacji lub WebGL. Pomiar w przeglądarce `BRAK`.
- Rozmycie tła liczone w mniejszej rozdzielczości dało 2,5–4× przyspieszenie (characters 506 → 166 ms) kosztem ok. 36,5 dB względem pełnego rozmycia.

## 5. Decyzje i znane rozbieżności

1. **Characters: jasny = gęsty znak** (tekst jasny na ciemnym tle; `invert` odwraca). **Rozstrzygnięte przez użytkownika** (brief 00, sekcja 3). Opis w pliku 02 i w `effects.json` poprawiono zgodnie z silnikiem (brief 00, sekcja 4). Automatyczne odwracanie dla jasnego tła: opcja na później.
2. **Kontrast:** nasza definicja, neutralny = 0 (zakres −100…100). Docs oryginału mają sprzeczne dane (plik 01, sekcja 10).
3. **Paleta Dither:** dokładne kolory znamy tylko dla Game Boy (docs). Pozostałe to publiczne standardy (PICO-8, C64, CGA) lub nasze projekty (`proj`); `src/data/palettes.ts` ma pole `source`. Paleta LEGO to przybliżenie 24 kolorów, nie „official LEGO Art colour set”.
4. **Braille:** rozmiar to rozstaw kropek (`dotPitch`), komórka = 2×4 kropki, dzięki czemu siatka skaluje się dokładnie; domyślnie rozpraszanie Bayera na kropkach (bez niego tarcza o jasności 0,35 znikała).
5. **Zaokrąglenia siatki znakowej:** szerokość komórki to `round(0,6 × rozmiar)`, więc dla nieparzystych rozmiarów (np. 11) liczba kolumn przy 2× może się różnić o jeden. Testy używają rozmiarów domyślnych (10).
6. **Dither linie H/V:** okres wzoru 8 px (przy `pixelSize` > 1 odpowiednio większy), czyli zgrubna rozdzielczość tonalna; okres nie jest parametrem.
7. **Tile coverage** pomija komórki ciemniejsze od progu (docs), siatka znakowa wycina komórki po haszu (docs). Hex Mosaic nie ma coverage.
8. **Brak ocen na prawdziwych zdjęciach:** efekty oceniłem na obrazie syntetycznym (gradient, chmury z szumu, kształty, paski) i testach. Wygląd na zdjęciach (twarze, skóra, tekstury) `BRAK`.
9. **Efekty nieoznaczone fazą w pliku 02:** 23 (m.in. Mixed, Warhol, Cyanotype, Mezzotint, Specimen, Lattice, Topography, Forms, Schematic, Neon Grid, Forensics, Digital Distortion, Lofi, Beacon, Anaglyph 3D, Prism, Dreamdust, Light Wind, Kaleidoscope, Warpbloom, Waves, Molten Metal, Emboss) dostały w `effects.json` fazę 3 z `phaseAssigned: false`. Do przypisania.

## 6. Plan dla Claude Code (małe kroki, każdy z testem i raportem)

1. **Integracja z przeglądarką:** silnik w Web Workerze, `OffscreenCanvas` do masek znaków, czcionka z npm (sekcja 2.3 pliku 05). Test: pokrycie znaków w 16 presetach (Braille, Katakana, Dots, Geometric, Math); pomiar czasu każdego efektu w przeglądarce; pamięć przy wielokrotnym renderze.
2. **Podpięcie do UI** wg pliku 05: panel parametrów z `params`, rejestr z `effects.json`, miniatury z jednego zdjęcia roboczego.
3. **Optymalizacja** efektów > 100 ms (halftone, bloom, blur, sharpen), z zachowaniem testów jako wzorca (porównanie CPU i WebGL).
4. **Brakujące elementy Fazy 1:** Character Bloom i Chroma (per glif), post-halftone, Lights, warstwa tekstu, Photo Filter.
5. **Faza 2 i 3** wg pliku 02 (do dopracowania przez Claude Code, zgodnie z decyzją użytkownika); każdy efekt z definicją `params`, testem własności i wpisem w `effects.json` (`status: ready`).
6. **Eksport PNG:** limity kanwy (Safari/iOS), skala 1–4×, zgodność z podglądem.

## 7. Stan w przeglądarce (krok 2 briefu 00, 14 X 2026)

Kod: `app/src/engine/` (Worker, klient), strona testowa `/dev/engine`, wynik: `app/reports/browser-engine.txt`. Uruchomienie: `cd app && npm run build && npm run test:engine`.

- **Worker:** silnik działa w module Web Worker; maski znaków przez `OffscreenCanvas`; Geist Mono 400 (wszystkie podzbiory z `@fontsource/geist-mono`) ładowany w Workerze przez `FontFace` **przed** pierwszym renderem, bo `canvasGlyphs` zapamiętuje maski na stałe (`proj`).
- **Klient:** tryb „najnowszy wygrywa” (przy zajętym Workerze czeka najwyżej jedno, ostatnie zlecenie). `test`: 10 szybkich zleceń → 2 rendery.
- **Zgodność z Node (`test`, Chromium 141 headless):** 32 z 32 przypadków bajt w bajt (17 efektów bez czcionki, 13 post FX, Color, Dither). Characters pominięty: zależy od czcionki i rasteryzera.
- **Znaki presetów po decyzji użytkownika (14 X 2026, `test`):** Braille (cały blok U+2800–28FF) oraz ●◕◑◔○∙ i ◆◼▲▼◇△▽ rysuje kod silnika (`src/core/glyphs-drawn.ts`, wpięte w `canvasGlyphs`, więc działa w Node i w przeglądarce); Σ Δ Ψ Ω z Noto Sans Mono (podzbiór greek), półszerokie katakana z Noto Sans JP (podzbiory pobierane na żądanie). 154 z 154 znaków 16 presetów bez czcionek urządzenia. Testy silnika: 86 z 86 (Braille: kropka ⇔ bit dla 256 znaków × 3 rozmiary; gęstość nierosnąca wzdłuż rampy; render Braille bez czcionki). Wcześniejszy stan poniżej.
- **Pokrycie znaków Geist Mono (`test`):** 11 z 16 presetów w pełni; Braille 0/10, Katakana 0/21, Geometric 3/10, Dots 2/8, Math 6/10 (brak ΣΔΨΩ). Wynik z przeglądarki zgodny z tablicami cmap czcionki (`app/scripts/font-cmap.py`). Brakujące znaki rysuje czcionka zastępcza urządzenia, więc w tych 5 presetach eksport zależy od urządzenia. Forensic nie ma rampy (sekcja 5 nie dotyczy).
- **Czas (`test`, 1600×1067, mediana z 3, ta sama maszyna co pomiar Node):** w Chromium zwykle podobnie lub szybciej niż w Node (stosunek od 0,4× gradientmap do 1,8× disco). Ponad 100 ms w obu przebiegach: 10 z 18 efektów i 6 z 13 post FX; najwolniejsze halftone ok. 570–600 ms, bloom ok. 540–570, blur ok. 475, hexmosaic 240–300. Między przebiegami czasy różnią się do 2× (piaskownica), więc to rzędy wielkości. Narzut Worker → kanwa: 0,5–2 ms.
- **Pamięć (`test`):** 216 renderów (18 efektów × skala 1 i 2) przez pełną ścieżkę do kanwy: RSS Chromium po pierwszej partii ok. 533–537 MB i dalej płasko (±4 MB). Bez oznak przecieku. Sterty Workera Chromium nie udostępnia (`performance.memory` brak w Workerze).
- **`BRAK`:** Safari i Firefox (w szczególności `self.fonts` w Workerze i `OffscreenCanvas` 2D), urządzenia mobilne, pomiar przy rozdzielczości podglądu w edytorze.
