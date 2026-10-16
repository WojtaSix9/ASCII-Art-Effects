# ASCII Art Effects — podsumowanie prac

Stan na 15.10.2026. Repozytorium `WojtaSix9/ASCII-Art-Effects`, gałąź `claude/happy-bell-5qulv1`, ostatni commit `59bbcbc`.
Strona produkcyjna: **https://ascii-art-effects.vercel.app**

## W skrócie

- Przeglądarkowe narzędzie do efektów ASCII, pikselowych i graficznych na zdjęciach, w stylu ascii-magic.com.
- Wszystko działa lokalnie w przeglądarce, bez serwera.
- **91 z 91 efektów** z katalogu jest gotowych.
- Do tego:
  - pełny edytor;
  - 16 post FX;
  - korekcja koloru i światła;
  - kadrowanie;
  - warstwa tekstu;
  - eksport PNG/JPG @1x/@2x;
  - strony informacyjne.
- Silnik ma 308 testów własności (wszystkie przechodzą). Wynik w przeglądarce jest identyczny bajt w bajt z Node: 106/106 przypadków.

## Architektura

| Część | Opis |
|---|---|
| `engine/` | Silnik efektów: czysty TypeScript na buforach RGBA, bez DOM. Testy uruchamiane w Node (22.18+ uruchamia `.ts` bez kompilacji). |
| `app/` | Strona: Vite + TypeScript, bez frameworka UI. Silnik działa w Web Workerze (OffscreenCanvas, webfonty ładowane na żądanie). |
| `docs/` | Specyfikacja, brief, katalog efektów, dziennik prac i decyzji (`06-silnik-efektow.md`), projekty Lights (07) i tekstu (08). |
| `vercel.json` | Build w `app/`, wynik w `app/dist`, routing SPA, długi cache zasobów. |

**Kolejność renderu:** kadr → skala → światła → styl (efekt) → post FX → kolor → warstwa tekstu.

**Zasady silnika:**
- Wartości w px rosną ze skalą eksportu.
- Losowość pochodzi z seeda i jest zakotwiczona w ułamkach obrazu albo w px źródła.
- Dzięki temu eksport @2x wygląda tak samo jak podgląd, tylko ostrzej.
- Efekty „stanowe” (Flow Field, Datamosh, Dreamdust, Beacon) dają deterministyczną pojedynczą klatkę.

## Przebieg prac (kroki z briefu)

| Krok | Co zrobione |
|---|---|
| Przygotowanie | Uporządkowanie repo, poprawki w dokumentacji (konwencja gęstości znaków, kolejność rampy). |
| 1 | Szkielet aplikacji: Vite + TS, tokeny CSS, czcionki z npm, routing. |
| 2 | Silnik w Web Workerze, strona testowa `/dev/engine` (zgodność z Node, pokrycie znaków, czasy). Glify Braille/Dots/Geometric rysowane kodem, czcionki Noto dla greki i katakany. |
| 3 | Hero z suwakiem przed/po, zdjęcie przykładowe, panel parametrów w edytorze. Konfiguracja Vercel. |
| 4 | Dwa zdjęcia przykładowe, miniatury efektów, kafelki na stronie głównej i strona `/effects`. |
| 5 | Pełny edytor: panel stylów, historia cofnij/ponów, Color, Post FX, zoom, eksport PNG/JPG @1x/@2x, własne zdjęcie. Lights (oświetlenie przed stylem). |
| 6 | Optymalizacja silnika z wynikiem identycznym bajt w bajt (np. rozmycie 2,1× szybciej). |
| 7.1 | Photo Filter, Gradient Map w Color, Levels, Curves. |
| 7.2 | Post FX per znak: Character Bloom, Character Chromatic; Halftone jako post FX. |
| 7.3 | Kadrowanie (zakładka Crop). |
| 7.4 | Warstwa tekstu: do 4 tekstów, 4 czcionki OFL (w tym Playfair Display i Bebas Neue), obrys, cień, przeciąganie na płótnie. |
| 8 | Strony `/how-to` i `/licenses`, stopka, audyt dostępności (axe-core, WCAG 2.1 AA), układ edytora na wąskich ekranach. |
| 9 | Wszystkie pozostałe efekty Faz 2 i 3 w 13 partiach (poniżej). |
| Deploy | Wdrożenie produkcyjne na Vercel z commita `59bbcbc`. |

## Efekty — 91 w 10 kategoriach

| Kategoria | Liczba | Efekty |
|---|---|---|
| ASCII & Text | 6 | Characters, ASCII Studio, Block, Dots, Mixed, Braille |
| Pixels & Blocks | 6 | Pixel Art, Mosaic, LEGO, Voxel, Hex Mosaic, LED Matrix |
| Print & Paper | 15 | Dither, Stippling, Risograph, Comic, Sketch, Engraving, Warhol, Cyanotype, Halftone, Woodblock, Posterize, Mezzotint, Pointillize, Crosshatch, CMYK Drops |
| Geometric | 15 | Cross, Diamond, Lines, Diagonal, Specimen, Low Poly, Droste, Truchet, Iso Extrude, Flow Field, Lattice, Topography, Forms, Schematic, Neon Grid |
| Distort | 8 | Smudge, Pinch, Spherize, Twirl, ZigZag, Ripple, Polar, Shear |
| Blur & Focus | 4 | Motion Blur, Tilt-Shift, Gaussian Blur, Radial Blur |
| Glitch & Signal | 10 | CRT Screen, Pixel Sort, Forensics, Digital Distortion, Datamosh, Lofi, RGB Split, Scanline, Thermal, Beacon |
| Light & Colour | 11 | Disco, Anaglyph 3D, Gradient Map, Prism, Dreamdust, Light Wind, Kaleidoscope, Warpbloom, Duotone, Edge Glow, Aberration |
| Glass | 7 | Frosted Glass, Tinted Glass, Shatter, Vitrine, Glass Orb, Fluted Glass, Liquid Glass (10 tekstur) |
| Material & Texture | 9 | Waves, Oil Paint, Watercolor, Chrome, Thin-Film, Marble, Molten Metal, Crystallize, Emboss |

**Post FX (16):**
- Blur, Vignette, Scan Lines, Bloom, Character Bloom, Chromatic, Character Chromatic, RGB Split;
- CRT Curvature, Glitch, Film Grain, Pixelate, Halftone, Film Dust, Sharpen, Noise.

**Efekty jako interpretacje:**
- Większość efektów Fazy 2 i 3 to moje interpretacje (oznaczenie `proj`), bo dokumentacja oryginału podaje tylko nazwy i parametry.
- Najbardziej niepewne są Specimen, Forms, Forensics, Beacon, Vitrine, Marble i Molten Metal (`proj?`).

## Jak testowano

- **Silnik, 308 testów:** sprawdzają własności, nie konkretne piksele. Przykłady:
  - parametry zerowe = obraz bez zmian;
  - pole bryły zgodne z geometrią (kula π/4);
  - linie Flow Field biegną wzdłuż izolinii;
  - Mixed z trzema takimi samymi zestawami = Characters bajt w bajt;
  - ogólny test skali: render @2x po zmniejszeniu przypomina render @1x.
- **Zgodność przeglądarka = Node:** 106/106 przypadków (Chromium przez Playwright). Wyjątek: efekty rysujące znaki czcionką (Characters, Mixed, Specimen), które zależą od rasteryzera.
- **Brak regresji:** `hash-baseline` — po zmianach we wspólnym kodzie stare wyniki pozostały identyczne (436 przypadków).
- **Aplikacja:**
  - testy UI, edytora, smoke i dostępności (axe-core);
  - od kroku 9 uruchamiane tylko dla tego, co się zmieniało.
- **Ocena wzrokowa:** arkusze efektów na dwóch zdjęciach przykładowych.
- **Poprawki znalezione przez testy:**
  - Specimen przy eksporcie @2x układał tekst inaczej;
  - Tinted Glass pokazywał fakturę przy wyłączonym podświetleniu.
- **Poprawki po ocenie wzrokowej:**
  - Shatter, Chrome i Marble wyglądały źle;
  - podniesione wartości domyślne efektów, które na miniaturach były prawie niewidoczne.

## Czego nie sprawdzono / znane ograniczenia

- Brak testów w Safari, Firefoksie i na telefonach (działa i jest sprawdzone w Chromium).
- Efekty oceniano na dwóch zdjęciach przykładowych i obrazach syntetycznych, nie na szerokim zestawie zdjęć (twarze, skóra, tekstury).
- Brak porównania z oryginałem (ascii-magic.com).
- Pełnych testów edytora, smoke i a11y nie uruchamiano po partiach 10–13, bo zmieniły się tylko dane katalogu, nie kod interfejsu.
- Nie sprawdzono, czy Mixed i Specimen ładują w przeglądarce czcionki dla wszystkich znaków.
- Watercolor jest dość ziarnisty, a jego ciemniejsze brzegi plam są słabo widoczne.
- Liquid Glass z teksturami chevron i diamond mocno zniekształca przy domyślnych ustawieniach.
- Droste nie ma płynnej spirali (jest zagnieżdżenie z obrotem); Schematic nie ma opisów tekstowych; Specimen nie ma wyboru kroju.
- Brak animacji (eksport tylko statyczny).
- **Wdrożenie Vercel:** status READY, ale strony nie dało się otworzyć z sesji (blokada sieci). Do sprawdzenia ręcznie: `/effects` (91 kafelków), np. `/?style=glassorb`, `/dev/engine`.

## Do decyzji / następne kroki

1. **Vercel — auto-deploy:**
   - po kroku 6 pushe nie wdrażały się same;
   - sprawdź w Settings → Git, czy auto-deploy jest włączony, a gałąź produkcyjna to `claude/happy-bell-5qulv1`.
2. **Vercel — ochrona:**
   - Deployment Protection (Vercel Authentication) jest włączona;
   - jeśli strona ma być publiczna, wyłącz ją w Settings → Deployment Protection.
3. **Testy:** jeden pełny przebieg wszystkich testów aplikacji (ponad 10 minut) i przegląd wszystkich miniatur na oko.
4. **Inne przeglądarki:** test w Safari i Firefoksie, zwłaszcza Worker + OffscreenCanvas + czcionki.
5. **Interpretacje efektów:** przegląd efektów oznaczonych `proj?` i ewentualne poprawki ich wyglądu.

## Kontynuacja pracy lokalnie

```sh
git clone https://github.com/WojtaSix9/ASCII-Art-Effects && cd ASCII-Art-Effects
git checkout claude/happy-bell-5qulv1
(cd engine && npm ci && node scripts/check-engine.ts)
(cd app && npm ci && npx playwright install chromium && npm run build && npm run smoke)
```

Szczegółowy dziennik: `docs/06-silnik-efektow.md`. Statusy efektów: `engine/src/data/effects.json`.
