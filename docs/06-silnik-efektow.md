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
| **Post FX: 16 z 16 darmowych:** blur, vignette, scan lines, bloom, chromatic, RGB split, CRT curvature, glitch, film grain, pixelate, halftone, film dust, sharpen, noise (stała kolejność) oraz Character Bloom i Character Chromatic (per glif, sekcja 10) | `test` |
| **Skala eksportu:** ten sam render w skali 1–8× (wartości w px mnożone przez skalę) | `test` |
| **Rejestr 91 efektów** `src/data/effects.json` wygenerowany z pliku 02 (id, nazwa, kategoria, silnik, złożoność, opis, faza, status `ready`/`soon`) | `test` |

**Nie ma (`BRAK`):** 73 efekty Faz 2–3; warstwa tekstu; animacje; testy w Safari i Firefoksie; ocena na prawdziwych zdjęciach. Integracja z przeglądarką (Worker, OffscreenCanvas, webfont) i test w Chromium: sekcja 7.

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

## 8. Krok 6: optymalizacja (15 X 2026)

**Zasada:** wynik bajt w bajt taki sam jak przed optymalizacją (te same działania w tej samej kolejności). Dowód: `engine/scripts/hash-baseline.ts`, 212 przypadków (wszystkie efekty, 13 post FX, Lights, niedomyślne parametry: obroty, obrysy, kształty kropek; 2 obrazy × skale 1 i 1,7), identycznych przed i po. Kontrola skryptu: celowo odwrócony znak obrotu w Cross dał 8 różnic. Zgodność Node ↔ przeglądarka nadal 32 z 32.

**Co zmieniono (`kod`):**
- `blur`: 4 kanały w jednym przejściu, bez wywołań `clamp`, przebieg pionowy wierszami z sumami bieżącymi w `Float64Array`.
- Kształty siatkowe (Dots, Cross, Diamond) i wypustki LEGO: rysowanie tylko w zasięgu kształtu (`paintSDFNear`; poza nim krycie 0, więc wynik ten sam); obrót bez tworzenia tablicy na piksel.
- Hex Mosaic: współrzędne kafelka liczone raz na piksel, bez tablic; Characters: maska znaku raz na render; Halftone: parametry odczytane raz; Chromatic: stała raz; `resize`: współrzędne kolumn raz.
- **Pamięć podręczna:** ostatnie przeskalowane (i oświetlone) źródło oraz ostatnie tło dla danego źródła. Przy zmianie parametru stylu w edytorze nie liczymy ich od nowa. Testy: 12 renderów na tym samym źródle = rendery na świeżej kopii; render nie zmienia obrazu źródłowego (`check-engine.ts`, sekcja 15; 98 z 98). Kontrola: usunięcie `bgOpacity` z klucza pamięci tła wykrywają 2 testy.

**Wynik (`test`):**
- Edytor (Chromium, podgląd 726×558, zmiana parametru): przed 20–75 ms, po **5–63 ms**; wszystkie zmierzone efekty poniżej celu ~100 ms (`app/reports/editor-preview-times.txt`).
- Node, 1600×1067, minimum z 7, render „na zimno”: Hex Mosaic 2,3×, Blur 2,1×, Halftone i Bloom 1,7×, Sharpen 1,5×, LEGO 1,3×, reszta bez istotnej zmiany. „Przy suwaku”: Characters 3,7×, Block 4,8×, Diamond 3,1×, Dots 2,3×.
- Pomiary w piaskownicy mają duży szum (±20–50% przy niezmienionym kodzie); porównania robiłem dwukrotnie, starą i nową wersją na zmianę.

**Nie zrobione (`BRAK`):** WebGL (przy obecnych czasach zbędny dla podglądu); render „na zimno” dużych zdjęć (np. eksport @2x 3000 px) nadal trwa setki ms do sekund; Vignette, CRT Curvature, Braille i Halftone nie przyspieszyły istotnie; pomiar w Safari i na telefonach.

## 9. Krok 7, punkt 1: Photo Filter, Gradient Map w Color, Levels, Curves (15 X 2026)

Kod: `engine/src/post/grade.ts`, parametry w `COLOR_PARAMS` (`post/color.ts`), UI: zakładka Color w edytorze (`app/src/ui/curves-editor.ts`).

- **Kolejność (`docs`, plik 01 sekcja 8.9):** preset → Photo Filter → hue → saturation/vibrance → Gradient Map → grayscale → tint → invert, potem **Levels → Curves** na gotowej klatce.
- **Photo Filter (`proj`; lista oryginału nieznana):** 14 filtrów (Warming, Warming light, Cooling, Cooling light, Sepia, Red, Orange, Yellow, Green, Cyan, Blue, Violet, Magenta, Underwater), gęstość 0–100 (domyślnie 25), „Preserve luminosity”: luminancja dokładnie jak przed filtrem; gdy kanał wyszedłby poza 0–255, zmniejszane jest tylko nasycenie. Pierwsza wersja (samo skalowanie kanałów) zaniżała jasność o 0,017 dla filtra Blue; wykrył to test, po poprawce 0,0018 (granica zaokrągleń 8 bit 0,00196).
- **Gradient Map w Color:** presety Heat, Ocean, Sunset, Mono (te same co efekt Gradient Map) i siła 0–100.
- **Levels:** kanał RGB / R / G / B, wejście czarne/białe, gamma 0,1–9,99, wyjście czarne/białe.
- **Curves:** krzywe RGB, R, G, B (do 16 punktów), interpolacja monotoniczna Fritscha–Carlsona (bez przestrzelenia między punktami, `docs`); kanały, potem RGB.
- **Testy (`test`):** silnik 111 z 111 (m.in. wartości domyślne = bajt w bajt bez zmian, Levels monotoniczne dla 200 losowych ustawień, krzywa przez punkty bez przestrzelenia, kolejność Levels → Curves); dotychczasowe wyniki identyczne (212 przypadków + 21 ustawień Color); edytor 44 z 44 (m.in. dodawanie, przeciąganie, strzałki i Delete na krzywej, eksport z krzywą = render).
- **`BRAK`:** zapamiętywanie zaznaczonego kanału krzywej przy cofnij/ponów; histogram pod krzywą; Levels osobno dla każdego kanału naraz (jest wybór jednego kanału albo RGB).

## 10. Krok 7, punkt 2: Character Bloom, Character Chromatic, Halftone jako post FX (15 X 2026)

Kod: `engine/src/post/glyphfx.ts` (oba efekty per glif), `engine/src/post/postfx.ts` (definicje i Halftone), `engine/src/effects/grid.ts` (`runGlyphGrid`).

- **Gdzie działają charBloom i charChroma (`docs` + `proj`):** plik 01 mówi „tylko w trybach glifowych”. Za tryby glifowe uznałem style, które rysują znaki i mają eksport tekstowy: **Characters, Block, Braille** (`GLYPH_STYLES`). W pozostałych stylach wynik jest bajt w bajt taki sam (`test`). W edytorze są wtedy wyszarzone z podpowiedzią, a ustawienie zostaje w stanie.
- **Jak (`proj`):** gdy któryś z nich jest włączony, styl rysuje znaki na przezroczystej warstwie, a nie wprost na tle. Potem `composeGlyphs` nakłada warstwę na tło:
  - **Chromatic:** R tuszu przesunięte o +offset, B o −offset (px × skala, zaokrąglone), G na miejscu; **tło się nie przesuwa**. Domyślnie 2 px. Przy 3 px i komórce 10 px przesunięcie to pół znaku i efekt był bardzo mocny (`oko`).
  - **Bloom:** rozmyty tusz (alfa przemnożona, promień 0,35 wysokości komórki) dodany trybem screen, wzmocnienie 2 × intensity. Tylko rozjaśnia.
  - Kolejność stała: tusz z Chromą, potem poświata. Plik 01 mówi „rysowane per glif podczas malowania siatki”. U mnie to warstwa znaków składana po siatce. Skutek jest ten sam: efekt dotyczy tylko znaków i nie da się zmienić jego kolejności.
  - Wyłączone albo Bloom 0 oznacza starą ścieżkę bez warstwy, więc wynik jest bajt w bajt jak dotąd.
- **Halftone jako post FX (`proj`, plik 01 podaje tylko `size` 2–20, `shape` (dots), `colour` (source)):**
  - Siatka komórek wyrównana do osi, kształty: Dots, Squares, Lines. **Pole kształtu = ton komórki**, dla koła przez odwrócenie pola koła przyciętego do kwadratu, więc średnia jasność się zachowuje (błąd ≤ 0,009 na jednolitej szarości, `test`).
  - `source`: jasne kształty na czerni w kolorze komórki znormalizowanym do najjaśniejszego kanału, co zachowuje odcień, ale daje mocniejsze, „neonowe” kolory (`oko`).
  - `mono`: czarny tusz na bieli.
  - Miejsce w kolejności: po Pixelate (plik 01, punkt 5).
- **Testy (`test`):**
  - Silnik 122 z 122: 11 nowych; test „każdy post FX zmienia obraz” obejmuje teraz 14 efektów po klatce.
    - Chroma: R(x) = G(x − dx) i B(x) = G(x + dx) przy skali 1 i 2, 0 niezgodnych.
    - Bloom: żaden piksel nie ciemnieje; średnia rośnie z intensity; udział pikseli objętych poświatą 24,6% vs 21,4% przy skali 1 i 2.
    - Halftone: monotoniczny ton, odcień zachowany, skala 2 vs 1 PSNR 26,7 dB.
  - Mutacje: stały promień poświaty, Chroma bez skali, naiwny promień kropki, Halftone bez skali i ruszenie tła. Każda wykryta.
  - Dotychczasowe 212 przypadków bajt w bajt bez zmian. Przeglądarka = Node: 35 z 35 (nowe: charBloom i charChroma na Braille, Halftone na Pixel Art).
  - Edytor: 46 z 46.
- **Czas (Node, 480×320, orientacyjnie):** Characters 63 ms, z Bloom 55 ms, Braille z oboma 47 ms, Halftone po Pixel Art 26 ms.
- **`BRAK`:** porównanie z oryginałem (nie mam jego wyglądu tych efektów); kąt siatki Halftone (jest tylko wyrównana do osi); Chroma tylko w poziomie (oryginał podaje tylko `offset`).


## 11. Krok 7, punkt 3: kadr (15 X 2026)

Pliki 01 i 05 wymieniają tylko ikonę „kadr” (`[?]`), więc cały projekt to `proj`. Kod:
- silnik: `engine/src/core/crop.ts` i `pipeline.ts`;
- edytor: `app/src/editor/crop-ui.ts`, zakładka Kadr i przycisk w pasku górnym.

**Silnik**
- `RenderState.crop = { x, y, w, h }` w ułamkach zdjęcia, stosowany jako pierwszy: przed skalą, światłami i stylem. Skutek: siatka znaków, pozycje świateł, post FX, Color i eksport tekstowy liczą się względem kadru.
- Wartości spoza 0–1, zerowe i NaN dają błąd. Kadr mniejszy niż 1 px daje 1 px.
- Pamięć podręczna źródła ma kadr w kluczu.

**Edytor**
- Pole z całym zdjęciem i prostokątem kadru: środek przesuwa, narożniki zmieniają rozmiar.
- Proporcje: Dowolne, Oryginał, 1:1, 4:5, 3:2, 16:9, 9:16. Wybór proporcji daje największy kadr w tej proporcji, wyśrodkowany na obecnym.
- Pola X, Y, szerokość, wysokość w px źródła.
- Klawiatura: strzałki 1% (Shift 5%), Alt + strzałki zmieniają rozmiar.
- Najmniejszy bok 16 px.
- Kadr równy całemu zdjęciu zapisuje się jako brak kadru.
- Kadr jest w historii cofnij/ponów. Zmiana zdjęcia go usuwa.
- Podgląd, „przed/po”, pole świateł i eksport pokazują kadr.

**Testy (`test`)**
- Silnik 130 z 130, 8 nowych:
  - render z kadrem = render wyciętego zdjęcia, bajt w bajt, dla 7 stylów przy skali 1 i 2, także ze światłami, post FX i Color;
  - kadr 0,0,1,1 = bez kadru;
  - zmiana kadru nie korzysta z nieaktualnej pamięci;
  - eksport tekstowy uwzględnia kadr.
- Mutacje silnika: klucz pamięci bez kadru i kadr po światłach. Obie wykryte.
- Dotychczasowe hashe bez zmian.
- Edytor 55 z 55, 9 nowych:
  - proporcja 1:1 daje kwadrat w pikselach i na ekranie;
  - przeciąganie, narożnik z blokadą proporcji, pola, strzałki, cofnij;
  - eksport @1x = render, wymiary kadru;
  - reset daje obraz identyczny jak przed kadrowaniem;
  - zmiana zdjęcia usuwa kadr.
- Mutacje edytora: układ bez kadru i brak resetu przy zmianie zdjęcia. Obie wykryte.

**`BRAK`**
- Żaden test nie wykrywa sprawdzenia limitu kanwy bez kadru: ostrzeżenie byłoby tylko ostrożniejsze, a test wymagałby eksportu ponad 100 Mpx.
- Brak obrotu i odbicia.
- Brak kadrowania bezpośrednio na płótnie (jest tylko pole w panelu).
- Pozycje świateł nie przeliczają się przy zmianie kadru, bo zostają względem kadru.
- Nie sprawdzone na ekranach dotykowych.

## 12. Krok 7, punkt 4: warstwa tekstu (15 X 2026)

Projekt i decyzje użytkownika: `docs/08-tekst-projekt.md`.

**Silnik**
- `RenderState.text` to lista do 4 napisów (`TEXT_PARAMS`). `RenderOpts.text` to dostawca rysujący kanwą 2D (`canvasText`).
- Warstwa jest nakładana **po Color, Levels i Curves**, więc korekty jej nie zmieniają.
- Rozmiar to % wysokości ramki, pozycja to % ramki po kadrze.
- Wynik zawiera prostokąty napisów (`textBoxes`) do zaznaczania w edytorze.
- Bez napisów, z pustym tekstem albo kryciem 0 nie ma dostawcy ani warstwy, więc wynik jest bajt w bajt jak wcześniej.

**Node (testy)**
- `@napi-rs/canvas` nie łączy dwóch plików jednej rodziny po unicode-range: ż, ł, ą wychodziły jako puste prostokąty (`oko`).
- Dlatego `scripts/text-fonts.ts` rejestruje podzbiory latin i latin-ext pod osobnymi nazwami i podaje je jako listę.
- Kroje są w devDependencies silnika.

**Przeglądarka**
- Kroje rejestrowane w Workerze przez `FontFace` z unicode-range.
- Pobierane dopiero wtedy, gdy napis ich używa (`ensureText`, przed renderem).

**Edytor**
- Przycisk `T` w pasku górnym, zakładka Tekst: lista napisów, pole wielowierszowe, krój, grubość, rozmiar, wyrównanie, kolor, krycie, X/Y, obrys, cień; w części zaawansowanej odstęp liter i wysokość linii.
- Na płótnie ramki napisów: przeciąganie, strzałki (Shift 5%), Delete.
- Przy okazji poprawione dwie rzeczy:
  - id pól panelu parametrów są unikalne między panelami (wcześniej `p-color` powtarzało się w Lights i Post FX);
  - Ctrl+Z w polu wielowierszowym nie cofa historii edytora.

**Testy (`test`)**
- Silnik 141 z 141, 11 nowych:
  - Color (B&W, hue, invert, Curves) i post FX nie zmieniają pikseli napisu: 0 z 1477 pikseli o pełnym kryciu innych niż #ffcc00;
  - skala 2 vs 1: zasięg napisu ±1 px;
  - środek, lewo i prawo zgodne z X (±0,1 rozmiaru);
  - wysokość rośnie liniowo: 29/43/57 px dla 20/30/40;
  - obrys i cień poszerzają napis;
  - z kadrem = jak na wyciętym zdjęciu;
  - polskie znaki w 4 krojach.
- Dwa testy poprawione po pierwszym uruchomieniu, bez zmiany progów:
  - „×2 przy rozmiarach 10 i 20” mierzył też stałą nadwyżkę antyaliasingu i hinting przy 14 px; zastąpiony równymi przyrostami;
  - przy rozmiarze 40 słowo wychodziło poza ramkę, więc test liniowości używa krótszego napisu.
- Mutacje silnika: Color po tekście, rozmiar w stałych px, brak wyrównania. Wszystkie wykryte.
- Edytor 65 z 65, 10 nowych, m.in.:
  - Bebas Neue wyraźnie węższy niż Geist Mono, czyli krój wczytany w Workerze;
  - przeciąganie +20%/−30%, cofnij;
  - eksport PNG z napisem = render;
  - limit 4, Delete.
- Mutacje edytora: brak ładowania krojów, brak ramek, Ctrl+Z w polu. Wszystkie wykryte.
- Dotychczasowe hashe bez zmian.

**`BRAK`**
- Porównanie Node = przeglądarka nie obejmuje napisów (różne rasteryzery).
- Brak obrotu i paska tła (decyzja).
- Licencje krojów do stopki: krok 8.
- Nie sprawdzone w Safari i Firefoksie ani na ekranach dotykowych.
